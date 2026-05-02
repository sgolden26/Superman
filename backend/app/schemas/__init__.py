"""Pydantic schemas (HTTP I/O DTOs).

Distinct from `app.domain.models`: these are wire-format types and may
diverge from internal models (e.g. omit sensitive fields, flatten nested
shapes for the UI).
"""
