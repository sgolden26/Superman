"""Rule-based classifier.

Combines a small number of weighted heuristics: open-carry imagery match,
proximity to known combatants, signature match against historical
combatant subjects, location vs designated safe zones. Used as the default
because its decisions are explainable to operators.
"""
from __future__ import annotations

from app.classifiers.base import ClassifierBase, ClassifierContext
from app.domain.models.classification import ClassificationResult


class RuleBasedClassifier(ClassifierBase):
    name = "rule_based"

    def __init__(self, *, threshold_combatant: float = 0.7) -> None:
        self._threshold = threshold_combatant

    async def classify(self, context: ClassifierContext) -> ClassificationResult:
        raise NotImplementedError
