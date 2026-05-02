"""Domain-level exceptions and FastAPI exception handler registration.

Services raise subclasses of `AppError`. The API layer maps them to HTTP
responses uniformly via `register_exception_handlers`.
"""
from __future__ import annotations

from fastapi import FastAPI


class AppError(Exception):
    """Base for all expected, user-mappable errors."""

    status_code: int = 500
    code: str = "internal_error"


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ValidationError(AppError):
    status_code = 422
    code = "validation_error"


class UnauthorisedError(AppError):
    status_code = 401
    code = "unauthorised"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


class UpstreamError(AppError):
    """A dependency we do not own failed (sensor feed, imagery provider, ...)."""

    status_code = 502
    code = "upstream_error"


def register_exception_handlers(app: FastAPI) -> None:
    """Attach handlers that translate `AppError` subclasses to JSON responses."""
    raise NotImplementedError
