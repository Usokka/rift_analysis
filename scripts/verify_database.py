import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import func, select

from app.core.database import get_engine
from app.core.models import Match, OracleElixirRow, PipelineRun, SourceFile
from app.repositories.analytics import AnalyticsFilters, AnalyticsRepository
from app.services.analytics import DRAFT_METRICS, PLAYER_METRICS, TEAM_METRICS, AnalyticsService


def build_proof(minimum_matches: int, minimum_kpis: int) -> dict:
    with get_engine().connect() as connection:
        source_files = [dict(row) for row in connection.execute(select(SourceFile)).mappings()]
        matches = connection.scalar(select(func.count()).select_from(Match)) or 0
        raw_rows = connection.scalar(select(func.count()).select_from(OracleElixirRow)) or 0
        rejected_rows = connection.scalar(
            select(func.coalesce(func.sum(PipelineRun.rows_rejected), 0)).where(
                PipelineRun.status == "SUCCEEDED"
            )
        )
        kpi_ids = [item[0] for item in (*TEAM_METRICS, *PLAYER_METRICS, *DRAFT_METRICS)]
        repository = AnalyticsRepository(connection)
        metadata = repository.metadata()
        if not metadata["teams"]:
            raise RuntimeError("no team is available for an analytical smoke test")
        selected = metadata["teams"][0]
        overview = AnalyticsService(repository).overview(
            AnalyticsFilters(
                league=selected["league"],
                year=selected["year"],
                team_id=selected["team_id"],
            )
        )
        if overview is None:
            raise RuntimeError("the analytical smoke-test overview is empty")
        if matches < minimum_matches:
            raise RuntimeError(f"expected at least {minimum_matches} matches, got {matches}")
        if len(kpi_ids) < minimum_kpis or len(kpi_ids) != len(set(kpi_ids)):
            raise RuntimeError("the KPI catalogue is too small or contains duplicate identifiers")
        return {
            "generated_at": datetime.now(UTC).isoformat(),
            "database": {
                "raw_rows": int(raw_rows),
                "accepted_matches": int(matches),
                "rejected_rows": int(rejected_rows or 0),
                "source_files": [
                    {
                        "filename": item["filename"],
                        "sha256": item["sha256"],
                        "rows": item["row_count"],
                        "games": item["game_count"],
                    }
                    for item in source_files
                ],
            },
            "analytics": {
                "implemented_kpis": len(kpi_ids),
                "kpi_ids": kpi_ids,
                "smoke_test_team": {
                    "team_name": overview.filters.team_name,
                    "league": overview.filters.league,
                    "year": overview.filters.year,
                    "matches": overview.team_metrics[0].eligible_sample_size,
                    "players": len(overview.players),
                    "draft_champions": len(overview.draft),
                    "trend_weeks": len(overview.trends),
                },
            },
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify the loaded Rift Analyst corpus")
    parser.add_argument("--minimum-matches", type=int, default=18_000)
    parser.add_argument("--minimum-kpis", type=int, default=25)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    proof = build_proof(args.minimum_matches, args.minimum_kpis)
    rendered = json.dumps(proof, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered, end="")


if __name__ == "__main__":
    main()
