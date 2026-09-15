# ruff: noqa: E501
import argparse
import json
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path
from statistics import fmean

from app.ingestion.oracle_elixir import (
    InvalidSourceError,
    file_sha256,
    iter_grouped_games,
    transform_game,
)
from app.services.analytics import DRAFT_METRICS, PLAYER_METRICS, TEAM_METRICS


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

- Oracle’s Elixir agrège des compétitions de niveaux différents ; cette étude se limite explicitement à la LCK.
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


def build(args) -> tuple[dict, dict]:
    all_matches: set[str] = set()
    raw_rows = 0
    rejected_rows = 0
    matches: dict[str, dict] = {}
    league_teams: list[dict] = []
    target_teams: list[dict] = []
    target_players: list[dict] = []
    target_draft: list[dict] = []
    league_matches: set[str] = set()
    splits: set[str] = set()
    target_ids: Counter[str] = Counter()

    for source in args.sources:
        for game_id, rows in iter_grouped_games(source):
            raw_rows += len(rows)
            try:
                records = transform_game(game_id, rows)
            except InvalidSourceError:
                rejected_rows += len(rows)
                continue
            all_matches.add(game_id)
            if records.match["league"] != args.league or records.match["year"] != args.year:
                continue
            matches[game_id] = records.match
            league_matches.add(game_id)
            if records.match["split"]:
                splits.add(records.match["split"])
            league_teams.extend(records.teams)
            selected = [team for team in records.teams if team["team_name"] == args.team_name]
            if not selected:
                continue
            target_teams.extend(selected)
            target_ids.update(team["team_id"] for team in selected)
            target_players.extend(
                player for player in records.players if player["team_name"] == args.team_name
            )
            target_draft.extend(
                action for action in records.draft if action["team_name"] == args.team_name
            )
    if not target_teams:
        raise SystemExit(
            f"No accepted matches found for {args.team_name} in {args.league} {args.year}"
        )

    team_id = target_ids.most_common(1)[0][0]
    team = team_aggregate(target_teams, matches)
    benchmark = team_aggregate(league_teams, matches)
    team["n_matches"] = team["matches_played"]
    benchmark["n_matches"] = benchmark["matches_played"]
    overview = {
        "filters": {
            "league": args.league,
            "year": args.year,
            "team_id": team_id,
            "team_name": args.team_name,
            "split": None,
            "start_date": None,
            "end_date": None,
        },
        "team_metrics": [metric(spec, team, len(target_teams), benchmark) for spec in TEAM_METRICS],
        "players": player_summaries(target_players, matches),
        "draft": draft_summaries(target_draft, target_teams, matches),
        "trends": trends(target_teams, matches),
    }
    metadata = {
        "data_status": {
            "matches": len(all_matches),
            "raw_rows": raw_rows,
            "source_files": len(args.sources),
            "rejected_rows": rejected_rows,
            "last_imported_at": None,
        },
        "leagues": [{"league": args.league, "year": args.year, "matches": len(league_matches)}],
        "splits": [
            {"league": args.league, "year": args.year, "split": split} for split in sorted(splits)
        ],
        "teams": [
            {
                "team_id": team_id,
                "team_name": args.team_name,
                "league": args.league,
                "year": args.year,
                "matches": len(target_teams),
            }
        ],
    }
    return metadata, overview


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the static portfolio demo and case study")
    parser.add_argument("sources", nargs="+", type=Path)
    parser.add_argument("--league", default="LCK")
    parser.add_argument("--year", type=int, default=2025)
    parser.add_argument("--team-name", default="T1")
    parser.add_argument("--demo-dir", type=Path, default=Path("apps/web/public/demo"))
    parser.add_argument("--case-study", type=Path, default=Path("docs/case-study-t1-2025.md"))
    args = parser.parse_args()
    metadata, overview = build(args)
    args.demo_dir.mkdir(parents=True, exist_ok=True)
    args.case_study.parent.mkdir(parents=True, exist_ok=True)
    (args.demo_dir / "metadata.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (args.demo_dir / "overview.json").write_text(
        json.dumps(overview, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    args.case_study.write_text(case_study(overview, metadata, args.sources), encoding="utf-8")
    print(
        json.dumps(
            {
                "metadata": str(args.demo_dir / "metadata.json"),
                "overview": str(args.demo_dir / "overview.json"),
                "case_study": str(args.case_study),
                "matches": metadata["data_status"]["matches"],
                "team_matches": overview["team_metrics"][0]["sample_size"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
