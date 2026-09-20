# ruff: noqa: E501
import argparse
import hashlib
import json
import re
import shutil
import unicodedata
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from statistics import fmean

from app.ingestion.oracle_elixir import (
    GameRecords,
    InvalidSourceError,
    file_sha256,
    iter_grouped_games,
    transform_game,
)
from app.services.analytics import (
    DRAFT_METRICS,
    PLAYER_METRICS,
    TEAM_METRICS,
    team_match_reading,
)

DEFAULT_SELECTIONS = (
    ("LCK", 2025),
    ("LPL", 2025),
    ("LEC", 2025),
    ("LTA N", 2025),
    ("LFL", 2025),
)


def mean(records: list[dict], key: str) -> float | None:
    values = [record[key] for record in records if record.get(key) is not None]
    return fmean(values) if values else None


def total(records: list[dict], key: str) -> float:
    return sum(record[key] for record in records if record.get(key) is not None)


def count(records: list[dict], key: str) -> int:
    return sum(record.get(key) is not None for record in records)


def ratio(numerator: float, denominator: float, multiplier: float = 1.0) -> float | None:
    return numerator * multiplier / denominator if denominator else None


def team_aggregate(records: list[dict], matches: dict[str, dict]) -> dict:
    blue = [record for record in records if record["side"] == "BLUE"]
    red = [record for record in records if record["side"] == "RED"]
    duration_records = [
        record for record in records if matches[record["game_id"]]["duration_seconds"]
    ]
    return {
        "matches_played": len(records),
        "win_rate": (mean(records, "result") or 0.0) * 100.0,
        "avg_game_duration": mean(
            [
                {"duration": matches[record["game_id"]]["duration_seconds"] / 60.0}
                for record in duration_records
            ],
            "duration",
        ),
        "kills_per_game": mean(records, "kills"),
        "deaths_per_game": mean(records, "deaths"),
        "gold_diff_at_15": mean(records, "gold_diff_at_15"),
        "first_blood_rate": _percent(records, "first_blood"),
        "first_tower_rate": _percent(records, "first_tower"),
        "first_dragon_rate": _percent(records, "first_dragon"),
        "first_herald_rate": _percent(records, "first_herald"),
        "first_baron_rate": _percent(records, "first_baron"),
        "dragons_per_game": mean(records, "dragons"),
        "barons_per_game": mean(records, "barons"),
        "towers_per_game": mean(records, "towers"),
        "blue_win_rate": (mean(blue, "result") * 100.0) if blue else None,
        "red_win_rate": (mean(red, "result") * 100.0) if red else None,
        "n_duration": len(duration_records),
        "n_kills": count(records, "kills"),
        "n_deaths": count(records, "deaths"),
        "n_gd15": count(records, "gold_diff_at_15"),
        "n_first_blood": count(records, "first_blood"),
        "n_first_tower": count(records, "first_tower"),
        "n_first_dragon": count(records, "first_dragon"),
        "n_first_herald": count(records, "first_herald"),
        "n_first_baron": count(records, "first_baron"),
        "n_dragons": count(records, "dragons"),
        "n_barons": count(records, "barons"),
        "n_towers": count(records, "towers"),
        "n_blue": len(blue),
        "n_red": len(red),
    }


def _percent(records: list[dict], key: str) -> float | None:
    value = mean(records, key)
    return value * 100.0 if value is not None else None


def metric(spec: tuple[str, str, str, str, str], row: dict, eligible: int, benchmark=None):
    metric_id, label, value_key, count_key, unit = spec
    value = row.get(value_key)
    benchmark_value = benchmark.get(value_key) if benchmark else None
    return {
        "id": metric_id,
        "label": label,
        "value": value,
        "unit": unit,
        "sample_size": int(row.get(count_key) or 0),
        "eligible_sample_size": eligible,
        "benchmark": benchmark_value,
        "delta": value - benchmark_value
        if value is not None and benchmark_value is not None
        else None,
    }


def player_summaries(records: list[dict], matches: dict[str, dict]) -> list[dict]:
    groups: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for record in records:
        groups[(record["player_id"], record["player_name"], record["role"])].append(record)
    summaries = []
    for (player_id, player_name, role), rows in groups.items():
        complete_kda = [
            row
            for row in rows
            if row["kills"] is not None and row["assists"] is not None and row["deaths"] is not None
        ]
        complete_kp = [
            row
            for row in rows
            if row["kills"] is not None
            and row["assists"] is not None
            and row["team_kills"] is not None
        ]
        row = {
            "kda": ratio(
                total(complete_kda, "kills") + total(complete_kda, "assists"),
                max(1.0, total(complete_kda, "deaths")),
            ),
            "kill_participation": ratio(
                total(complete_kp, "kills") + total(complete_kp, "assists"),
                total(complete_kp, "team_kills"),
                100.0,
            ),
            "cs_per_min": _per_minute(rows, matches, "total_cs"),
            "gold_per_min": _per_minute(rows, matches, "total_gold"),
            "damage_per_min": _per_minute(rows, matches, "damage_to_champions"),
            "vision_per_min": _per_minute(rows, matches, "vision_score"),
            "gold_diff_at_15": mean(rows, "gold_diff_at_15"),
            "champion_pool_size": len({item["champion"] for item in rows}),
            "win_rate": (mean(rows, "result") or 0.0) * 100.0,
            "n_kda": len(complete_kda),
            "n_kp": len(complete_kp),
            "n_cs": _per_minute_count(rows, matches, "total_cs"),
            "n_gold": _per_minute_count(rows, matches, "total_gold"),
            "n_damage": _per_minute_count(rows, matches, "damage_to_champions"),
            "n_vision": _per_minute_count(rows, matches, "vision_score"),
            "n_gd15": count(rows, "gold_diff_at_15"),
            "n_champion": count(rows, "champion"),
            "n_matches": len(rows),
        }
        summaries.append(
            {
                "player_id": player_id,
                "player_name": player_name,
                "role": role,
                "metrics": [metric(spec, row, len(rows)) for spec in PLAYER_METRICS],
            }
        )
    return sorted(
        summaries,
        key=lambda item: (item["role"], -item["metrics"][-1]["sample_size"], item["player_name"]),
    )


def _per_minute(records: list[dict], matches: dict[str, dict], key: str) -> float | None:
    usable = [
        record
        for record in records
        if record.get(key) is not None and matches[record["game_id"]].get("duration_seconds")
    ]
    minutes = sum(matches[record["game_id"]]["duration_seconds"] for record in usable) / 60.0
    return ratio(total(usable, key), minutes)


def _per_minute_count(records: list[dict], matches: dict[str, dict], key: str) -> int:
    return sum(
        record.get(key) is not None
        and matches[record["game_id"]].get("duration_seconds") is not None
        for record in records
    )


def draft_summaries(actions: list[dict], target_teams: list[dict], matches: dict[str, dict]):
    eligible = {
        team["game_id"]
        for team in target_teams
        if matches[team["game_id"]]["quality_status"] == "COMPLETE"
    }
    results = {team["game_id"]: team["result"] for team in target_teams}
    champions: dict[str, dict[str, set[str]]] = defaultdict(lambda: {"PICK": set(), "BAN": set()})
    for action in actions:
        if action["game_id"] in eligible:
            champions[action["champion"]][action["action_type"]].add(action["game_id"])
    output = []
    for champion, action_games in champions.items():
        picks = action_games["PICK"]
        bans = action_games["BAN"]
        picked_results = [results[game_id] for game_id in picks]
        row = {
            "picks": len(picks),
            "bans": len(bans),
            "presence_count": len(picks) + len(bans),
            "pick_rate": ratio(len(picks), len(eligible), 100.0),
            "ban_rate": ratio(len(bans), len(eligible), 100.0),
            "presence": ratio(len(picks) + len(bans), len(eligible), 100.0),
            "champion_win_rate": fmean(picked_results) * 100.0 if picked_results else None,
            "n_pick_results": len(picked_results),
        }
        output.append(
            {
                "champion": champion,
                "metrics": [metric(spec, row, len(eligible)) for spec in DRAFT_METRICS],
            }
        )
    return sorted(
        output,
        key=lambda item: (
            -int(item["metrics"][2]["sample_size"]),
            -int(item["metrics"][0]["sample_size"]),
            item["champion"],
        ),
    )[:15]


def trends(records: list[dict], matches: dict[str, dict]) -> list[dict]:
    weeks: dict[date, list[dict]] = defaultdict(list)
    for record in records:
        played_at = matches[record["game_id"]].get("played_at")
        if played_at:
            day = played_at.date()
            weeks[day - timedelta(days=day.weekday())].append(record)
    return [
        {
            "week": week.isoformat(),
            "matches": len(rows),
            "win_rate": (mean(rows, "result") or 0.0) * 100.0,
            "gold_diff_at_15": mean(rows, "gold_diff_at_15"),
            "kills_per_game": mean(rows, "kills"),
        }
        for week, rows in sorted(weeks.items())
    ]


def metric_by_id(metrics: list[dict], metric_id: str) -> dict:
    return next(item for item in metrics if item["id"] == metric_id)


def display(item: dict) -> str:
    value = item["value"]
    if value is None:
        return "—"
    if item["unit"] == "%":
        return f"{value:.1f} %"
    if item["unit"] == "or":
        return f"{value:+,.0f}".replace(",", " ")
    if item["unit"] == "champions":
        return str(round(value))
    return f"{value:.2f}"


def case_study(overview: dict, metadata: dict, sources: list[Path]) -> str:
    filters = overview["filters"]
    team_metrics = overview["team_metrics"]
    win = metric_by_id(team_metrics, "T01")
    gd15 = metric_by_id(team_metrics, "T05")
    dragon = metric_by_id(team_metrics, "T08")
    tower = metric_by_id(team_metrics, "T07")
    blue = metric_by_id(team_metrics, "T14")
    red = metric_by_id(team_metrics, "T15")
    main_players = {}
    for player in overview["players"]:
        matches = metric_by_id(player["metrics"], "P09")["sample_size"]
        if player["role"] not in main_players or matches > main_players[player["role"]][0]:
            main_players[player["role"]] = (matches, player)
    source_lines = "\n".join(
        f"- `{source.name}` — SHA-256 `{file_sha256(source)}`" for source in sources
    )
    team_rows = "\n".join(
        "| {id} · {label} | {value} | {benchmark} | {delta} | {coverage} |".format(
            id=item["id"],
            label=item["label"],
            value=display(item),
            benchmark=display({**item, "value": item["benchmark"]})
            if item["benchmark"] is not None
            else "—",
            delta=f"{item['delta']:+.1f}" if item["delta"] is not None else "—",
            coverage=f"{item['sample_size']}/{item['eligible_sample_size']}",
        )
        for item in team_metrics
    )
    player_rows = "\n".join(
        "| {role} | {name} | {matches} | {kda} | {kp} | {cs} | {damage} | {gd15} | {wr} |".format(
            role=role,
            name=player["player_name"],
            matches=matches,
            kda=display(metric_by_id(player["metrics"], "P01")),
            kp=display(metric_by_id(player["metrics"], "P02")),
            cs=display(metric_by_id(player["metrics"], "P03")),
            damage=display(metric_by_id(player["metrics"], "P05")),
            gd15=display(metric_by_id(player["metrics"], "P07")),
            wr=display(metric_by_id(player["metrics"], "P09")),
        )
        for role, (matches, player) in sorted(main_players.items())
    )
    draft_rows = "\n".join(
        "| {champion} | {pick} | {ban} | {presence} | {wins} | {sample} |".format(
            champion=item["champion"],
            pick=display(metric_by_id(item["metrics"], "D01")),
            ban=display(metric_by_id(item["metrics"], "D02")),
            presence=display(metric_by_id(item["metrics"], "D03")),
            wins=display(metric_by_id(item["metrics"], "D04")),
            sample=metric_by_id(item["metrics"], "D04")["sample_size"],
        )
        for item in overview["draft"][:10]
    )
    top_draft = overview["draft"][0]
    return f"""# Étude portfolio — {filters["team_name"]}, {filters["league"]} {filters["year"]}

Cette étude est générée à partir des mêmes règles de transformation et contrats de KPI que l’application. Elle ne remplace pas une analyse causale : elle décrit un échantillon de matchs et rend visibles sa taille et sa couverture.

## Synthèse

- **{win["eligible_sample_size"]} matchs observés** pour {filters["team_name"]} ; taux de victoire de **{display(win)}**, contre **{display({**win, "value": win["benchmark"]})}** pour l’ensemble des observations équipe de {filters["league"]}.
- Avantage moyen à 15 minutes de **{display(gd15)}**, soit un écart de **{gd15["delta"]:+.0f} or** par rapport à la ligue.
- Premier dragon dans **{display(dragon)}** des matchs et première tour dans **{display(tower)}**.
- Taux de victoire de **{display(blue)}** côté bleu contre **{display(red)}** côté rouge. Cet écart est descriptif et dépend notamment des adversaires et de la sélection de côté.
- Priorité de draft la plus fréquente : **{top_draft["champion"]}**, présent dans **{display(metric_by_id(top_draft["metrics"], "D03"))}** des drafts de l’équipe.

## Méthode et périmètre

- Corpus global affiché dans le dashboard : **{metadata["data_status"]["matches"]:,} matchs acceptés** sur **{metadata["data_status"]["raw_rows"]:,} lignes raw**.
- Périmètre de l’étude : `league={filters["league"]}`, `year={filters["year"]}`, `team={filters["team_name"]}`.
- Un match accepté contient deux équipes, un seul vainqueur et cinq rôles distincts par côté.
- Les valeurs absentes ne sont pas remplacées par zéro ; la colonne couverture indique le nombre de matchs effectivement utilisables.

Fichiers sources :

{source_lines}

## 15 KPI équipe et benchmark de ligue

| KPI | {filters["team_name"]} | Benchmark {filters["league"]} | Écart brut | Couverture |
|---|---:|---:|---:|---:|
{team_rows}

Le benchmark garde la même ligue et la même saison, puis retire seulement le filtre équipe. Les écarts n’ont donc pas tous la même unité : points de pourcentage pour les taux, or pour GD@15 et unité propre pour les moyennes.

## Cinq profils principaux par rôle

| Rôle | Joueur | Matchs | KDA | KP | CS/min | Dégâts/min | GD@15 | Win rate |
|---|---|---:|---:|---:|---:|---:|---:|---:|
{player_rows}

Le profil principal est celui qui possède le plus grand nombre de matchs dans le rôle. Les remplacements restent disponibles dans la vue Joueurs du dashboard.

## Top 10 des priorités de draft

| Champion | Pick rate | Ban rate | Présence | Win rate en pick | Picks |
|---|---:|---:|---:|---:|---:|
{draft_rows}

La présence mesure les picks et bans effectués par {filters["team_name"]}, dédupliqués par partie. Un taux de victoire sur peu de picks doit rester interprété comme un signal exploratoire.

## Limites

- Oracle’s Elixir agrège des compétitions de niveaux différents ; cette étude se limite explicitement à {filters["league"]}.
- Le benchmark n’ajuste pas la force des adversaires, le patch, les changements de roster ou la phase de compétition.
- Les corrélations entre early game, objectifs, draft et victoire ne démontrent pas de causalité.
- Les KPI dont la couverture est incomplète conservent leur dénominateur réel dans l’interface.
""".replace(
        f"{metadata['data_status']['matches']:,}",
        f"{metadata['data_status']['matches']:,}".replace(",", " "),
    ).replace(
        f"{metadata['data_status']['raw_rows']:,}",
        f"{metadata['data_status']['raw_rows']:,}".replace(",", " "),
    )


def _slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-") or "team"


def _snapshot_path(league: str, year: int, team_name: str, team_id: str) -> str:
    suffix = hashlib.sha1(team_id.encode()).hexdigest()[:8]
    return f"overviews/{year}/{_slug(league)}/{_slug(team_name)}-{suffix}.json"


def _match_snapshot_path(league: str, year: int) -> str:
    return f"matches/{year}/{_slug(league)}.json"


def _match_detail(records: GameRecords) -> dict:
    teams = sorted(records.teams, key=lambda item: item["side"])
    enriched_teams = [
        {
            **{key: value for key, value in team.items() if key != "game_id"},
            "reading": team_match_reading(team, teams[1 - index]),
        }
        for index, team in enumerate(teams)
    ]
    match = records.match
    return {
        **match,
        "played_at": match["played_at"].isoformat() if match["played_at"] else None,
        "teams": enriched_teams,
        "players": [
            {key: value for key, value in player.items() if key not in {"game_id", "team_kills"}}
            for player in sorted(records.players, key=lambda item: item["participant_id"])
        ],
        "draft": sorted(
            (
                {key: value for key, value in action.items() if key != "game_id"}
                for action in records.draft
            ),
            key=lambda item: (item["side"], item["action_type"], item["action_slot"]),
        ),
    }


def _overview(
    *,
    league: str,
    year: int,
    team_id: str,
    team_name: str,
    team_rows: list[dict],
    player_rows: list[dict],
    draft_rows: list[dict],
    matches: dict[str, dict],
    benchmark: dict,
) -> dict:
    team = team_aggregate(team_rows, matches)
    team["n_matches"] = team["matches_played"]
    return {
        "filters": {
            "league": league,
            "year": year,
            "team_id": team_id,
            "team_name": team_name,
            "split": None,
            "start_date": None,
            "end_date": None,
        },
        "team_metrics": [metric(spec, team, len(team_rows), benchmark) for spec in TEAM_METRICS],
        "players": player_summaries(player_rows, matches),
        "draft": draft_summaries(draft_rows, team_rows, matches),
        "trends": trends(team_rows, matches),
    }


def build_catalog(
    sources: list[Path],
    selections: tuple[tuple[str, int], ...] = DEFAULT_SELECTIONS,
    teams_per_league: int = 6,
    min_team_matches: int = 30,
    preferred_team_names: tuple[str, ...] = ("T1", "Gen.G", "Karmine Corp"),
) -> tuple[dict, dict[str, dict], dict[str, dict]]:
    all_matches: set[str] = set()
    raw_rows = 0
    rejected_rows = 0
    matches: dict[str, dict] = {}
    selection_set = set(selections)
    league_matches: dict[tuple[str, int], set[str]] = defaultdict(set)
    league_teams: dict[tuple[str, int], list[dict]] = defaultdict(list)
    team_rows: dict[tuple[str, int], dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    player_rows: dict[tuple[str, int], dict[str, list[dict]]] = defaultdict(
        lambda: defaultdict(list)
    )
    draft_rows: dict[tuple[str, int], dict[str, list[dict]]] = defaultdict(
        lambda: defaultdict(list)
    )
    team_names: dict[tuple[str, int], dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(int))
    )
    splits: dict[tuple[str, int], set[str]] = defaultdict(set)
    league_games: dict[tuple[str, int], dict[str, GameRecords]] = defaultdict(dict)

    for source in sources:
        for game_id, rows in iter_grouped_games(source):
            raw_rows += len(rows)
            try:
                records = transform_game(game_id, rows)
            except InvalidSourceError:
                rejected_rows += len(rows)
                continue
            all_matches.add(game_id)
            key = (records.match["league"], records.match["year"])
            if key not in selection_set:
                continue
            matches[game_id] = records.match
            league_games[key][game_id] = records
            league_matches[key].add(game_id)
            if records.match["split"]:
                splits[key].add(records.match["split"])
            league_teams[key].extend(records.teams)
            for team in records.teams:
                team_id = team["team_id"]
                team_rows[key][team_id].append(team)
                team_names[key][team_id][team["team_name"]] += 1
            for player in records.players:
                player_rows[key][player["team_id"]].append(player)
            for action in records.draft:
                draft_rows[key][action["team_id"]].append(action)

    overviews: dict[str, dict] = {}
    metadata_teams: list[dict] = []
    for league, year in selections:
        key = (league, year)
        if not league_matches[key]:
            continue
        benchmark = team_aggregate(league_teams[key], matches)
        benchmark["n_matches"] = benchmark["matches_played"]
        ranked = sorted(
            (
                (
                    team_id,
                    max(names, key=lambda name: (names[name], name)),
                    len(rows),
                )
                for team_id, rows in team_rows[key].items()
                if len(rows) >= min_team_matches
                for names in (team_names[key][team_id],)
            ),
            key=lambda item: (-item[2], item[1]),
        )
        preferred = [item for name in preferred_team_names for item in ranked if item[1] == name]
        selected: list[tuple[str, str, int]] = []
        for item in [*preferred, *ranked]:
            if item[0] not in {current[0] for current in selected}:
                selected.append(item)
            if len(selected) >= teams_per_league:
                break
        for team_id, team_name, team_matches in selected:
            snapshot = _snapshot_path(league, year, team_name, team_id)
            overviews[snapshot] = _overview(
                league=league,
                year=year,
                team_id=team_id,
                team_name=team_name,
                team_rows=team_rows[key][team_id],
                player_rows=player_rows[key][team_id],
                draft_rows=draft_rows[key][team_id],
                matches=matches,
                benchmark=benchmark,
            )
            metadata_teams.append(
                {
                    "team_id": team_id,
                    "team_name": team_name,
                    "league": league,
                    "year": year,
                    "matches": team_matches,
                    "snapshot": snapshot,
                }
            )

    if not metadata_teams:
        raise SystemExit("No accepted teams found for the requested demo selections")

    primary = next(
        (team for team in metadata_teams if team["team_name"] == preferred_team_names[0]),
        metadata_teams[0],
    )
    comparison = next(
        (
            team
            for team in metadata_teams
            if team["league"] == primary["league"]
            and team["year"] == primary["year"]
            and team["team_name"] == preferred_team_names[1]
        ),
        next(
            team
            for team in metadata_teams
            if team["league"] == primary["league"]
            and team["year"] == primary["year"]
            and team["team_id"] != primary["team_id"]
        ),
    )
    published_teams: dict[tuple[str, int], set[str]] = defaultdict(set)
    for team in metadata_teams:
        published_teams[(team["league"], team["year"])].add(team["team_id"])
    match_bundles = {
        _match_snapshot_path(league, year): {
            "league": league,
            "year": year,
            "matches": [
                _match_detail(records)
                for records in sorted(
                    (
                        records
                        for records in league_games[(league, year)].values()
                        if any(
                            team["team_id"] in published_teams[(league, year)]
                            for team in records.teams
                        )
                    ),
                    key=lambda item: (
                        item.match["played_at"] is not None,
                        item.match["played_at"],
                        item.match["game_id"],
                    ),
                    reverse=True,
                )
            ],
        }
        for league, year in selections
        if league_games[(league, year)]
    }
    metadata = {
        "data_status": {
            "matches": len(all_matches),
            "raw_rows": raw_rows,
            "source_files": len(sources),
            "rejected_rows": rejected_rows,
            "last_imported_at": None,
        },
        "leagues": [
            {
                "league": league,
                "year": year,
                "matches": len(league_matches[(league, year)]),
                "match_snapshot": _match_snapshot_path(league, year),
            }
            for league, year in selections
            if league_matches[(league, year)]
        ],
        "splits": [
            {"league": league, "year": year, "split": split}
            for league, year in selections
            for split in sorted(splits[(league, year)])
        ],
        "teams": metadata_teams,
        "default_selection": {
            "league": primary["league"],
            "year": primary["year"],
            "team_id": primary["team_id"],
            "comparison_team_id": comparison["team_id"],
        },
    }
    return metadata, overviews, match_bundles


def _parse_selection(value: str) -> tuple[str, int]:
    try:
        league, year = value.rsplit(":", 1)
        return league, int(year)
    except ValueError as error:
        raise argparse.ArgumentTypeError("selection must use LEAGUE:YEAR") from error


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the static multi-team portfolio demo")
    parser.add_argument("sources", nargs="+", type=Path)
    parser.add_argument("--selection", action="append", type=_parse_selection)
    parser.add_argument("--teams-per-league", type=int, default=6)
    parser.add_argument("--min-team-matches", type=int, default=30)
    parser.add_argument("--primary-team", default="T1")
    parser.add_argument("--comparison-team", default="Gen.G")
    parser.add_argument("--secondary-case-study-team", default="Karmine Corp")
    parser.add_argument("--demo-dir", type=Path, default=Path("apps/web/public/demo"))
    parser.add_argument("--case-study", type=Path, default=Path("docs/case-study-t1-2025.md"))
    parser.add_argument(
        "--secondary-case-study",
        type=Path,
        default=Path("docs/case-study-karmine-corp-2025.md"),
    )
    args = parser.parse_args()
    selections = tuple(args.selection) if args.selection else DEFAULT_SELECTIONS
    preferred = (
        args.primary_team,
        args.comparison_team,
        args.secondary_case_study_team,
    )
    metadata, overviews, match_bundles = build_catalog(
        args.sources,
        selections=selections,
        teams_per_league=args.teams_per_league,
        min_team_matches=args.min_team_matches,
        preferred_team_names=preferred,
    )
    args.demo_dir.mkdir(parents=True, exist_ok=True)
    args.case_study.parent.mkdir(parents=True, exist_ok=True)
    overview_dir = args.demo_dir / "overviews"
    if overview_dir.exists():
        shutil.rmtree(overview_dir)
    match_dir = args.demo_dir / "matches"
    if match_dir.exists():
        shutil.rmtree(match_dir)
    (args.demo_dir / "metadata.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    for relative_path, overview in overviews.items():
        destination = args.demo_dir / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(
            json.dumps(overview, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    for relative_path, bundle in match_bundles.items():
        destination = args.demo_dir / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(
            json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
    primary = next(
        overview
        for overview in overviews.values()
        if overview["filters"]["team_id"] == metadata["default_selection"]["team_id"]
    )
    (args.demo_dir / "overview.json").write_text(
        json.dumps(primary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    args.case_study.write_text(case_study(primary, metadata, args.sources), encoding="utf-8")
    secondary = next(
        (
            overview
            for overview in overviews.values()
            if overview["filters"]["team_name"] == args.secondary_case_study_team
        ),
        None,
    )
    if secondary is None:
        raise SystemExit(
            f"No snapshot found for secondary case study team {args.secondary_case_study_team}"
        )
    args.secondary_case_study.parent.mkdir(parents=True, exist_ok=True)
    args.secondary_case_study.write_text(
        case_study(secondary, metadata, args.sources), encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "metadata": str(args.demo_dir / "metadata.json"),
                "overviews": len(overviews),
                "match_bundles": len(match_bundles),
                "case_study": str(args.case_study),
                "secondary_case_study": str(args.secondary_case_study),
                "matches": metadata["data_status"]["matches"],
                "leagues": len(metadata["leagues"]),
                "teams": len(metadata["teams"]),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
