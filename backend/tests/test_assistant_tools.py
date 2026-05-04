"""Tests for the C2 assistant tool-calling loop.

We avoid hitting OpenAI in unit tests by stubbing `_openai_client` with a
scripted client that emits a predetermined sequence of tool calls and a
final text turn. The goal is to cover the loop's dispatch, ack, directive
capture, and truncation logic, not the model itself.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import patch

from axis.scenarios import eastern_europe
from axis.server import assistant_tools
from axis.server.assistant_tools import (
    MAX_ITERATIONS,
    _dispatch_tool,
    _tool_forecast_implications,
    _tool_query_cop,
    _tool_summarise_intel,
    run_assistant_chat,
)


# ---------------------------------------------------------------------------
# Scripted OpenAI client
# ---------------------------------------------------------------------------


class _ScriptedToolCall:
    def __init__(self, *, id: str, name: str, arguments: dict[str, Any]) -> None:
        self.id = id
        self.type = "function"
        self.function = _ScriptedFunction(name, arguments)


class _ScriptedFunction:
    def __init__(self, name: str, arguments: dict[str, Any]) -> None:
        self.name = name
        self.arguments = json.dumps(arguments)


class _ScriptedMessage:
    def __init__(
        self,
        *,
        content: str | None = None,
        tool_calls: list[_ScriptedToolCall] | None = None,
    ) -> None:
        self.content = content
        self.tool_calls = tool_calls


class _ScriptedChoice:
    def __init__(self, message: _ScriptedMessage) -> None:
        self.message = message


class _ScriptedCompletion:
    def __init__(self, message: _ScriptedMessage) -> None:
        self.choices = [_ScriptedChoice(message)]


class _ScriptedClient:
    def __init__(self, script: list[_ScriptedMessage]) -> None:
        self._script = list(script)
        self.calls: list[dict[str, Any]] = []

        class _Completions:
            def __init__(self, parent: "_ScriptedClient") -> None:
                self._parent = parent

            def create(self, **kwargs: Any) -> _ScriptedCompletion:
                self._parent.calls.append(kwargs)
                if not self._parent._script:
                    return _ScriptedCompletion(_ScriptedMessage(content="(eof)"))
                return _ScriptedCompletion(self._parent._script.pop(0))

        class _Chat:
            def __init__(self, parent: "_ScriptedClient") -> None:
                self.completions = _Completions(parent)

        self.chat = _Chat(self)


def _patch_client(client: _ScriptedClient):
    return patch.object(assistant_tools, "_openai_client", lambda: client)


# ---------------------------------------------------------------------------
# Server-tool unit tests
# ---------------------------------------------------------------------------


def test_query_cop_returns_world_brief_for_team():
    theater = eastern_europe.build()
    out = _tool_query_cop(theater=theater, issuer_team="blue")
    assert out["issuer_team"] == "blue"
    assert "your_units" in out
    assert "enemy_units_visible" in out


def test_query_cop_can_strip_enemy_keys():
    theater = eastern_europe.build()
    out = _tool_query_cop(theater=theater, issuer_team="blue", include_enemy=False)
    assert all(not k.startswith("enemy_") for k in out)


def test_summarise_intel_caps_signal_count():
    theater = eastern_europe.build()
    out = _tool_summarise_intel(theater=theater, issuer_team="blue", max_signals=2)
    assert "leader_signals" in out
    assert len(out["leader_signals"]) <= 2


def test_forecast_implications_requires_intent_or_orders():
    theater = eastern_europe.build()
    out = _tool_forecast_implications(theater=theater, issuer_team="blue")
    assert "error" in out


def test_forecast_implications_with_explicit_orders_does_not_mutate():
    theater = eastern_europe.build()
    initial_turn = theater.current_turn
    blue_unit = next(
        u
        for u in theater.units
        if theater.faction(u.faction_id).allegiance.value == "blue"
        and u.domain.value == "ground"
    )
    orders = [
        {
            "order_id": "o1",
            "kind": "move",
            "issuer_team": "blue",
            "unit_id": blue_unit.id,
            "mode": "foot",
            "destination": [blue_unit.position.lon + 0.01, blue_unit.position.lat],
        }
    ]
    out = _tool_forecast_implications(
        theater=theater, issuer_team="blue", orders=orders
    )
    assert "forecast" in out
    assert theater.current_turn == initial_turn


# ---------------------------------------------------------------------------
# Loop tests
# ---------------------------------------------------------------------------


def test_chat_loop_dispatches_server_tool_then_returns_text():
    theater = eastern_europe.build()
    script = [
        _ScriptedMessage(
            tool_calls=[
                _ScriptedToolCall(
                    id="tc1", name="query_cop", arguments={"include_enemy": True}
                )
            ]
        ),
        _ScriptedMessage(content="COP read; nothing critical."),
    ]
    client = _ScriptedClient(script)
    with _patch_client(client):
        result = run_assistant_chat(
            prompt="status", issuer_team="blue", theater=theater
        )

    assert result.final_text == "COP read; nothing critical."
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].name == "query_cop"
    assert result.tool_calls[0].is_directive is False
    assert result.directives == []
    assert result.truncated is False
    assert result.iterations == 2


def test_chat_loop_captures_client_directives_and_acks_them():
    theater = eastern_europe.build()
    script = [
        _ScriptedMessage(
            tool_calls=[
                _ScriptedToolCall(
                    id="tc1",
                    name="set_view",
                    arguments={"layers": {"frontline": True}},
                ),
                _ScriptedToolCall(
                    id="tc2",
                    name="annotate_map",
                    arguments={
                        "label": "FOB Alpha",
                        "geometry": {"type": "Point", "coordinates": [30.0, 50.0]},
                    },
                ),
            ]
        ),
        _ScriptedMessage(content="Layers and pin queued."),
    ]
    client = _ScriptedClient(script)
    with _patch_client(client):
        result = run_assistant_chat(
            prompt="frame the front and pin alpha",
            issuer_team="blue",
            theater=theater,
        )

    assert result.final_text == "Layers and pin queued."
    assert len(result.directives) == 2
    assert {d["name"] for d in result.directives} == {"set_view", "annotate_map"}
    assert all(tc.is_directive for tc in result.tool_calls)


def test_chat_loop_truncates_at_iteration_cap():
    theater = eastern_europe.build()
    # Always return a tool_call so the loop never converges naturally.
    script = [
        _ScriptedMessage(
            tool_calls=[
                _ScriptedToolCall(
                    id=f"tc{i}", name="query_cop", arguments={}
                )
            ]
        )
        for i in range(MAX_ITERATIONS + 2)
    ]
    client = _ScriptedClient(script)
    with _patch_client(client):
        result = run_assistant_chat(
            prompt="loop", issuer_team="blue", theater=theater
        )

    assert result.truncated is True
    assert result.iterations == MAX_ITERATIONS
    assert len(result.tool_calls) == MAX_ITERATIONS


def test_dispatch_unknown_tool_returns_error_payload():
    theater = eastern_europe.build()
    payload, is_directive = _dispatch_tool(
        name="not_a_tool", arguments={}, theater=theater, issuer_team="blue"
    )
    assert "error" in payload
    assert is_directive is False
