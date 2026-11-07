from collections import Counter

from app.schemas.response import ComparisonRow, ComparisonSummary, ModelPrediction

NOTE = (
    "Agreement means the models returned the same Top-1 label. "
    "A higher confidence score does not prove that a prediction is correct. "
    "Calibrated probabilities are estimates, not guarantees."
)


def _score_type_label(prediction: ModelPrediction) -> str:
    if prediction.confidence_type == "decision_function":
        return "SVM decision function (not a probability)"
    if prediction.confidence_type == "calibrated":
        return "Calibrated probability (sigmoid)"
    return "Softmax probability"


def _format_confidence(prediction: ModelPrediction) -> str:
    if prediction.confidence_type == "decision_function":
        best = prediction.top_5[0].score if prediction.top_5 else None
        return f"Decision score {best:.2f} (not a probability)" if best is not None else "Not available"
    if prediction.confidence is None:
        return "Not available"
    return f"{prediction.confidence * 100:.2f}%"


def _format_top5(prediction: ModelPrediction) -> str:
    parts = []
    for item in prediction.top_5:
        if prediction.confidence_type == "decision_function":
            value = f"{item.score:.2f}" if item.score is not None else "n/a"
            parts.append(f"{item.rank}. {item.class_name} — {value}")
        else:
            value = f"{(item.confidence or 0.0) * 100:.2f}%"
            parts.append(f"{item.rank}. {item.class_name} — {value}")
    return " · ".join(parts) if parts else "Not available"


def build_comparison(predictions: list[ModelPrediction]) -> ComparisonSummary | None:
    if len(predictions) < 2:
        return None

    model_ids = [prediction.model_id for prediction in predictions]
    model_names = {prediction.model_id: prediction.model_name for prediction in predictions}
    classes = [prediction.predicted_class for prediction in predictions]
    counts = Counter(classes)
    majority_class, majority_count = counts.most_common(1)[0]
    all_agree = len(counts) == 1
    agreeing_models = [
        prediction.model_id for prediction in predictions if prediction.predicted_class == majority_class
    ]

    rows = [
        ComparisonRow(
            metric="Predicted class",
            values={prediction.model_id: prediction.predicted_class for prediction in predictions},
        ),
        ComparisonRow(
            metric="Top-1 score",
            values={prediction.model_id: _format_confidence(prediction) for prediction in predictions},
        ),
        ComparisonRow(
            metric="Score type",
            values={prediction.model_id: _score_type_label(prediction) for prediction in predictions},
        ),
        ComparisonRow(
            metric="Inference time",
            values={prediction.model_id: f"{prediction.inference_time_ms:.0f} ms" for prediction in predictions},
        ),
        ComparisonRow(
            metric="Top-5 predictions",
            values={prediction.model_id: _format_top5(prediction) for prediction in predictions},
        ),
    ]

    return ComparisonSummary(
        model_ids=model_ids,
        model_names=model_names,
        rows=rows,
        all_agree=all_agree,
        agreeing_models=agreeing_models,
        majority_class=majority_class if majority_count >= 2 else None,
        note=NOTE,
    )
