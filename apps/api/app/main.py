from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.core.config import get_settings


def create_app() -> FastAPI:
    application = FastAPI(
        title="Rift Analyst API",
        version="0.1.0",
        description="Professional League of Legends performance analytics.",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["Accept", "Content-Type"],
    )
    application.include_router(health_router, prefix="/api/v1")
    return application


app = create_app()
