"""ML-backed classifier (placeholder).

Wraps an external model endpoint or a locally loaded model. Must still
populate `factors` with human-readable contributions (e.g. SHAP-style
attributions or top contributing features) so the C2 UI can audit it.
"""
from __future__ import annotations

from app.classifiers.base import ClassifierBase, ClassifierContext
from app.domain.models.classification import ClassificationResult


class MLClassifier(ClassifierBase):
    name = "ml"

    def __init__(self, *, model_uri: str) -> None:
        self._model_uri = model_uri

    async def classify(self, context: ClassifierContext) -> ClassificationResult:
        raise NotImplementedError
