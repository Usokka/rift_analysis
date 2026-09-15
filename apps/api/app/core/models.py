from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Identity,
    Index,
    Integer,
    MetaData,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


class SourceFile(Base):
    __tablename__ = "source_files"
    __table_args__ = (
        UniqueConstraint("sha256"),
        {"schema": "raw"},
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    source_uri: Mapped[str | None] = mapped_column(Text)
    sha256: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    game_count: Mapped[int] = mapped_column(Integer, default=0)


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED')",
            name="status_allowed",
        ),
        {"schema": "raw"},
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    job_name: Mapped[str] = mapped_column(String(100))
    source_file: Mapped[str] = mapped_column(String(255))
    source_sha256: Mapped[str] = mapped_column(String(64), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16))
    rows_read: Mapped[int] = mapped_column(Integer, default=0)
    rows_inserted: Mapped[int] = mapped_column(Integer, default=0)
    rows_rejected: Mapped[int] = mapped_column(Integer, default=0)
    games_loaded: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)


class OracleElixirRow(Base):
    __tablename__ = "oracle_elixir_rows"
    __table_args__ = (
        UniqueConstraint("source_file_id", "row_number"),
        Index("ix_oracle_elixir_rows_gameid", "game_id"),
        {"schema": "raw"},
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    source_file_id: Mapped[int] = mapped_column(
        ForeignKey("raw.source_files.id", ondelete="CASCADE")
    )
    row_number: Mapped[int] = mapped_column(Integer)
    game_id: Mapped[str] = mapped_column(String(100))
    row_hash: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSONB)


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = ({"schema": "analytics"},)

    game_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    source_file_id: Mapped[int] = mapped_column(ForeignKey("raw.source_files.id"), index=True)
    league: Mapped[str] = mapped_column(String(80), index=True)
    year: Mapped[int] = mapped_column(Integer, index=True)
    split: Mapped[str | None] = mapped_column(String(80), index=True)
    playoffs: Mapped[bool | None] = mapped_column(Boolean)
    played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    game_number: Mapped[int | None] = mapped_column(Integer)
    patch: Mapped[str | None] = mapped_column(String(20), index=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    data_completeness: Mapped[str | None] = mapped_column(String(20))
    quality_status: Mapped[str] = mapped_column(String(20), index=True)


class TeamMatchStat(Base):
    __tablename__ = "team_match_stats"
    __table_args__ = (
        CheckConstraint("side IN ('BLUE', 'RED')", name="side_allowed"),
        CheckConstraint("result IN (0, 1)", name="result_allowed"),
        UniqueConstraint("game_id", "side"),
        Index("ix_team_match_stats_team_game", "team_id", "game_id"),
        {"schema": "analytics"},
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    game_id: Mapped[str] = mapped_column(
        ForeignKey("analytics.matches.game_id", ondelete="CASCADE"), index=True
    )
    team_id: Mapped[str] = mapped_column(String(100), index=True)
    team_name: Mapped[str] = mapped_column(String(255), index=True)
    side: Mapped[str] = mapped_column(String(4))
    result: Mapped[int] = mapped_column(Integer)
    kills: Mapped[int | None] = mapped_column(Integer)
    deaths: Mapped[int | None] = mapped_column(Integer)
    assists: Mapped[int | None] = mapped_column(Integer)
    gold_diff_at_15: Mapped[float | None] = mapped_column(Float)
    first_blood: Mapped[bool | None] = mapped_column(Boolean)
    first_tower: Mapped[bool | None] = mapped_column(Boolean)
    first_dragon: Mapped[bool | None] = mapped_column(Boolean)
    first_herald: Mapped[bool | None] = mapped_column(Boolean)
    first_baron: Mapped[bool | None] = mapped_column(Boolean)
    dragons: Mapped[int | None] = mapped_column(Integer)
    heralds: Mapped[int | None] = mapped_column(Integer)
    barons: Mapped[int | None] = mapped_column(Integer)
    towers: Mapped[int | None] = mapped_column(Integer)


class PlayerMatchStat(Base):
    __tablename__ = "player_match_stats"
    __table_args__ = (
        CheckConstraint("side IN ('BLUE', 'RED')", name="side_allowed"),
        CheckConstraint("role IN ('TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT')", name="role_allowed"),
        UniqueConstraint("game_id", "participant_id"),
        Index("ix_player_match_stats_player_game", "player_id", "game_id"),
        Index("ix_player_match_stats_team_role", "team_id", "role"),
        {"schema": "analytics"},
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    game_id: Mapped[str] = mapped_column(
        ForeignKey("analytics.matches.game_id", ondelete="CASCADE"), index=True
    )
    participant_id: Mapped[int] = mapped_column(Integer)
    player_id: Mapped[str] = mapped_column(String(100), index=True)
    player_name: Mapped[str] = mapped_column(String(255), index=True)
    team_id: Mapped[str] = mapped_column(String(100), index=True)
    team_name: Mapped[str] = mapped_column(String(255))
    side: Mapped[str] = mapped_column(String(4))
    role: Mapped[str] = mapped_column(String(10), index=True)
    champion: Mapped[str] = mapped_column(String(80), index=True)
    result: Mapped[int] = mapped_column(Integer)
    kills: Mapped[int | None] = mapped_column(Integer)
    deaths: Mapped[int | None] = mapped_column(Integer)
    assists: Mapped[int | None] = mapped_column(Integer)
    team_kills: Mapped[int | None] = mapped_column(Integer)
    total_cs: Mapped[float | None] = mapped_column(Float)
    total_gold: Mapped[float | None] = mapped_column(Float)
    damage_to_champions: Mapped[float | None] = mapped_column(Float)
    vision_score: Mapped[float | None] = mapped_column(Float)
    gold_diff_at_15: Mapped[float | None] = mapped_column(Float)


class DraftAction(Base):
    __tablename__ = "draft_actions"
    __table_args__ = (
        CheckConstraint("side IN ('BLUE', 'RED')", name="side_allowed"),
        CheckConstraint("action_type IN ('PICK', 'BAN')", name="action_type_allowed"),
        UniqueConstraint("game_id", "side", "action_type", "action_slot"),
        Index("ix_draft_actions_champion_type", "champion", "action_type"),
        Index("ix_draft_actions_team_type", "team_id", "action_type"),
        {"schema": "analytics"},
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    game_id: Mapped[str] = mapped_column(
        ForeignKey("analytics.matches.game_id", ondelete="CASCADE"), index=True
    )
    team_id: Mapped[str] = mapped_column(String(100), index=True)
    team_name: Mapped[str] = mapped_column(String(255))
    side: Mapped[str] = mapped_column(String(4))
    action_type: Mapped[str] = mapped_column(String(4))
    action_slot: Mapped[int] = mapped_column(Integer)
    champion: Mapped[str] = mapped_column(String(80), index=True)
    role: Mapped[str | None] = mapped_column(String(10))
