import csv
import os
from contextlib import contextmanager
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, func, select

from app.core.models import (
    DraftAction,
    Match,
    OracleElixirRow,
    PipelineRun,
    PlayerMatchStat,
    SourceFile,
    TeamMatchStat,
)
from app.ingestion.oracle_elixir import (
    InvalidSourceError,
    ingest_file,
    iter_grouped_games,
    transform_game,
)
from app.repositories.analytics import AnalyticsFilters, AnalyticsRepository
from app.services.analytics import DRAFT_METRICS, PLAYER_METRICS, TEAM_METRICS, AnalyticsService

ROOT = Path(__file__).resolve().parents[3]
SAMPLE = ROOT / "data/fixtures/oracle_elixir_sample.csv"


def test_sample_matches_real_oracle_elixir_contract():
    groups = list(iter_grouped_games(SAMPLE))
    assert len(groups) == 4
    game_id, rows = groups[0]
    transformed = transform_game(game_id, rows)
    assert len(rows) == 12
    assert len(transformed.teams) == 2
    assert len(transformed.players) == 10
    assert len([item for item in transformed.draft if item["action_type"] == "PICK"]) == 10
    assert {team["result"] for team in transformed.teams} == {0, 1}
    assert {player["role"] for player in transformed.players} == {
        "TOP",
        "JUNGLE",
        "MID",
        "ADC",
        "SUPPORT",
    }


def test_missing_source_columns_are_reported(tmp_path):
    source = tmp_path / "invalid.csv"
    with source.open("w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=["gameid"])
        writer.writeheader()
        writer.writerow({"gameid": "game-1"})
    with pytest.raises(InvalidSourceError, match="required columns missing"):
        list(iter_grouped_games(source))


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="PostgreSQL integration opt-in")
def test_idempotent_ingestion_and_analytics():
    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    try:
        with engine.connect() as connection, connection.begin():
            config = Config(str(ROOT / "alembic.ini"))
            config.attributes["connection"] = connection
            command.upgrade(config, "head")

            class TransactionFactory:
                @contextmanager
                def begin(self):
                    with connection.begin_nested():
                        yield connection

            factory = TransactionFactory()
            first = ingest_file(factory, SAMPLE, "fixture://oracle-elixir", batch_games=2)
            second = ingest_file(factory, SAMPLE, "fixture://oracle-elixir", batch_games=2)
            assert first.status == "SUCCEEDED"
            assert first.rows_read == 48
            assert first.rows_inserted == 48
            assert first.games_loaded == 4
            assert second.status == "SKIPPED"

            expected_counts = {
                SourceFile: 1,
                PipelineRun: 2,
                OracleElixirRow: 48,
                Match: 4,
                TeamMatchStat: 8,
                PlayerMatchStat: 40,
            }
            for model, expected in expected_counts.items():
                assert connection.scalar(select(func.count()).select_from(model)) == expected
            assert connection.scalar(select(func.count()).select_from(DraftAction)) >= 40

            repository = AnalyticsRepository(connection)
            metadata = repository.metadata()
            team = metadata["teams"][0]
            overview = AnalyticsService(repository).overview(
                AnalyticsFilters(league=team["league"], year=team["year"], team_id=team["team_id"])
            )
            assert overview is not None
            assert len(overview.team_metrics) == len(TEAM_METRICS) == 15
            assert overview.players
            assert all(
                len(player.metrics) == len(PLAYER_METRICS) == 9 for player in overview.players
            )
            assert overview.draft
            assert all(
                len(champion.metrics) == len(DRAFT_METRICS) == 4 for champion in overview.draft
            )
            assert len(TEAM_METRICS) + len(PLAYER_METRICS) + len(DRAFT_METRICS) == 28
    finally:
        engine.dispose()
