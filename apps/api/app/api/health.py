import logging
from collections.abc import Callable
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import check_database

router = APIRouter(tags=["Health"])
logger = logging.getLogger(__name__)


class HealthResponse(BaseModel):
    status: Literal["ok", "ready", "unavailable"]
    database: Literal["reachable", "unreachable"] | None = None


def get_database_probe() -> Callable[[], None]:
    return check_database


@router.get("/health", response_model=HealthResponse, response_model_exclude_none=True)
def health() -> HealthResponse:
    """Liveness: the API process is responding, independently of PostgreSQL."""
    return HealthResponse(status="ok")


@router.get("/ready", response_model=HealthResponse, responses={503: {"model": HealthResponse}})
def ready(probe: Annotated[Callable[[], None], Depends(get_database_probe)]):
    """Readiness: PostgreSQL must answer a bounded connectivity check."""
    try:
        probe()
    except (SQLAlchemyError, OSError):
        # Never return connection strings or exception details to the client.
        logger.warning("Database readiness check failed")
        return JSONResponse(
            status_code=503, content={"status": "unavailable", "database": "unreachable"}
        )
    return HealthResponse(status="ready", database="reachable")
