# ruff: noqa: E501
from dataclasses import dataclass
from datetime import date

from sqlalchemy import Connection, text


@dataclass(frozen=True)
class AnalyticsFilters:
    league: str
    year: int
    team_id: str
    split: str | None = None
    start_date: date | None = None
    end_date: date | None = None


def _where(
    filters: AnalyticsFilters, team_alias: str, include_team: bool = True
) -> tuple[str, dict]:
    conditions = [
        "m.quality_status IN ('COMPLETE', 'PARTIAL')",
        "m.league = :league",
        "m.year = :year",
    ]
    params: dict = {"league": filters.league, "year": filters.year}
    if include_team:
        conditions.append(f"{team_alias}.team_id = :team_id")
        params["team_id"] = filters.team_id
    if filters.split:
        conditions.append("m.split = :split")
        params["split"] = filters.split
    if filters.start_date:
        conditions.append("m.played_at >= :start_date")
        params["start_date"] = filters.start_date
    if filters.end_date:
        conditions.append("m.played_at < (CAST(:end_date AS date) + INTERVAL '1 day')")
        params["end_date"] = filters.end_date
    return " AND ".join(conditions), params


TEAM_AGGREGATE = """
SELECT
    COUNT(*) AS matches_played,
    SUM(t.result) AS wins,
    AVG(t.result) * 100.0 AS win_rate,
    AVG(m.duration_seconds) / 60.0 AS avg_game_duration,
    AVG(t.kills) AS kills_per_game,
    AVG(t.deaths) AS deaths_per_game,
    AVG(t.gold_diff_at_15) AS gold_diff_at_15,
    AVG(t.first_blood::int) * 100.0 AS first_blood_rate,
    AVG(t.first_tower::int) * 100.0 AS first_tower_rate,
    AVG(t.first_dragon::int) * 100.0 AS first_dragon_rate,
    AVG(t.first_herald::int) * 100.0 AS first_herald_rate,
    AVG(t.first_baron::int) * 100.0 AS first_baron_rate,
    AVG(t.dragons) AS dragons_per_game,
    AVG(t.barons) AS barons_per_game,
    AVG(t.towers) AS towers_per_game,
    AVG(t.result) FILTER (WHERE t.side = 'BLUE') * 100.0 AS blue_win_rate,
    AVG(t.result) FILTER (WHERE t.side = 'RED') * 100.0 AS red_win_rate,
    COUNT(m.duration_seconds) AS n_duration,
    COUNT(t.kills) AS n_kills,
    COUNT(t.deaths) AS n_deaths,
    COUNT(t.gold_diff_at_15) AS n_gd15,
    COUNT(t.first_blood) AS n_first_blood,
    COUNT(t.first_tower) AS n_first_tower,
    COUNT(t.first_dragon) AS n_first_dragon,
    COUNT(t.first_herald) AS n_first_herald,
    COUNT(t.first_baron) AS n_first_baron,
    COUNT(t.dragons) AS n_dragons,
    COUNT(t.barons) AS n_barons,
    COUNT(t.towers) AS n_towers,
    COUNT(*) FILTER (WHERE t.side = 'BLUE') AS n_blue,
    COUNT(*) FILTER (WHERE t.side = 'RED') AS n_red
FROM analytics.team_match_stats t
JOIN analytics.matches m ON m.game_id = t.game_id
WHERE {where}
"""


class AnalyticsRepository:
    def __init__(self, connection: Connection):
        self.connection = connection

    def metadata(self) -> dict:
        status = (
            self.connection.execute(
                text(
                    """
                SELECT
                    (SELECT COUNT(*) FROM analytics.matches) AS matches,
                    (SELECT COUNT(*) FROM raw.oracle_elixir_rows) AS raw_rows,
                    (SELECT COUNT(*) FROM raw.source_files WHERE row_count > 0) AS source_files,
                    COALESCE((SELECT SUM(rows_rejected) FROM raw.pipeline_runs WHERE status = 'SUCCEEDED'), 0) AS rejected_rows,
                    (SELECT MAX(imported_at) FROM raw.source_files WHERE row_count > 0) AS last_imported_at
                """
                )
            )
            .mappings()
            .one()
        )
        leagues = (
            self.connection.execute(
                text(
                    """
                SELECT league, year, COUNT(*) AS matches
                FROM analytics.matches
                GROUP BY league, year
                ORDER BY year DESC, matches DESC, league
                """
                )
            )
            .mappings()
            .all()
        )
        splits = (
            self.connection.execute(
                text(
                    """
                SELECT league, year, split
                FROM analytics.matches
                WHERE split IS NOT NULL AND split <> ''
                GROUP BY league, year, split
                ORDER BY year DESC, league, split
                """
                )
            )
            .mappings()
            .all()
        )
        teams = (
            self.connection.execute(
                text(
                    """
                SELECT t.team_id, MAX(t.team_name) AS team_name, m.league, m.year,
                       COUNT(*) AS matches
                FROM analytics.team_match_stats t
                JOIN analytics.matches m ON m.game_id = t.game_id
                GROUP BY t.team_id, m.league, m.year
                ORDER BY m.year DESC, matches DESC, team_name
                """
                )
            )
            .mappings()
            .all()
        )
        return {
            "data_status": dict(status),
            "leagues": list(leagues),
            "splits": list(splits),
            "teams": list(teams),
        }

    def team_name(self, filters: AnalyticsFilters) -> str | None:
        where, params = _where(filters, "t")
        return self.connection.execute(
            text(
                f"""
                SELECT t.team_name
                FROM analytics.team_match_stats t
                JOIN analytics.matches m ON m.game_id = t.game_id
                WHERE {where}
                GROUP BY t.team_name
                ORDER BY COUNT(*) DESC
                LIMIT 1
                """
            ),
            params,
        ).scalar_one_or_none()

    def team_aggregate(self, filters: AnalyticsFilters, include_team: bool = True) -> dict:
        where, params = _where(filters, "t", include_team=include_team)
        return dict(
            self.connection.execute(text(TEAM_AGGREGATE.format(where=where)), params)
            .mappings()
            .one()
        )

    def players(self, filters: AnalyticsFilters) -> list[dict]:
        where, params = _where(filters, "p")
        return list(
            self.connection.execute(
                text(
                    f"""
                    SELECT p.player_id, p.player_name, p.role,
                           COUNT(*) AS matches_played,
                           SUM(p.result) AS wins,
                           SUM(p.kills + p.assists) FILTER (
                               WHERE p.kills IS NOT NULL AND p.assists IS NOT NULL
                                 AND p.deaths IS NOT NULL
                           )::float / GREATEST(1, SUM(p.deaths) FILTER (
                               WHERE p.kills IS NOT NULL AND p.assists IS NOT NULL
                                 AND p.deaths IS NOT NULL
                           )) AS kda,
                           SUM(p.kills + p.assists) FILTER (
                               WHERE p.kills IS NOT NULL AND p.assists IS NOT NULL
                                 AND p.team_kills IS NOT NULL
                           ) * 100.0 / NULLIF(SUM(p.team_kills) FILTER (
                               WHERE p.kills IS NOT NULL AND p.assists IS NOT NULL
                                 AND p.team_kills IS NOT NULL
                           ), 0) AS kill_participation,
                           SUM(p.total_cs) / NULLIF(SUM(m.duration_seconds) FILTER (
                               WHERE p.total_cs IS NOT NULL
                           ) / 60.0, 0) AS cs_per_min,
                           SUM(p.total_gold) / NULLIF(SUM(m.duration_seconds) FILTER (
                               WHERE p.total_gold IS NOT NULL
                           ) / 60.0, 0) AS gold_per_min,
                           SUM(p.damage_to_champions) / NULLIF(SUM(m.duration_seconds) FILTER (
                               WHERE p.damage_to_champions IS NOT NULL
                           ) / 60.0, 0) AS damage_per_min,
                           SUM(p.vision_score) / NULLIF(SUM(m.duration_seconds) FILTER (
                               WHERE p.vision_score IS NOT NULL
                           ) / 60.0, 0) AS vision_per_min,
                           AVG(p.gold_diff_at_15) AS gold_diff_at_15,
                           COUNT(DISTINCT p.champion) AS champion_pool_size,
                           AVG(p.result) * 100.0 AS win_rate,
                           COUNT(*) FILTER (WHERE p.kills IS NOT NULL AND p.assists IS NOT NULL AND p.deaths IS NOT NULL) AS n_kda,
                           COUNT(*) FILTER (WHERE p.kills IS NOT NULL AND p.assists IS NOT NULL AND p.team_kills IS NOT NULL) AS n_kp,
                           COUNT(*) FILTER (WHERE p.total_cs IS NOT NULL AND m.duration_seconds IS NOT NULL) AS n_cs,
                           COUNT(*) FILTER (WHERE p.total_gold IS NOT NULL AND m.duration_seconds IS NOT NULL) AS n_gold,
                           COUNT(*) FILTER (WHERE p.damage_to_champions IS NOT NULL AND m.duration_seconds IS NOT NULL) AS n_damage,
                           COUNT(*) FILTER (WHERE p.vision_score IS NOT NULL AND m.duration_seconds IS NOT NULL) AS n_vision,
                           COUNT(p.gold_diff_at_15) AS n_gd15,
                           COUNT(p.champion) AS n_champion
                    FROM analytics.player_match_stats p
                    JOIN analytics.matches m ON m.game_id = p.game_id
                    WHERE {where}
                    GROUP BY p.player_id, p.player_name, p.role
                    ORDER BY p.role, matches_played DESC, p.player_name
                    """
                ),
                params,
            )
            .mappings()
            .all()
        )

    def draft(self, filters: AnalyticsFilters, limit: int = 15) -> list[dict]:
        where, params = _where(filters, "t")
        params["limit"] = limit
        return list(
            self.connection.execute(
                text(
                    f"""
                    WITH eligible AS (
                        SELECT DISTINCT m.game_id
                        FROM analytics.matches m
                        JOIN analytics.team_match_stats t ON t.game_id = m.game_id
                        WHERE {where} AND m.quality_status = 'COMPLETE'
                    ), actions AS (
                        SELECT d.champion,
                               COUNT(DISTINCT d.game_id) FILTER (WHERE d.action_type = 'PICK') AS picks,
                               COUNT(DISTINCT d.game_id) FILTER (WHERE d.action_type = 'BAN') AS bans
                        FROM analytics.draft_actions d
                        JOIN eligible e ON e.game_id = d.game_id
                        WHERE d.team_id = :team_id
                        GROUP BY d.champion
                    ), pick_results AS (
                        SELECT d.champion, AVG(t.result) * 100.0 AS champion_win_rate,
                               COUNT(DISTINCT d.game_id) AS n_pick_results
                        FROM analytics.draft_actions d
                        JOIN analytics.team_match_stats t
                          ON t.game_id = d.game_id AND t.team_id = d.team_id
                        JOIN eligible e ON e.game_id = d.game_id
                        WHERE d.team_id = :team_id AND d.action_type = 'PICK'
                        GROUP BY d.champion
                    ), total AS (SELECT COUNT(*)::float AS games FROM eligible)
                    SELECT a.champion, a.picks, a.bans,
                           a.picks * 100.0 / NULLIF(total.games, 0) AS pick_rate,
                           a.bans * 100.0 / NULLIF(total.games, 0) AS ban_rate,
                           (a.picks + a.bans) * 100.0 / NULLIF(total.games, 0) AS presence,
                           p.champion_win_rate, COALESCE(p.n_pick_results, 0) AS n_pick_results,
                           total.games::int AS eligible_games
                    FROM actions a CROSS JOIN total
                    LEFT JOIN pick_results p USING (champion)
                    ORDER BY (a.picks + a.bans) DESC, a.picks DESC, a.champion
                    LIMIT :limit
                    """
                ),
                params,
            )
            .mappings()
            .all()
        )

    def trends(self, filters: AnalyticsFilters) -> list[dict]:
        where, params = _where(filters, "t")
        return list(
            self.connection.execute(
                text(
                    f"""
                    SELECT date_trunc('week', m.played_at)::date AS week,
                           COUNT(*) AS matches,
                           AVG(t.result) * 100.0 AS win_rate,
                           AVG(t.gold_diff_at_15) AS gold_diff_at_15,
                           AVG(t.kills) AS kills_per_game
                    FROM analytics.team_match_stats t
                    JOIN analytics.matches m ON m.game_id = t.game_id
                    WHERE {where} AND m.played_at IS NOT NULL
                    GROUP BY week
                    ORDER BY week
                    """
                ),
                params,
            )
            .mappings()
            .all()
        )
