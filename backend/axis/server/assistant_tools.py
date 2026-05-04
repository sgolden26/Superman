"""Tool-calling C2 assistant.

Sits behind `POST /api/assistant/chat`. Where `axis.server.assistant`
single-shots a free-form intent into validated orders, this module runs an
OpenAI tool-calling loop so the assistant can compose multiple primitives:
read the COP, summarise intel, propose orders, forecast political
implications before commit, and emit client-side directives the FE
dispatches into the Zustand store (set view, annotate, stage).

Design points
-------------
- Polling, not streaming. The endpoint blocks until the loop terminates or
  hits the iteration cap, then returns the full transcript.
- Server-side tools execute on the live theatre under the store lock.
  Forecast tools deep-copy first; nothing in this module mutates the live
  theatre except `propose_orders` (which intentionally inherits the
  scenario-mutating edit machinery from `suggest_orders`).
- Client directives (`set_view`, `annotate_map`, `stage_orders`) are not
  executed server-side; they're mirrored into the response `directives`
  array for the FE to apply. The model still sees an ack so it can chain.
- Strict JSON Schemas for every tool. The OpenAI SDK enforces argument
  shapes before our handler runs, so handlers can be terse.
"""

from __future__ import annotations

import copy
import json
import os
from dataclasses import dataclass, field
from typing import Any, Callable

from axis.decision.actions import DEFAULT_ACTIONS
from axis.decision.explain import build_explanation, region_from_dict
from axis.domain.theater import Theater
from axis.server.assistant import (
    AssistantUnavailable,
    build_world_brief,
    suggest_orders,
)
from axis.sim.implications import forecast_implications
from axis.sim.orders import OrderBatch


MAX_ITERATIONS: int = 6
DEFAULT_MODEL: str = "gpt-4o-mini"


SYSTEM_PROMPT = """\
You are the Mission Command and Control assistant for the operations cell.
Your job is to help the watch officer understand the live picture, model
the second-order effects of orders before they ship, and stage actions for
human-in-the-loop confirmation.

Always prefer to:
- Read before acting. If you need facts about units, regions, or intel,
  call `query_cop` or `summarise_intel` first.
- Forecast before committing. Whenever the operator's intent would result
  in real-world action, call `forecast_implications` so the political /
  social knock-on (credibility, pressure, signal-action gap) is on the
  record BEFORE you stage anything.
- Stage, never auto-execute. Use `stage_orders` to push proposed orders
  into the operator's review cart. The operator confirms the actual
  commit. Never claim an order has been executed; you cannot execute.
- Drive the COP when it helps the operator see what you mean. Use
  `set_view` to toggle layers / focus the camera, and `annotate_map` to
  drop pins for areas of interest, kill boxes, or routes.

Tone: terse, professional, British English. No em-dashes. No hedging
fluff. When you finish, your final assistant message should be a single
short paragraph summarising what you did and what the operator should
look at next.
"""


# ---------------------------------------------------------------------------
# Tool schemas
# ---------------------------------------------------------------------------


def _tool_schemas() -> list[dict[str, Any]]:
    """JSON Schemas for the OpenAI `tools` parameter."""
    return [
        {
            "type": "function",
            "function": {
                "name": "query_cop",
                "description": (
                    "Read a compact slice of the common operating picture "
                    "(units, assets, intel, political layer) for the issuer "
                    "team. Always safe and read-only."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "include_enemy": {
                            "type": "boolean",
                            "description": "Include enemy entities visible within awareness radius.",
                            "default": True,
                        }
                    },
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "summarise_intel",
                "description": (
                    "Return the political / morale slice: per-faction "
                    "pressure, credibility tracks, recent leader signals."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "max_signals": {
                            "type": "integer",
                            "description": "Cap on leader signals returned. Default 6.",
                            "default": 6,
                        }
                    },
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "propose_orders",
                "description": (
                    "Translate a free-form operator intent into validated "
                    "orders. May spawn enabling capabilities (SAMs, fresh "
                    "units) when the intent calls for them. Mutates the "
                    "live theatre with any spawned platforms; orders "
                    "themselves are returned for staging, not executed."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "intent": {
                            "type": "string",
                            "description": "Operator intent in plain English.",
                        }
                    },
                    "required": ["intent"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "forecast_implications",
                "description": (
                    "Forecast the social / political knock-on of a candidate "
                    "set of orders without committing them. Returns deltas "
                    "to issuer credibility (per bilateral track), per-faction "
                    "pressure, and the signal-vs-action gap. Pure read; the "
                    "live theatre is not mutated."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "intent": {
                            "type": "string",
                            "description": (
                                "Free-form intent. If supplied without `orders`, "
                                "the tool first asks `propose_orders` to draft "
                                "a candidate batch on a sandbox copy."
                            ),
                        },
                        "orders": {
                            "type": "array",
                            "description": "Already-drafted OrderDTO list.",
                            "items": {"type": "object"},
                        },
                    },
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "explain_region",
                "description": (
                    "Per-action breakdown for a region: probability, drivers, "
                    "narrative, sources. Useful when the operator asks "
                    "'why is this region risky?' or wants the rationale "
                    "behind an action."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "action_id": {"type": "string"},
                        "region_id": {"type": "string"},
                    },
                    "required": ["action_id", "region_id"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "set_view",
                "description": (
                    "Drive the operator's map: toggle layers, focus the "
                    "camera on a coordinate, change the choropleth metric. "
                    "Returned to the FE as a directive."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "layers": {
                            "type": "object",
                            "additionalProperties": {"type": "boolean"},
                            "description": "Layer key -> visibility. Keys must match LayerKey on the FE.",
                        },
                        "focus": {
                            "type": "object",
                            "properties": {
                                "center": {
                                    "type": "array",
                                    "items": {"type": "number"},
                                    "minItems": 2,
                                    "maxItems": 2,
                                },
                                "zoom": {"type": "number"},
                            },
                            "additionalProperties": False,
                        },
                        "choropleth": {
                            "type": "string",
                            "description": "Choropleth metric to apply (e.g. war_support).",
                        },
                    },
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "annotate_map",
                "description": (
                    "Drop a marker, area-of-interest, or kill-box on the "
                    "operator's map. Returned as a directive."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string"},
                        "kind": {
                            "type": "string",
                            "enum": ["marker", "aoi", "kill_box", "route"],
                            "default": "marker",
                        },
                        "geometry": {
                            "type": "object",
                            "description": "GeoJSON-like geometry (Point/LineString/Polygon).",
                        },
                    },
                    "required": ["label", "geometry"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "stage_orders",
                "description": (
                    "Push a list of OrderDTOs into the operator's staged-orders "
                    "cart for review. The FE will apply them; nothing executes "
                    "until the operator confirms. Always forecast first."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "orders": {
                            "type": "array",
                            "items": {"type": "object"},
                        },
                        "rationale": {"type": "string"},
                    },
                    "required": ["orders"],
                    "additionalProperties": False,
                },
            },
        },
    ]


# Tools whose entire effect is on the FE; the server returns an ack and
# records them in the response `directives` for the FE to dispatch.
CLIENT_DIRECTIVE_TOOLS: frozenset[str] = frozenset(
    {"set_view", "annotate_map", "stage_orders"}
)


# ---------------------------------------------------------------------------
# Server-side tool handlers
# ---------------------------------------------------------------------------


def _tool_query_cop(
    *, theater: Theater, issuer_team: str, include_enemy: bool = True, **_: Any
) -> dict[str, Any]:
    brief = build_world_brief(theater, issuer_team)
    if not include_enemy:
        brief = {k: v for k, v in brief.items() if not k.startswith("enemy_")}
    return brief


def _tool_summarise_intel(
    *, theater: Theater, max_signals: int = 6, **_: Any
) -> dict[str, Any]:
    sigs = sorted(theater.leader_signals, key=lambda s: s.timestamp, reverse=True)[
        : max(1, int(max_signals))
    ]
    pressure = theater.pressure
    return {
        "current_turn": theater.current_turn,
        "global_deadline_turn": pressure.global_deadline_turn,
        "factions": [
            {
                "faction_id": fp.faction_id,
                "intensity": round(fp.intensity, 3),
                "deadline_turn": fp.deadline_turn,
            }
            for fp in pressure.factions
        ],
        "credibility": [
            {
                "from": t.from_faction_id,
                "to": t.to_faction_id,
                "immediate": round(t.immediate, 3),
                "resolve": round(t.resolve, 3),
            }
            for t in theater.credibility
        ],
        "leader_signals": [
            {
                "id": s.id,
                "timestamp": s.timestamp.isoformat(),
                "speaker_faction_id": s.speaker_faction_id,
                "type": s.type.value,
                "severity": round(s.severity, 3),
                "text": s.text,
            }
            for s in sigs
        ],
    }


def _tool_propose_orders(
    *, theater: Theater, issuer_team: str, intent: str, **_: Any
) -> dict[str, Any]:
    """Reuse the existing single-shot order suggester."""
    return suggest_orders(prompt=intent, issuer_team=issuer_team, theater=theater)


def _tool_forecast_implications(
    *,
    theater: Theater,
    issuer_team: str,
    intent: str | None = None,
    orders: list[dict[str, Any]] | None = None,
    **_: Any,
) -> dict[str, Any]:
    """Pure forecast; never mutates the live theatre."""
    sandbox = copy.deepcopy(theater)
    if orders is None:
        if not intent:
            return {"error": "either intent or orders is required"}
        proposal = suggest_orders(
            prompt=intent, issuer_team=issuer_team, theater=sandbox
        )
        order_payloads = proposal.get("orders") or []
    else:
        order_payloads = orders

    if not order_payloads:
        return {
            "error": "no orders to forecast",
            "rationale": "propose_orders returned an empty plan",
        }

    batch_payload: dict[str, Any] = {
        "issuer_team": issuer_team,
        "orders": order_payloads,
    }
    try:
        batch = OrderBatch.from_dict(batch_payload)
    except ValueError as exc:
        return {"error": f"invalid orders: {exc}"}

    forecast = forecast_implications(sandbox, batch)
    return {
        "forecast": forecast.to_dict(),
        "preview_orders": order_payloads,
    }


def _tool_explain_region(
    *,
    theater: Theater,
    issuer_team: str,
    action_id: str,
    region_id: str,
    **_: Any,
) -> dict[str, Any]:
    action = next((a for a in DEFAULT_ACTIONS if a.id == action_id), None)
    if action is None:
        return {"error": f"unknown action_id {action_id!r}"}
    intel = _region_intel_for(theater, region_id)
    if intel is None:
        return {"error": f"unknown region_id {region_id!r}"}
    region = region_from_dict(intel)
    return build_explanation(theater, action, region, issuer_team)


def _region_intel_for(theater: Theater, region_id: str) -> dict[str, Any] | None:
    """Build a minimal RegionIntel-shaped dict from the live theatre.

    The decision/explain pipeline expects a RegionIntel JSON shape (the
    same one served by `/intel.json`). For simplicity we synthesise one
    with empty drivers / events; the explainer adds political context
    from the theatre, so the rationale stays meaningful.
    """
    valid_ids = {t.id for t in theater.territories} | {o.id for o in theater.oblasts}
    if region_id not in valid_ids:
        return None
    return {
        "region_id": region_id,
        "morale_score": 50.0,
        "morale_trend": "steady",
        "trend_delta": 0.0,
        "history": [],
        "drivers": [],
        "recent_events": [],
    }


_SERVER_TOOLS: dict[str, Callable[..., dict[str, Any]]] = {
    "query_cop": _tool_query_cop,
    "summarise_intel": _tool_summarise_intel,
    "propose_orders": _tool_propose_orders,
    "forecast_implications": _tool_forecast_implications,
    "explain_region": _tool_explain_region,
}


# ---------------------------------------------------------------------------
# OpenAI tool-calling loop
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class ToolInvocation:
    """One round-trip: name + arguments + the JSON-encoded result the model saw."""

    id: str
    name: str
    arguments: dict[str, Any]
    result: dict[str, Any]
    is_directive: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "arguments": self.arguments,
            "result": self.result,
            "is_directive": self.is_directive,
        }


@dataclass(slots=True)
class ChatResult:
    """Final envelope returned to the FE."""

    final_text: str
    tool_calls: list[ToolInvocation] = field(default_factory=list)
    directives: list[dict[str, Any]] = field(default_factory=list)
    iterations: int = 0
    truncated: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "final_text": self.final_text,
            "tool_calls": [tc.to_dict() for tc in self.tool_calls],
            "directives": self.directives,
            "iterations": self.iterations,
            "truncated": self.truncated,
        }


def _openai_client():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise AssistantUnavailable(
            "OPENAI_API_KEY is not set. Export it before running `axis serve`."
        )
    try:
        from openai import OpenAI  # type: ignore[import-not-found]
    except ImportError as exc:
        raise AssistantUnavailable(
            "openai SDK not installed. Run `pip install -e .` in backend/."
        ) from exc
    return OpenAI(api_key=api_key)


def _dispatch_tool(
    *,
    name: str,
    arguments: dict[str, Any],
    theater: Theater,
    issuer_team: str,
) -> tuple[dict[str, Any], bool]:
    """Run one tool. Returns (json-friendly result, is_client_directive)."""
    if name in CLIENT_DIRECTIVE_TOOLS:
        return {"queued": True}, True
    handler = _SERVER_TOOLS.get(name)
    if handler is None:
        return {"error": f"unknown tool {name!r}"}, False
    try:
        return handler(
            theater=theater, issuer_team=issuer_team, **arguments
        ), False
    except AssistantUnavailable:
        raise
    except (ValueError, KeyError, TypeError) as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}, False


def run_assistant_chat(
    *,
    prompt: str,
    issuer_team: str,
    theater: Theater,
    model: str = DEFAULT_MODEL,
    history: list[dict[str, Any]] | None = None,
) -> ChatResult:
    """Run the tool-calling loop. Returns the full ChatResult envelope."""
    if issuer_team not in {"red", "blue"}:
        raise ValueError(f"issuer_team must be 'red' or 'blue', got {issuer_team!r}")
    text = (prompt or "").strip()
    if not text:
        raise ValueError("prompt must be a non-empty string")

    client = _openai_client()
    tools = _tool_schemas()

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]
    if history:
        # Caller-provided prior turns. Trust the shape; the model will reject
        # malformed entries with a tool-message error and we'll surface that.
        messages.extend(history)
    messages.append(
        {
            "role": "user",
            "content": json.dumps(
                {
                    "intent": text,
                    "issuer_team": issuer_team,
                    "world_brief": build_world_brief(theater, issuer_team),
                },
                separators=(",", ":"),
            ),
        }
    )

    invocations: list[ToolInvocation] = []
    directives: list[dict[str, Any]] = []
    final_text = ""

    iterations = 0
    truncated = False
    for _ in range(MAX_ITERATIONS):
        iterations += 1
        completion = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.3,
            max_tokens=2048,
        )
        msg = completion.choices[0].message
        tool_calls = getattr(msg, "tool_calls", None)

        if not tool_calls:
            final_text = (msg.content or "").strip()
            break

        # Append the assistant turn so the next loop sees its tool_calls.
        messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments or "{}",
                        },
                    }
                    for tc in tool_calls
                ],
            }
        )

        for tc in tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
                if not isinstance(args, dict):
                    args = {}
            except json.JSONDecodeError:
                args = {}

            result, is_directive = _dispatch_tool(
                name=name, arguments=args, theater=theater, issuer_team=issuer_team
            )
            invocations.append(
                ToolInvocation(
                    id=tc.id,
                    name=name,
                    arguments=args,
                    result=result,
                    is_directive=is_directive,
                )
            )
            if is_directive:
                directives.append({"name": name, "arguments": args})

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, separators=(",", ":")),
                }
            )
    else:
        truncated = True
        final_text = (
            "(assistant exceeded the iteration cap; partial transcript above)"
        )

    return ChatResult(
        final_text=final_text,
        tool_calls=invocations,
        directives=directives,
        iterations=iterations,
        truncated=truncated,
    )
