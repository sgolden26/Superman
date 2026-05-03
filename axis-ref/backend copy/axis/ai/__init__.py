"""AI agents.

Current contents:

- `director_prompt.md`: NATO-handbook-grounded Wargame Director / Facilitator
  system prompt. Owns the *Execute* step. Consumes a turn-bounded slice of
  `state.json` and emits scripted injects, non-player faction leader signals,
  and facilitator notes as a strict JSON envelope.
- `scenario_designer_prompt.md`: NATO-handbook-grounded Scenario Designer
  system prompt. Owns the *Design* step in three modes (`initial`,
  `redesign`, `wrap_up`). Consumes a sponsor problem statement plus scenario
  knobs (or a previous brief plus a state slice) and emits a design brief
  plus a mode-shaped scenario JSON envelope.
- `scenario_designer.py`: OpenAI Chat Completions adapter for the Scenario
  Designer prompt. Loads the MD prompt verbatim, posts a single
  `response_format=json_object` call, and returns the parsed envelope.
  Display-only: callers must not mutate the live theatre with the result.

Future contents:

- `red_cell.py`: LLM-driven adversary that adapts to blue moves.
- `leader.py`: per-faction leader persona producing strategic decisions
  conditioned on intel signals (sentiment, protests, casualties).
- `adjudicator.py`: rapid LLM adjudication of ambiguous combat outcomes.

Pure consumers of `axis.domain` / `axis.units`; never import from `sim`
directly to keep the dependency graph one-way.
"""

from axis.ai.scenario_designer import (
    OpenAIScenarioDesigner,
    ScenarioDesignerError,
)

__all__ = ["OpenAIScenarioDesigner", "ScenarioDesignerError"]
