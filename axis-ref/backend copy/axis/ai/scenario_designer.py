"""LLM-backed scenario designer.

Thin wrapper around `scenario_designer_prompt.md` that submits a single
chat completion to OpenAI and returns the parsed JSON envelope.

Design notes:

- The system prompt is loaded verbatim from the sibling Markdown file. The
  prompt itself enforces output shape, schema fidelity, NATO register, and
  hard constraints. We do not duplicate those rules in code.
- The endpoint is *display-only*. Callers must not mutate the live theatre
  with the returned scenario; that is a deliberate Phase 11 scope choice.
- Validation here is intentionally lightweight: parse the JSON and confirm
  the two top-level keys (`design_brief`, `scenario`) are present. The
  prompt's self-check covers the rest. Heavier validation can come later
  when we wire the result back into the simulator.
- The `openai` SDK is imported lazily so missing credentials only fail at
  request time, not at module import.

Public API:
    `OpenAIScenarioDesigner.design(payload: dict) -> dict`
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

PROMPT_PATH = Path(__file__).parent / "scenario_designer_prompt.md"
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TEMPERATURE = 0.4


class ScenarioDesignerError(RuntimeError):
    """Raised when the LLM call or response cannot be honoured."""


class OpenAIScenarioDesigner:
    """OpenAI Chat Completions adapter for the Scenario Designer prompt."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        temperature: float | None = None,
        prompt_path: Path | None = None,
    ) -> None:
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self._model = model or os.environ.get("AXIS_AI_MODEL") or DEFAULT_MODEL
        self._temperature = (
            temperature if temperature is not None else DEFAULT_TEMPERATURE
        )
        path = prompt_path or PROMPT_PATH
        if not path.exists():
            raise ScenarioDesignerError(f"prompt file missing: {path}")
        self._system_prompt = path.read_text(encoding="utf-8")

    @property
    def model(self) -> str:
        return self._model

    def design(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Run a single LLM call against the designer prompt.

        `payload` must already conform to the prompt's mode-specific input
        shape (see `scenario_designer_prompt.md` §4). We forward it verbatim
        as the JSON-encoded user message.
        """
        if not self._api_key:
            raise ScenarioDesignerError(
                "OPENAI_API_KEY is not set. Configure it in the backend "
                "environment to use the scenario designer."
            )
        if not isinstance(payload, dict) or "mode" not in payload:
            raise ScenarioDesignerError(
                "payload must be a dict with a 'mode' field"
            )

        try:
            from openai import OpenAI  # local import keeps module safe to load
        except ImportError as exc:  # pragma: no cover
            raise ScenarioDesignerError(
                "openai package is not installed; run `pip install -e backend`"
            ) from exc

        client = OpenAI(api_key=self._api_key)
        try:
            completion = client.chat.completions.create(
                model=self._model,
                temperature=self._temperature,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": self._system_prompt},
                    {"role": "user", "content": json.dumps(payload)},
                ],
            )
        except Exception as exc:  # network, auth, rate-limit, etc.
            raise ScenarioDesignerError(f"OpenAI call failed: {exc}") from exc

        choices = getattr(completion, "choices", None) or []
        if not choices:
            raise ScenarioDesignerError("OpenAI returned no choices")
        content = choices[0].message.content or ""
        if not content.strip():
            raise ScenarioDesignerError("OpenAI returned empty content")

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ScenarioDesignerError(
                f"OpenAI did not return valid JSON: {exc}"
            ) from exc

        if not isinstance(parsed, dict):
            raise ScenarioDesignerError("expected top-level JSON object")
        if not isinstance(parsed.get("design_brief"), dict):
            raise ScenarioDesignerError("response missing 'design_brief' object")
        if not isinstance(parsed.get("scenario"), dict):
            raise ScenarioDesignerError("response missing 'scenario' object")

        parsed["model"] = self._model
        return parsed
