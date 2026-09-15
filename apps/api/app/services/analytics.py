from collections.abc import Mapping

from app.repositories.analytics import AnalyticsFilters, AnalyticsRepository
from app.schemas.analytics import (
    AppliedFilters,
    DraftChampionSummary,
    MetadataResponse,
    Metric,
    OverviewResponse,
    PlayerSummary,
    TrendPoint,
)

TEAM_METRICS = (
    ("T01", "Taux de victoire", "win_rate", "n_matches", "%"),
    ("T02", "Durée moyenne", "avg_game_duration", "n_duration", "min"),
    ("T03", "Kills par match", "kills_per_game", "n_kills", "kills/match"),
    ("T04", "Deaths par match", "deaths_per_game", "n_deaths", "deaths/match"),
    ("T05", "Différence d’or à 15 min", "gold_diff_at_15", "n_gd15", "or"),
    ("T06", "Premier sang", "first_blood_rate", "n_first_blood", "%"),
    ("T07", "Première tour", "first_tower_rate", "n_first_tower", "%"),
    ("T08", "Premier dragon", "first_dragon_rate", "n_first_dragon", "%"),
    ("T09", "Premier héraut", "first_herald_rate", "n_first_herald", "%"),
    ("T10", "Premier Baron", "first_baron_rate", "n_first_baron", "%"),
    ("T11", "Dragons par match", "dragons_per_game", "n_dragons", "dragons/match"),
    ("T12", "Barons par match", "barons_per_game", "n_barons", "barons/match"),
    ("T13", "Tours par match", "towers_per_game", "n_towers", "tours/match"),
    ("T14", "Victoire côté bleu", "blue_win_rate", "n_blue", "%"),
    ("T15", "Victoire côté rouge", "red_win_rate", "n_red", "%"),
)
PLAYER_METRICS = (
    ("P01", "KDA", "kda", "n_kda", "ratio"),
    ("P02", "Participation aux kills", "kill_participation", "n_kp", "%"),
    ("P03", "CS par minute", "cs_per_min", "n_cs", "CS/min"),
    ("P04", "Or par minute", "gold_per_min", "n_gold", "or/min"),
    ("P05", "Dégâts par minute", "damage_per_min", "n_damage", "dégâts/min"),
    ("P06", "Vision par minute", "vision_per_min", "n_vision", "points/min"),
    ("P07", "Différence d’or à 15 min", "gold_diff_at_15", "n_gd15", "or"),
    ("P08", "Taille du pool", "champion_pool_size", "n_champion", "champions"),
    ("P09", "Taux de victoire", "win_rate", "n_matches", "%"),
)
DRAFT_METRICS = (
    ("D01", "Pick rate", "pick_rate", "picks", "%"),
    ("D02", "Ban rate", "ban_rate", "bans", "%"),
    ("D03", "Présence pick/ban", "presence", "presence_count", "%"),
    ("D04", "Victoire avec le champion", "champion_win_rate", "n_pick_results", "%"),
)


def _float(value) -> float | None:
    return None if value is None else float(value)


def _metric(
    spec: tuple[str, str, str, str, str],
    row: Mapping,
    eligible: int,
    benchmark: Mapping | None = None,
) -> Metric:
    metric_id, label, value_key, count_key, unit = spec
    value = _float(row.get(value_key))
    benchmark_value = _float(benchmark.get(value_key)) if benchmark else None
    return Metric(
        id=metric_id,
        label=label,
        value=value,
        unit=unit,
        sample_size=int(row.get(count_key) or 0),
        eligible_sample_size=eligible,
        benchmark=benchmark_value,
        delta=value - benchmark_value
        if value is not None and benchmark_value is not None
        else None,
    )


class AnalyticsService:
    def __init__(self, repository: AnalyticsRepository):
        self.repository = repository

    def metadata(self) -> MetadataResponse:
        return MetadataResponse.model_validate(self.repository.metadata())

    def overview(self, filters: AnalyticsFilters) -> OverviewResponse | None:
        team_name = self.repository.team_name(filters)
        if team_name is None:
            return None
        team = self.repository.team_aggregate(filters)
        league = self.repository.team_aggregate(filters, include_team=False)
        eligible = int(team["matches_played"])
        team_row = {**team, "n_matches": eligible}
        league_row = {**league, "n_matches": int(league["matches_played"])}
        team_metrics = [_metric(spec, team_row, eligible, league_row) for spec in TEAM_METRICS]

        players: list[PlayerSummary] = []
        for row in self.repository.players(filters):
            player = {**row, "n_matches": int(row["matches_played"])}
            players.append(
                PlayerSummary(
                    player_id=row["player_id"],
                    player_name=row["player_name"],
                    role=row["role"],
                    metrics=[
                        _metric(spec, player, int(row["matches_played"])) for spec in PLAYER_METRICS
                    ],
                )
            )

        draft: list[DraftChampionSummary] = []
        for row in self.repository.draft(filters):
            draft_row = {**row, "presence_count": int(row["picks"]) + int(row["bans"])}
            draft.append(
                DraftChampionSummary(
                    champion=row["champion"],
                    metrics=[
                        _metric(spec, draft_row, int(row["eligible_games"]))
                        for spec in DRAFT_METRICS
                    ],
                )
            )
        return OverviewResponse(
            filters=AppliedFilters(
                league=filters.league,
                year=filters.year,
                team_id=filters.team_id,
                team_name=team_name,
                split=filters.split,
                start_date=filters.start_date,
                end_date=filters.end_date,
            ),
            team_metrics=team_metrics,
            players=players,
            draft=draft,
            trends=[TrendPoint.model_validate(row) for row in self.repository.trends(filters)],
        )
