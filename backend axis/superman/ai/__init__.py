"""OpenAI helpers for scenario design.

Contents today:

- `director_prompt.md`: NATO-handbook-style Director / Facilitator system text.
  Owns the *Execute* step. Consumes a turn-sliced `state.json` fragment and
  emits facilitator JSON (injects, leader rhetoric, notes).
- `scenario_designer_prompt.md`: matching Scenario Designer system text for
  `initial | redesign | wrap_up` modes. Pulls sponsor text plus knobs (or a
  prior brief plus state) and returns a brief + scenario JSON envelope.
- `scenario_designer.py`: thin Chat Completions client; loads the Markdown
  verbatim, requests `response_format=json_object`, returns parsed dicts.
  Display-only: never apply the payload straight to the live theatre.

Future ideas: red-cell bot, faction leaders, adjudicator sketches.

Depends only on `superman.domain` / `superman.units`; skip importing
`superman.sim` here so dependency arrows stay acyclic.
"""

from superman.ai.scenario_designer import (
    OpenAIScenarioDesigner,
    ScenarioDesignerError,
)

__all__ = ["OpenAIScenarioDesigner", "ScenarioDesignerError"]
