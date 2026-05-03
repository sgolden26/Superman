"""FastAPI app exposing the live theatre and order endpoints.

Routes:

- `GET  /api/health`           liveness probe.
- `GET  /api/state`            current snapshot in `state.json` shape.
- `POST /api/orders/execute`   apply an `OrderBatch`, return outcomes + new snapshot.

Wire format mirrors `axis.sim.orders.OrderBatch`:

```
{
  "issuer_team": "blue" | "red",
  "orders": [
    {"order_id": "...", "kind": "move", "unit_id": "...",
     "mode": "foot" | "vehicle", "destination": [lon, lat]}
  ]
}
```

The CORS middleware is permissive on purpose: this is a single-tenant demo.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

def _load_dotenv_once() -> None:
    """Tiny `KEY=VALUE` parser for `backend/.env` and the repo root `.env`.

    Runs at module import so `OPENAI_API_KEY` (and any sibling secrets) are
    visible to `axis.server.assistant` whether the server was started by
    `python -m axis serve` or by uvicorn's reloader subprocess. Existing
    environment variables always win.
    """
    here = Path(__file__).resolve()
    candidates = [
        here.parents[2] / ".env",          # backend/.env
        here.parents[3] / ".env",          # repo-root .env
        Path.cwd() / ".env",               # whatever cwd the user launched from
    ]
    for path in candidates:
        if not path.is_file():
            continue
        try:
            for raw in path.read_text(encoding="utf-8").splitlines():
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
        except OSError:
            continue


_load_dotenv_once()

from axis.ai import OpenAIScenarioDesigner, ScenarioDesignerError  # noqa: E402
from axis.decision.actions import DEFAULT_ACTIONS  # noqa: E402
from axis.decision.explain import build_explanation, region_from_dict  # noqa: E402
from axis.server.assistant import AssistantUnavailable, suggest_orders  # noqa: E402
from axis.server.state import TheaterStore, get_store  # noqa: E402
from axis.sim.orders import OrderBatch, OrderRegistry  # noqa: E402

ALLOWED_DESIGNER_MODES = ("initial",)
ALLOWED_PRESSURE_PROFILES = ("stable", "elevated", "acute")
ALLOWED_CREDIBILITY_PROFILES = (
    "low_trust",
    "fractious",
    "cooperative_west",
)
ALLOWED_THIRD_PARTY = ("background", "active", "intervening")


def create_app(*, store: TheaterStore | None = None) -> FastAPI:
    app = FastAPI(title="Axis live theatre", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def _store() -> TheaterStore:
        return store if store is not None else get_store()

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return {"ok": True, "scenario_id": _store().scenario_id}

    @app.get("/api/state")
    def state() -> dict[str, Any]:
        return _store().snapshot_dict()

    @app.get("/api/signals")
    def signals() -> dict[str, Any]:
        """Political-layer slice: pressure, credibility, leader signals."""
        return _store().political_dict()

    @app.post("/api/orders/execute")
    def execute(payload: dict[str, Any]) -> dict[str, Any]:
        try:
            batch = OrderBatch.from_dict(payload)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        result, snapshot = _store().apply_batch(batch)
        return {
            "ok": result.ok,
            "outcomes": [o.to_dict() for o in result.outcomes],
            "political_summary": result.political_summary,
            "snapshot": snapshot,
        }

    @app.post("/api/orders/execute_round")
    def execute_round_endpoint(payload: dict[str, Any]) -> dict[str, Any]:
        """Hot-seat round: accepts {batches: [OrderBatch, OrderBatch]} and
        executes both teams' orders as one phased pass."""
        raw_batches = payload.get("batches")
        if not isinstance(raw_batches, list) or len(raw_batches) == 0:
            raise HTTPException(status_code=400, detail="batches must be a non-empty list")
        try:
            batches = [OrderBatch.from_dict(b) for b in raw_batches]
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        try:
            result, snapshot = _store().apply_round(batches)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {
            "ok": result.ok,
            "outcomes_by_team": {
                team: [o.to_dict() for o in outs]
                for team, outs in result.outcomes_by_team.items()
            },
            "political_summary": result.political_summary,
            "snapshot": snapshot,
        }

    @app.get("/api/orders/catalogue")
    def catalogue() -> dict[str, Any]:
        return {"orders": OrderRegistry.catalogue()}

    @app.post("/api/orders/suggest")
    def suggest(payload: dict[str, Any]) -> dict[str, Any]:
        """Convert a free-form intent into validated orders via OpenAI."""
        prompt = payload.get("prompt")
        issuer_team = payload.get("issuer_team")
        if not isinstance(prompt, str) or not prompt.strip():
            raise HTTPException(status_code=400, detail="prompt must be a non-empty string")
        if issuer_team not in ("red", "blue"):
            raise HTTPException(
                status_code=400, detail="issuer_team must be 'red' or 'blue'"
            )
        try:
            result = _store().with_theater(
                lambda theater: suggest_orders(
                    prompt=prompt, issuer_team=issuer_team, theater=theater,
                )
            )
        except AssistantUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return result

    @app.post("/api/reset")
    def reset() -> dict[str, Any]:
        _store().reset()
        return {"ok": True}

    @app.post("/api/decision/explain")
    def explain(payload: dict[str, Any]) -> dict[str, Any]:
        """Per-row narrative + sources for a (action, region, team) tuple.

        Body shape:
            {
              "action_id": "deploy_troops",
              "team": "blue",
              "region_intel": { ... RegionIntel JSON shape from /intel.json ... }
            }

        The FE posts the live region-intel slice so the explanation is
        deterministic with what the user is seeing on screen.
        """
        action_id = payload.get("action_id")
        team = payload.get("team")
        region_payload = payload.get("region_intel")
        if not isinstance(action_id, str) or not isinstance(team, str):
            raise HTTPException(
                status_code=400, detail="action_id and team are required strings"
            )
        if team not in ("red", "blue"):
            raise HTTPException(status_code=400, detail="team must be 'red' or 'blue'")
        if not isinstance(region_payload, dict):
            raise HTTPException(
                status_code=400, detail="region_intel must be an object"
            )

        action = next((a for a in DEFAULT_ACTIONS if a.id == action_id), None)
        if action is None:
            raise HTTPException(
                status_code=404, detail=f"unknown action_id: {action_id}"
            )

        try:
            region = region_from_dict(region_payload)
        except (KeyError, ValueError, TypeError) as exc:
            raise HTTPException(
                status_code=400, detail=f"invalid region_intel: {exc}"
            ) from exc

        return _store().with_theater(
            lambda theater: build_explanation(theater, action, region, team)
        )

    @app.post("/api/ai/design_scenario")
    def design_scenario(payload: dict[str, Any]) -> dict[str, Any]:
        """Run the LLM-backed Scenario Designer (Phase 11, mode `initial`).

        Display-only: this endpoint never mutates the live theatre. The
        returned envelope is intended for FE rendering in the Prompt panel.

        Body shape:
            {
              "mode": "initial",
              "sponsor_problem_statement": "<free text>",
              "knobs": {
                  "starting_pressure_profile":    "stable|elevated|acute",
                  "starting_credibility_profile": "low_trust|fractious|cooperative_west",
                  "third_party_intensity":        "background|active|intervening",
                  "global_deadline_turn":         <int>
              }
            }

        Knobs are optional; the prompt fills defaults for anything missing.
        """
        mode = payload.get("mode", "initial")
        if mode not in ALLOWED_DESIGNER_MODES:
            raise HTTPException(
                status_code=400,
                detail=f"unsupported mode {mode!r}; allowed: {ALLOWED_DESIGNER_MODES}",
            )
        sponsor = payload.get("sponsor_problem_statement")
        if not isinstance(sponsor, str) or not sponsor.strip():
            raise HTTPException(
                status_code=400,
                detail="sponsor_problem_statement is required (non-empty string)",
            )

        raw_knobs = payload.get("knobs") or {}
        if not isinstance(raw_knobs, dict):
            raise HTTPException(status_code=400, detail="knobs must be an object")
        knobs = _validate_knobs(raw_knobs)

        try:
            designer = OpenAIScenarioDesigner()
            result = designer.design(
                {
                    "mode": mode,
                    "sponsor_problem_statement": sponsor.strip(),
                    "knobs": knobs,
                }
            )
        except ScenarioDesignerError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return result

    return app


def _validate_knobs(knobs: dict[str, Any]) -> dict[str, Any]:
    """Surface-level guard against bad inputs; defaults are filled by the prompt."""
    out: dict[str, Any] = {}
    pp = knobs.get("starting_pressure_profile")
    if pp is not None:
        if pp not in ALLOWED_PRESSURE_PROFILES:
            raise HTTPException(
                status_code=400,
                detail=f"starting_pressure_profile must be one of {ALLOWED_PRESSURE_PROFILES}",
            )
        out["starting_pressure_profile"] = pp
    cp = knobs.get("starting_credibility_profile")
    if cp is not None:
        if cp not in ALLOWED_CREDIBILITY_PROFILES:
            raise HTTPException(
                status_code=400,
                detail=f"starting_credibility_profile must be one of {ALLOWED_CREDIBILITY_PROFILES}",
            )
        out["starting_credibility_profile"] = cp
    tp = knobs.get("third_party_intensity")
    if tp is not None:
        if tp not in ALLOWED_THIRD_PARTY:
            raise HTTPException(
                status_code=400,
                detail=f"third_party_intensity must be one of {ALLOWED_THIRD_PARTY}",
            )
        out["third_party_intensity"] = tp
    deadline = knobs.get("global_deadline_turn")
    if deadline is not None:
        if not isinstance(deadline, int) or deadline < 3 or deadline > 24:
            raise HTTPException(
                status_code=400,
                detail="global_deadline_turn must be an integer in [3, 24]",
            )
        out["global_deadline_turn"] = deadline
    return out


app = create_app()
