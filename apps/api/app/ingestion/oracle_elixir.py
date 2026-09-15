import csv
import hashlib
import json
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import Connection, delete, select, update
from sqlalchemy.dialects.postgresql import insert

from app.core.models import (
    DraftAction,
    Match,
    OracleElixirRow,
    PipelineRun,
    PlayerMatchStat,
    SourceFile,
    TeamMatchStat,
)

REQUIRED_COLUMNS = {
    "gameid",
    "datacompleteness",
    "league",
    "year",
    "date",
    "side",
    "position",
    "playername",
    "playerid",
    "teamname",
    "teamid",
    "champion",
    "gamelength",
    "result",
    "kills",
    "deaths",
    "assists",
    "teamkills",
    "total cs",
    "totalgold",
    "damagetochampions",
    "visionscore",
    "golddiffat15",
}
ROLE_MAP = {"top": "TOP", "jng": "JUNGLE", "mid": "MID", "bot": "ADC", "sup": "SUPPORT"}
SIDE_MAP = {"blue": "BLUE", "red": "RED"}


class InvalidSourceError(ValueError):
    pass


@dataclass(frozen=True)
class GameRecords:
    match: dict
    teams: list[dict]
    players: list[dict]
    draft: list[dict]


@dataclass(frozen=True)
class IngestionSummary:
    status: str
    sha256: str
    rows_read: int
    rows_inserted: int
    rows_rejected: int
    games_loaded: int
    source_file_id: int
    pipeline_run_id: int


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _text(value: str | None) -> str | None:
    clean = (value or "").strip()
    return clean or None


def _integer(value: str | None) -> int | None:
    clean = _text(value)
    if clean is None:
        return None
    try:
        return int(float(clean))
    except ValueError as error:
        raise InvalidSourceError(f"invalid integer value: {clean!r}") from error


def _number(value: str | None) -> float | None:
    clean = _text(value)
    if clean is None:
        return None
    try:
        return float(clean)
    except ValueError as error:
        raise InvalidSourceError(f"invalid numeric value: {clean!r}") from error


def _boolean(value: str | None) -> bool | None:
    clean = (_text(value) or "").lower()
    if not clean:
        return None
    if clean in {"1", "true", "yes"}:
        return True
    if clean in {"0", "false", "no"}:
        return False
    raise InvalidSourceError(f"invalid boolean value: {clean!r}")


def _datetime(value: str | None) -> datetime | None:
    clean = _text(value)
    if clean is None:
        return None
    try:
        parsed = datetime.fromisoformat(clean.replace("Z", "+00:00"))
    except ValueError as error:
        raise InvalidSourceError(f"invalid date value: {clean!r}") from error
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed


def _identifier(raw_id: str | None, *fallback_parts: str | None) -> str:
    if value := _text(raw_id):
        return value
    material = "|".join(_text(part) or "" for part in fallback_parts)
    if not material.strip("|"):
        raise InvalidSourceError("missing identifier and fallback values")
    return "derived:" + hashlib.sha256(material.encode()).hexdigest()[:24]


def _row_hash(row: dict[str, str]) -> str:
    payload = json.dumps(row, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()


def iter_grouped_games(path: Path) -> Iterator[tuple[str, list[tuple[int, dict[str, str]]]]]:
    seen: set[str] = set()
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if reader.fieldnames is None:
            raise InvalidSourceError("CSV header is missing")
        missing = sorted(REQUIRED_COLUMNS - set(reader.fieldnames))
        if missing:
            raise InvalidSourceError(f"required columns missing: {', '.join(missing)}")
        current_id: str | None = None
        current: list[tuple[int, dict[str, str]]] = []
        for row_number, row in enumerate(reader, start=2):
            game_id = _text(row.get("gameid")) or f"missing:{row_number}"
            if current_id is None:
                current_id = game_id
            if game_id != current_id:
                if game_id in seen:
                    raise InvalidSourceError(f"game {game_id!r} is not contiguous in the CSV")
                seen.add(current_id)
                yield current_id, current
                current_id, current = game_id, []
            current.append((row_number, row))
        if current_id is not None:
            yield current_id, current


def transform_game(
    game_id: str, numbered_rows: Sequence[tuple[int, dict[str, str]]]
) -> GameRecords:
    if game_id.startswith("missing:"):
        raise InvalidSourceError("gameid is missing")
    rows = [row for _, row in numbered_rows]
    team_rows = [row for row in rows if (row.get("position") or "").lower() == "team"]
    player_rows = [row for row in rows if (row.get("position") or "").lower() in ROLE_MAP]
    sides = [_normalize_side(row.get("side")) for row in team_rows]
    results = [_integer(row.get("result")) for row in team_rows]
    players_per_side = {
        side: sum(_normalize_side(row.get("side")) == side for row in player_rows)
        for side in SIDE_MAP.values()
    }
    roles_per_side = {
        side: {
            _normalize_role(row.get("position"))
            for row in player_rows
            if _normalize_side(row.get("side")) == side
        }
        for side in SIDE_MAP.values()
    }
    if (
        len(team_rows) != 2
        or set(sides) != {"BLUE", "RED"}
        or set(results) != {0, 1}
        or players_per_side != {"BLUE": 5, "RED": 5}
        or any(roles != set(ROLE_MAP.values()) for roles in roles_per_side.values())
    ):
        raise InvalidSourceError(
            "game must contain two sides, one winner and five distinct roles per side"
        )
    base = team_rows[0]
    completeness = {_text(row.get("datacompleteness")) for row in rows}
    match = {
        "game_id": game_id,
        "league": _required(base.get("league"), "league"),
        "year": _integer(base.get("year")),
        "split": _text(base.get("split")),
        "playoffs": _boolean(base.get("playoffs")),
        "played_at": _datetime(base.get("date")),
        "game_number": _integer(base.get("game")),
        "patch": _text(base.get("patch")),
        "duration_seconds": _integer(base.get("gamelength")),
        "data_completeness": ",".join(sorted(value for value in completeness if value)),
        "quality_status": "COMPLETE" if completeness == {"complete"} else "PARTIAL",
    }
    if match["year"] is None or not match["duration_seconds"] or match["duration_seconds"] <= 0:
        raise InvalidSourceError("year and a positive game duration are required")

    teams = [_team_record(game_id, row) for row in team_rows]
    players = [_player_record(game_id, row) for row in player_rows]
    draft: list[dict] = []
    for row in sorted(player_rows, key=lambda item: _integer(item.get("participantid")) or 0):
        player = _player_record(game_id, row)
        draft.append(
            {
                "game_id": game_id,
                "team_id": player["team_id"],
                "team_name": player["team_name"],
                "side": player["side"],
                "action_type": "PICK",
                "action_slot": list(ROLE_MAP.values()).index(player["role"]) + 1,
                "champion": player["champion"],
                "role": player["role"],
            }
        )
    for row in team_rows:
        side = _normalize_side(row.get("side"))
        team_name = _required(row.get("teamname"), "teamname")
        team_id = _identifier(row.get("teamid"), team_name)
        for slot in range(1, 6):
            champion = _text(row.get(f"ban{slot}"))
            if champion:
                draft.append(
                    {
                        "game_id": game_id,
                        "team_id": team_id,
                        "team_name": team_name,
                        "side": side,
                        "action_type": "BAN",
                        "action_slot": slot,
                        "champion": champion,
                        "role": None,
                    }
                )
    return GameRecords(match=match, teams=teams, players=players, draft=draft)


def _required(value: str | None, field: str) -> str:
    clean = _text(value)
    if clean is None:
        raise InvalidSourceError(f"{field} is missing")
    return clean


def _normalize_side(value: str | None) -> str:
    try:
        return SIDE_MAP[(value or "").strip().lower()]
    except KeyError as error:
        raise InvalidSourceError(f"invalid side: {value!r}") from error


def _normalize_role(value: str | None) -> str:
    try:
        return ROLE_MAP[(value or "").strip().lower()]
    except KeyError as error:
        raise InvalidSourceError(f"invalid role: {value!r}") from error


def _team_record(game_id: str, row: dict[str, str]) -> dict:
    team_name = _required(row.get("teamname"), "teamname")
    return {
        "game_id": game_id,
        "team_id": _identifier(row.get("teamid"), team_name),
        "team_name": team_name,
        "side": _normalize_side(row.get("side")),
        "result": _integer(row.get("result")),
        "kills": _integer(row.get("kills")),
        "deaths": _integer(row.get("deaths")),
        "assists": _integer(row.get("assists")),
        "gold_diff_at_15": _number(row.get("golddiffat15")),
        "first_blood": _boolean(row.get("firstblood")),
        "first_tower": _boolean(row.get("firsttower")),
        "first_dragon": _boolean(row.get("firstdragon")),
        "first_herald": _boolean(row.get("firstherald")),
        "first_baron": _boolean(row.get("firstbaron")),
        "dragons": _integer(row.get("dragons")),
        "heralds": _integer(row.get("heralds")),
        "barons": _integer(row.get("barons")),
        "towers": _integer(row.get("towers")),
    }


def _player_record(game_id: str, row: dict[str, str]) -> dict:
    player_name = _required(row.get("playername"), "playername")
    team_name = _required(row.get("teamname"), "teamname")
    role = _normalize_role(row.get("position"))
    team_id = _identifier(row.get("teamid"), team_name)
    participant_id = _integer(row.get("participantid"))
    result = _integer(row.get("result"))
    if participant_id is None or result not in {0, 1}:
        raise InvalidSourceError("participantid and a binary result are required")
    return {
        "game_id": game_id,
        "participant_id": participant_id,
        "player_id": _identifier(row.get("playerid"), player_name, team_id, role),
        "player_name": player_name,
        "team_id": team_id,
        "team_name": team_name,
        "side": _normalize_side(row.get("side")),
        "role": role,
        "champion": _required(row.get("champion"), "champion"),
        "result": result,
        "kills": _integer(row.get("kills")),
        "deaths": _integer(row.get("deaths")),
        "assists": _integer(row.get("assists")),
        "team_kills": _integer(row.get("teamkills")),
        "total_cs": _number(row.get("total cs")),
        "total_gold": _number(row.get("totalgold")),
        "damage_to_champions": _number(row.get("damagetochampions")),
        "vision_score": _number(row.get("visionscore")),
        "gold_diff_at_15": _number(row.get("golddiffat15")),
    }


def ingest_file(
    connection_factory, path: Path, source_uri: str | None = None, batch_games: int = 250
) -> IngestionSummary:
    path = path.resolve()
    if not path.is_file():
        raise FileNotFoundError(path)
    checksum = file_sha256(path)
    now = datetime.now(UTC)
    with connection_factory.begin() as connection:
        existing = (
            connection.execute(select(SourceFile).where(SourceFile.sha256 == checksum))
            .mappings()
            .first()
        )
        source_file_id = (
            existing["id"]
            if existing
            else connection.execute(
                SourceFile.__table__.insert()
                .values(
                    filename=path.name,
                    source_uri=source_uri,
                    sha256=checksum,
                    size_bytes=path.stat().st_size,
                    imported_at=now,
                    row_count=0,
                    game_count=0,
                )
                .returning(SourceFile.id)
            ).scalar_one()
        )
        run_id = connection.execute(
            PipelineRun.__table__.insert()
            .values(
                job_name="oracle_elixir_ingestion",
                source_file=path.name,
                source_sha256=checksum,
                started_at=now,
                status="SKIPPED" if existing and existing["row_count"] else "RUNNING",
                rows_read=0,
                rows_inserted=0,
                rows_rejected=0,
                games_loaded=0,
                finished_at=now if existing and existing["row_count"] else None,
            )
            .returning(PipelineRun.id)
        ).scalar_one()
        if existing and existing["row_count"]:
            return IngestionSummary("SKIPPED", checksum, 0, 0, 0, 0, source_file_id, run_id)

    totals = {"rows_read": 0, "rows_inserted": 0, "rows_rejected": 0, "games_loaded": 0}
    raw_batch: list[dict] = []
    matches: list[dict] = []
    teams: list[dict] = []
    players: list[dict] = []
    draft: list[dict] = []
    try:
        with connection_factory.begin() as connection:
            for game_id, numbered_rows in iter_grouped_games(path):
                totals["rows_read"] += len(numbered_rows)
                raw_batch.extend(
                    {
                        "source_file_id": source_file_id,
                        "row_number": row_number,
                        "game_id": game_id,
                        "row_hash": _row_hash(row),
                        "payload": row,
                    }
                    for row_number, row in numbered_rows
                )
                try:
                    records = transform_game(game_id, numbered_rows)
                except InvalidSourceError:
                    totals["rows_rejected"] += len(numbered_rows)
                else:
                    matches.append({**records.match, "source_file_id": source_file_id})
                    teams.extend(records.teams)
                    players.extend(records.players)
                    draft.extend(records.draft)
                    totals["games_loaded"] += 1
                    totals["rows_inserted"] += len(numbered_rows)
                if len(matches) >= batch_games or len(raw_batch) >= batch_games * 12:
                    _flush(connection, raw_batch, matches, teams, players, draft)
                    raw_batch, matches, teams, players, draft = [], [], [], [], []
            _flush(connection, raw_batch, matches, teams, players, draft)
            connection.execute(
                update(SourceFile)
                .where(SourceFile.id == source_file_id)
                .values(row_count=totals["rows_read"], game_count=totals["games_loaded"])
            )
        with connection_factory.begin() as connection:
            connection.execute(
                update(PipelineRun)
                .where(PipelineRun.id == run_id)
                .values(status="SUCCEEDED", finished_at=datetime.now(UTC), **totals)
            )
    except Exception as error:
        with connection_factory.begin() as connection:
            connection.execute(
                update(PipelineRun)
                .where(PipelineRun.id == run_id)
                .values(
                    status="FAILED",
                    finished_at=datetime.now(UTC),
                    error_message=str(error)[:2000],
                    **totals,
                )
            )
        raise
    return IngestionSummary(
        "SUCCEEDED", checksum, source_file_id=source_file_id, pipeline_run_id=run_id, **totals
    )


def _flush(
    connection: Connection,
    raw_rows: list[dict],
    matches: list[dict],
    teams: list[dict],
    players: list[dict],
    draft: list[dict],
) -> None:
    if raw_rows:
        connection.execute(OracleElixirRow.__table__.insert(), raw_rows)
    if not matches:
        return
    _upsert(connection, Match.__table__, matches, ["game_id"])
    game_ids = [row["game_id"] for row in matches]
    connection.execute(delete(DraftAction).where(DraftAction.game_id.in_(game_ids)))
    connection.execute(delete(PlayerMatchStat).where(PlayerMatchStat.game_id.in_(game_ids)))
    connection.execute(delete(TeamMatchStat).where(TeamMatchStat.game_id.in_(game_ids)))
    if teams:
        connection.execute(TeamMatchStat.__table__.insert(), teams)
    if players:
        connection.execute(PlayerMatchStat.__table__.insert(), players)
    if draft:
        connection.execute(DraftAction.__table__.insert(), draft)


def _upsert(connection: Connection, table, rows: list[dict], keys: list[str]) -> None:
    statement = insert(table).values(rows)
    excluded = statement.excluded
    connection.execute(
        statement.on_conflict_do_update(
            index_elements=keys,
            set_={
                column.name: getattr(excluded, column.name)
                for column in table.columns
                if column.name not in keys
            },
        )
    )
