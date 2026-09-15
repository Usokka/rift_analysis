import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

from app.ingestion.oracle_elixir import InvalidSourceError, iter_grouped_games, transform_game
from app.services.analytics import DRAFT_METRICS, PLAYER_METRICS, TEAM_METRICS


def inspect_file(path: Path) -> tuple[dict, set[str]]:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    game_ids: set[str] = set()
    accepted = 0
    rejected = 0
    rows = 0
    leagues: set[str] = set()
    years: set[int] = set()
    completeness: dict[str, int] = {}
    for game_id, numbered_rows in iter_grouped_games(path):
        rows += len(numbered_rows)
        game_ids.add(game_id)
        for _, row in numbered_rows:
            if row.get("league"):
                leagues.add(row["league"])
            if (row.get("year") or "").isdigit():
                years.add(int(row["year"]))
            key = row.get("datacompleteness") or "missing"
            completeness[key] = completeness.get(key, 0) + 1
        try:
            transform_game(game_id, numbered_rows)
        except InvalidSourceError:
            rejected += 1
        else:
            accepted += 1
    return (
        {
            "filename": path.name,
            "sha256": digest,
            "size_bytes": path.stat().st_size,
            "rows": rows,
            "distinct_games": len(game_ids),
            "accepted_games": accepted,
            "rejected_games": rejected,
            "years": sorted(years),
            "league_count": len(leagues),
            "completeness_rows": dict(sorted(completeness.items())),
        },
        game_ids,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build a reproducible Oracle's Elixir volume report"
    )
    parser.add_argument("sources", nargs="+", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    files = []
    all_games: set[str] = set()
    duplicate_games = 0
    for source in args.sources:
        report, games = inspect_file(source)
        duplicate_games += len(all_games & games)
        all_games |= games
        files.append(report)
    payload = {
        "generated_at": datetime.now(UTC).isoformat(),
        "source": "Oracle's Elixir match data exports",
        "source_page": "https://oracleselixir.com/gamedata/downloads",
        "files": files,
        "totals": {
            "rows": sum(item["rows"] for item in files),
            "distinct_games": len(all_games),
            "accepted_games": sum(item["accepted_games"] for item in files) - duplicate_games,
            "rejected_games": sum(item["rejected_games"] for item in files),
            "duplicates_between_files": duplicate_games,
            "implemented_kpi_contracts": len(TEAM_METRICS)
            + len(PLAYER_METRICS)
            + len(DRAFT_METRICS),
        },
        "counting_rule": (
            "Distinct non-empty gameid after structural validation; player/team rows are not games."
        ),
    }
    rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered, end="")


if __name__ == "__main__":
    main()
