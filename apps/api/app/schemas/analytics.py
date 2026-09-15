from datetime import date, datetime

from pydantic import BaseModel, Field


class Metric(BaseModel):
    id: str
    label: str
    value: float | None
    unit: str
    sample_size: int
    eligible_sample_size: int
    benchmark: float | None = None
    delta: float | None = None


class LeagueOption(BaseModel):
    league: str
    year: int
    matches: int


class SplitOption(BaseModel):
    league: str
    year: int
    split: str


class TeamOption(BaseModel):
    team_id: str
    team_name: str
    league: str
    year: int
    matches: int


class DataStatus(BaseModel):
    matches: int
    raw_rows: int
    source_files: int
    rejected_rows: int
    last_imported_at: datetime | None


class MetadataResponse(BaseModel):
    data_status: DataStatus
    leagues: list[LeagueOption]
    splits: list[SplitOption]
    teams: list[TeamOption]


class PlayerSummary(BaseModel):
    player_id: str
    player_name: str
    role: str
    metrics: list[Metric]


class DraftChampionSummary(BaseModel):
    champion: str
    metrics: list[Metric]


class TrendPoint(BaseModel):
    week: date
    matches: int
    win_rate: float | None
    gold_diff_at_15: float | None
    kills_per_game: float | None


class AppliedFilters(BaseModel):
    league: str
    year: int
    team_id: str
    team_name: str
    split: str | None
    start_date: date | None
    end_date: date | None


class OverviewResponse(BaseModel):
    filters: AppliedFilters
    team_metrics: list[Metric] = Field(min_length=15, max_length=15)
    players: list[PlayerSummary]
    draft: list[DraftChampionSummary]
    trends: list[TrendPoint]
