"""Thin OpenAI Chat Completions client for `scenario_designer_prompt.md`.

Reads the Markdown system text from disk (no duplication in code),
issues a single JSON-object response-format call, parses the payload into a
plain dict.

Callers treat results as illustrative: do not hydrate the authoritative theatre
straight from responses. Parsing only asserts `design_brief` and `scenario`
exist; richness is enforced solely by prompt instructions.

Loads `openai` lazily so import-time works without secrets installed.
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
        self._model = model or os.environ.get("SUPERMAN_AI_MODEL") or DEFAULT_MODEL
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
