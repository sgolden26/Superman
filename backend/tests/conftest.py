"""Shared pytest fixtures.

Override `app.dependency_overrides` here to swap real services for fakes.
"""
from __future__ import annotations

import pytest


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"
