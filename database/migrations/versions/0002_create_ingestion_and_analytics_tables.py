"""Create raw ingestion and analytical match tables.

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "source_files",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("source_uri", sa.Text(), nullable=True),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("game_count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_source_files")),
        sa.UniqueConstraint("sha256", name=op.f("uq_source_files_sha256")),
        schema="raw",
    )
    op.create_table(
        "pipeline_runs",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("job_name", sa.String(100), nullable=False),
        sa.Column("source_file", sa.String(255), nullable=False),
        sa.Column("source_sha256", sa.String(64), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("rows_read", sa.Integer(), nullable=False),
        sa.Column("rows_inserted", sa.Integer(), nullable=False),
        sa.Column("rows_rejected", sa.Integer(), nullable=False),
        sa.Column("games_loaded", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED')",
            name=op.f("ck_pipeline_runs_status_allowed"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pipeline_runs")),
        schema="raw",
    )
    op.create_index(
        op.f("ix_pipeline_runs_source_sha256"),
        "pipeline_runs",
        ["source_sha256"],
        schema="raw",
    )
    op.create_table(
        "oracle_elixir_rows",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("source_file_id", sa.BigInteger(), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.String(100), nullable=False),
        sa.Column("row_hash", sa.String(64), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(
            ["source_file_id"],
            ["raw.source_files.id"],
            name=op.f("fk_oracle_elixir_rows_source_file_id_source_files"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_oracle_elixir_rows")),
        sa.UniqueConstraint(
            "source_file_id",
            "row_number",
            name=op.f("uq_oracle_elixir_rows_source_file_id"),
        ),
        schema="raw",
    )
    op.create_index(
        "ix_oracle_elixir_rows_gameid",
        "oracle_elixir_rows",
        ["game_id"],
        schema="raw",
    )
    op.create_index(
        op.f("ix_oracle_elixir_rows_row_hash"),
        "oracle_elixir_rows",
        ["row_hash"],
        schema="raw",
    )
    op.create_table(
        "matches",
        sa.Column("game_id", sa.String(100), nullable=False),
        sa.Column("source_file_id", sa.BigInteger(), nullable=False),
        sa.Column("league", sa.String(80), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("split", sa.String(80), nullable=True),
        sa.Column("playoffs", sa.Boolean(), nullable=True),
        sa.Column("played_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("game_number", sa.Integer(), nullable=True),
        sa.Column("patch", sa.String(20), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("data_completeness", sa.String(20), nullable=True),
        sa.Column("quality_status", sa.String(20), nullable=False),
        sa.ForeignKeyConstraint(
            ["source_file_id"],
            ["raw.source_files.id"],
            name=op.f("fk_matches_source_file_id_source_files"),
        ),
        sa.PrimaryKeyConstraint("game_id", name=op.f("pk_matches")),
        schema="analytics",
    )
    for name, columns in (
        (op.f("ix_matches_source_file_id"), ["source_file_id"]),
        (op.f("ix_matches_league"), ["league"]),
        (op.f("ix_matches_year"), ["year"]),
        (op.f("ix_matches_split"), ["split"]),
        (op.f("ix_matches_played_at"), ["played_at"]),
        (op.f("ix_matches_patch"), ["patch"]),
        (op.f("ix_matches_quality_status"), ["quality_status"]),
    ):
        op.create_index(name, "matches", columns, schema="analytics")
    op.create_table(
        "team_match_stats",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("game_id", sa.String(100), nullable=False),
        sa.Column("team_id", sa.String(100), nullable=False),
        sa.Column("team_name", sa.String(255), nullable=False),
        sa.Column("side", sa.String(4), nullable=False),
        sa.Column("result", sa.Integer(), nullable=False),
        sa.Column("kills", sa.Integer(), nullable=True),
        sa.Column("deaths", sa.Integer(), nullable=True),
        sa.Column("assists", sa.Integer(), nullable=True),
        sa.Column("gold_diff_at_15", sa.Float(), nullable=True),
        sa.Column("first_blood", sa.Boolean(), nullable=True),
        sa.Column("first_tower", sa.Boolean(), nullable=True),
        sa.Column("first_dragon", sa.Boolean(), nullable=True),
        sa.Column("first_herald", sa.Boolean(), nullable=True),
        sa.Column("first_baron", sa.Boolean(), nullable=True),
        sa.Column("dragons", sa.Integer(), nullable=True),
        sa.Column("heralds", sa.Integer(), nullable=True),
        sa.Column("barons", sa.Integer(), nullable=True),
        sa.Column("towers", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "side IN ('BLUE', 'RED')", name=op.f("ck_team_match_stats_side_allowed")
        ),
        sa.CheckConstraint("result IN (0, 1)", name=op.f("ck_team_match_stats_result_allowed")),
        sa.ForeignKeyConstraint(
            ["game_id"],
            ["analytics.matches.game_id"],
            name=op.f("fk_team_match_stats_game_id_matches"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_team_match_stats")),
        sa.UniqueConstraint("game_id", "side", name=op.f("uq_team_match_stats_game_id")),
        schema="analytics",
    )
    op.create_index(
        op.f("ix_team_match_stats_game_id"), "team_match_stats", ["game_id"], schema="analytics"
    )
    op.create_index(
        op.f("ix_team_match_stats_team_id"), "team_match_stats", ["team_id"], schema="analytics"
    )
    op.create_index(
        op.f("ix_team_match_stats_team_name"),
        "team_match_stats",
        ["team_name"],
        schema="analytics",
    )
    op.create_index(
        "ix_team_match_stats_team_game",
        "team_match_stats",
        ["team_id", "game_id"],
        schema="analytics",
    )
    op.create_table(
        "player_match_stats",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("game_id", sa.String(100), nullable=False),
        sa.Column("participant_id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.String(100), nullable=False),
        sa.Column("player_name", sa.String(255), nullable=False),
        sa.Column("team_id", sa.String(100), nullable=False),
        sa.Column("team_name", sa.String(255), nullable=False),
        sa.Column("side", sa.String(4), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("champion", sa.String(80), nullable=False),
        sa.Column("result", sa.Integer(), nullable=False),
        sa.Column("kills", sa.Integer(), nullable=True),
        sa.Column("deaths", sa.Integer(), nullable=True),
        sa.Column("assists", sa.Integer(), nullable=True),
        sa.Column("team_kills", sa.Integer(), nullable=True),
        sa.Column("total_cs", sa.Float(), nullable=True),
        sa.Column("total_gold", sa.Float(), nullable=True),
        sa.Column("damage_to_champions", sa.Float(), nullable=True),
        sa.Column("vision_score", sa.Float(), nullable=True),
        sa.Column("gold_diff_at_15", sa.Float(), nullable=True),
        sa.CheckConstraint(
            "side IN ('BLUE', 'RED')", name=op.f("ck_player_match_stats_side_allowed")
        ),
        sa.CheckConstraint(
            "role IN ('TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT')",
            name=op.f("ck_player_match_stats_role_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["game_id"],
            ["analytics.matches.game_id"],
            name=op.f("fk_player_match_stats_game_id_matches"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_player_match_stats")),
        sa.UniqueConstraint(
            "game_id", "participant_id", name=op.f("uq_player_match_stats_game_id")
        ),
        schema="analytics",
    )
    for name, columns in (
        (op.f("ix_player_match_stats_game_id"), ["game_id"]),
        (op.f("ix_player_match_stats_player_id"), ["player_id"]),
        (op.f("ix_player_match_stats_player_name"), ["player_name"]),
        (op.f("ix_player_match_stats_team_id"), ["team_id"]),
        (op.f("ix_player_match_stats_role"), ["role"]),
        (op.f("ix_player_match_stats_champion"), ["champion"]),
        ("ix_player_match_stats_player_game", ["player_id", "game_id"]),
        ("ix_player_match_stats_team_role", ["team_id", "role"]),
    ):
        op.create_index(name, "player_match_stats", columns, schema="analytics")
    op.create_table(
        "draft_actions",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("game_id", sa.String(100), nullable=False),
        sa.Column("team_id", sa.String(100), nullable=False),
        sa.Column("team_name", sa.String(255), nullable=False),
        sa.Column("side", sa.String(4), nullable=False),
        sa.Column("action_type", sa.String(4), nullable=False),
        sa.Column("action_slot", sa.Integer(), nullable=False),
        sa.Column("champion", sa.String(80), nullable=False),
        sa.Column("role", sa.String(10), nullable=True),
        sa.CheckConstraint("side IN ('BLUE', 'RED')", name=op.f("ck_draft_actions_side_allowed")),
        sa.CheckConstraint(
            "action_type IN ('PICK', 'BAN')",
            name=op.f("ck_draft_actions_action_type_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["game_id"],
            ["analytics.matches.game_id"],
            name=op.f("fk_draft_actions_game_id_matches"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_draft_actions")),
        sa.UniqueConstraint(
            "game_id",
            "side",
            "action_type",
            "action_slot",
            name=op.f("uq_draft_actions_game_id"),
        ),
        schema="analytics",
    )
    for name, columns in (
        (op.f("ix_draft_actions_game_id"), ["game_id"]),
        (op.f("ix_draft_actions_team_id"), ["team_id"]),
        (op.f("ix_draft_actions_champion"), ["champion"]),
        ("ix_draft_actions_champion_type", ["champion", "action_type"]),
        ("ix_draft_actions_team_type", ["team_id", "action_type"]),
    ):
        op.create_index(name, "draft_actions", columns, schema="analytics")


def downgrade() -> None:
    for table in ("draft_actions", "player_match_stats", "team_match_stats", "matches"):
        op.drop_table(table, schema="analytics")
    for table in ("oracle_elixir_rows", "pipeline_runs", "source_files"):
        op.drop_table(table, schema="raw")
