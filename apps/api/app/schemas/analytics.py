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
    match_snapshot: str | None = None


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


class MatchSummary(BaseModel):
    game_id: str
    played_at: datetime | None
    split: str | None
    game_number: int | None
    patch: str | None
    duration_seconds: int | None
    team_id: str
    team_name: str
    opponent_id: str
    opponent_name: str
    side: str
    result: int
    kills: int | None
    deaths: int | None
    gold_diff_at_15: float | None


class MatchTeam(BaseModel):
    team_id: str
    team_name: str
    side: str
    result: int
    kills: int | None
    deaths: int | None
    assists: int | None
    gold_diff_at_15: float | None
    first_blood: bool | None
    first_tower: bool | None
    first_dragon: bool | None
    first_herald: bool | None
    first_baron: bool | None
    dragons: int | None
    heralds: int | None
    barons: int | None
    towers: int | None
    reading: str


class MatchPlayer(BaseModel):
    participant_id: int
    player_id: str
    player_name: str
    team_id: str
    team_name: str
    side: str
    role: str
    champion: str
    result: int
    kills: int | None
    deaths: int | None
    assists: int | None
    total_cs: float | None
    total_gold: float | None
    damage_to_champions: float | None
    vision_score: float | None
    gold_diff_at_15: float | None


class MatchDraftAction(BaseModel):
    team_id: str
    team_name: str
    side: str
    action_type: str
    action_slot: int
    champion: str
    role: str | None


class MatchDetail(BaseModel):
    game_id: str
    league: str
    year: int
    split: str | None
    playoffs: bool | None
    played_at: datetime | None
    game_number: int | None
    patch: str | None
    duration_seconds: int | None
    data_completeness: str | None
    quality_status: str
    teams: list[MatchTeam] = Field(min_length=2, max_length=2)
    players: list[MatchPlayer] = Field(min_length=10, max_length=10)
    draft: list[MatchDraftAction]


class MatchListResponse(BaseModel):
    filters: AppliedFilters
    matches: list[MatchSummary]
