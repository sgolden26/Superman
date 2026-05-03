"""FastAPI application factory.

Building the app is wrapped in `create_app` so tests and alternative entry
points can construct a fresh instance with overridden settings.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.api.v1.router import api_router
from app.config import Settings, get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.db import get_engine, init_db
from app.seed import seed_demo_data


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build and return a configured FastAPI app."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    init_db()
    with Session(get_engine()) as session:
        seed_demo_data(session)

    app = FastAPI(
        title="Superman API",
        version="0.0.1",
        docs_url="/docs",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix="/api/v1")

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "env": settings.env}

    return app


app = create_app()
