from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Engine

from app.core.database import get_engine
from app.repositories.analytics import AnalyticsFilters, AnalyticsRepository
from app.schemas.analytics import MatchDetail, MatchListResponse, MetadataResponse, OverviewResponse
from app.services.analytics import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def close_analytics_service(
    engine: Annotated[Engine, Depends(get_engine)],
):
    with engine.connect() as connection:
        yield AnalyticsService(AnalyticsRepository(connection))


@router.get("/metadata", response_model=MetadataResponse)
def metadata(service: Annotated[AnalyticsService, Depends(close_analytics_service)]):
    return service.metadata()


@router.get("/overview", response_model=OverviewResponse)
def overview(
    service: Annotated[AnalyticsService, Depends(close_analytics_service)],
    league: Annotated[str, Query(min_length=1, max_length=80)],
    year: Annotated[int, Query(ge=2014, le=2100)],
    team_id: Annotated[str, Query(min_length=1, max_length=100)],
    split: Annotated[str | None, Query(max_length=80)] = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    if start_date and end_date and end_date < start_date:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date")
    result = service.overview(
        AnalyticsFilters(
            league=league,
            year=year,
            team_id=team_id,
            split=split,
            start_date=start_date,
            end_date=end_date,
        )
    )
    if result is None:
        raise HTTPException(status_code=404, detail="No matches for these filters")
    return result


@router.get("/matches", response_model=MatchListResponse)
def matches(
    service: Annotated[AnalyticsService, Depends(close_analytics_service)],
    league: Annotated[str, Query(min_length=1, max_length=80)],
    year: Annotated[int, Query(ge=2014, le=2100)],
    team_id: Annotated[str, Query(min_length=1, max_length=100)],
    split: Annotated[str | None, Query(max_length=80)] = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    if start_date and end_date and end_date < start_date:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date")
    result = service.matches(
        AnalyticsFilters(
            league=league,
            year=year,
            team_id=team_id,
            split=split,
            start_date=start_date,
            end_date=end_date,
        )
    )
    if result is None:
        raise HTTPException(status_code=404, detail="No matches for these filters")
    return result


@router.get("/match", response_model=MatchDetail)
def match_detail(
    service: Annotated[AnalyticsService, Depends(close_analytics_service)],
    game_id: Annotated[str, Query(min_length=1, max_length=100)],
):
    result = service.match_detail(game_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Match not found")
    return result
