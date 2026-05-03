"""FastAPI application factory.

Building the app is wrapped in `create_app` so tests and alternative entry
points can construct a fresh instance with overridden settings.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import Settings, get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.db import init_db


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build and return a configured FastAPI app."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    init_db()

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
