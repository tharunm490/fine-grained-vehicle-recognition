"""Hybrid prediction selection service.

This module is ISOLATED from Approaches 1 and 2.  It does NOT modify any
existing model, checkpoint, or prediction output.

Selection logic
---------------
1. Obtain predictions from EfficientNet-B2 and DINOv2 (already computed by
   the standard inference pipeline).
2. Compare their Top-1 classes and softmax confidences.
3. Select the prediction with the higher confidence as the hybrid result.
4. Use the Classical SVM prediction as an additional reference only.
5. Return the actual confidence from the selected source model.
6. Return the selected prediction and source metadata.

The planned feature-fusion architecture is documented separately and has not
been trained.
"""

from __future__ import annotations

from app.schemas.response import ModelPrediction

_DEEP_LEARNING_IDS = {"efficientnet_b2", "dinov2"}


def build_hybrid_prediction(
    predictions: list[ModelPrediction],
) -> dict | None:
    """
    Given model predictions from the standard inference pipeline, select the
    strongest valid deep-learning result.

    Returns a dict with:
      - predicted_class        : selected vehicle class
      - source_model_id        : 'efficientnet_b2' or 'dinov2'
      - source_model_name      : human-readable name of the source model
      - source_confidence      : actual softmax confidence from the source model
      - classical_prediction   : Top-1 class from Classical SVM (reference only)
      - classical_confidence   : calibrated probability from Classical SVM
      - selection_note         : plain-English explanation of the selection

    Returns None if neither EfficientNet-B2 nor DINOv2 predictions are present.
    """
    deep = [p for p in predictions if p.model_id in _DEEP_LEARNING_IDS]
    if not deep:
        return None

    # Select the deep-learning prediction with the highest softmax confidence.
    # Fall back to the first available if confidence is None.
    def _sort_key(p: ModelPrediction) -> float:
        return p.confidence if p.confidence is not None else -1.0

    selected = max(deep, key=_sort_key)

    classical = next(
        (p for p in predictions if p.model_id == "classical_svm"), None
    )

    other_deep = [p for p in deep if p.model_id != selected.model_id]
    other_name = other_deep[0].model_name if other_deep else None
    other_class = other_deep[0].predicted_class if other_deep else None
    agreement = (
        other_class == selected.predicted_class if other_class is not None else None
    )

    if agreement is True:
        selection_note = (
            f"Both EfficientNet-B2 and DINOv2 agree on '{selected.predicted_class}'. "
            f"{selected.model_name} selected as source (higher confidence)."
        )
    elif agreement is False:
        selection_note = (
            f"{selected.model_name} selected (confidence "
            f"{(selected.confidence or 0.0) * 100:.1f}%) over "
            f"{other_name} (predicted '{other_class}'). "
            "Models disagreed; highest-confidence deep-learning prediction used."
        )
    else:
        selection_note = (
            f"{selected.model_name} is the only available deep-learning model. "
            "Its prediction is used as the hybrid result."
        )

    return {
        "predicted_class": selected.predicted_class,
        "predicted_class_id": selected.predicted_class_id,
        "source_model_id": selected.model_id,
        "source_model_name": selected.model_name,
        "source_confidence": selected.confidence,
        "model_agreement": (
            "agree" if agreement is True else "disagree" if agreement is False else "unavailable"
        ),
        "classical_prediction": classical.predicted_class if classical else None,
        "classical_confidence": classical.confidence if classical else None,
        "selection_explanation": selection_note,
    }
