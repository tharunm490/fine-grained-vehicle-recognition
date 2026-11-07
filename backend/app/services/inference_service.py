import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np

from app.config import settings
from app.database.repository import SqliteHistoryRepository
from app.models.registry import MODEL_ORDER, ModelRegistry
from app.schemas.response import (
    AnalysisImage,
    AnalyzeResponse,
    Detection,
    ModelPrediction,
    VehicleResult,
)
from app.services.comparison_service import build_comparison
from app.services.detection_service import run_detection
from app.utils.errors import AppError
from app.utils.image_utils import (
    DecodedImage,
    crop_with_padding,
    encode_jpeg_bytes,
    encode_jpeg_data_url,
    make_thumbnail,
)

logger = logging.getLogger(__name__)

MODEL_ALIASES = {
    "all": list(MODEL_ORDER),
    "classical": ["classical_svm"],
    "classical_cv": ["classical_svm"],
    "classical_svm": ["classical_svm"],
    "svm": ["classical_svm"],
    "classical-svm": ["classical_svm"],
    "efficientnet": ["efficientnet_b2"],
    "effnet": ["efficientnet_b2"],
    "efficientnet_b2": ["efficientnet_b2"],
    "efficientnet-b2": ["efficientnet_b2"],
    "dinov2": ["dinov2"],
    "dino": ["dinov2"],
}


@dataclass
class VehicleInput:
    vehicle_id: int
    label: str
    detection: Detection | None
    crop: np.ndarray


def parse_model_selection(selection: str | list[str] | None) -> list[str]:
    if not selection:
        return list(MODEL_ORDER)
    tokens: list[str] = []
    if isinstance(selection, str):
        tokens = [token.strip().lower() for token in selection.split(",") if token.strip()]
    else:
        tokens = [str(token).strip().lower() for token in selection if str(token).strip()]
    resolved: list[str] = []
    for token in tokens:
        mapped = MODEL_ALIASES.get(token)
        if not mapped:
            raise AppError(
                422,
                "invalid_model_selection",
                f"Unknown model '{token}'. Choose from: classical_svm, efficientnet_b2, dinov2, all.",
            )
        for model_id in mapped:
            if model_id not in resolved:
                resolved.append(model_id)
    return [model_id for model_id in MODEL_ORDER if model_id in resolved]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _save_bytes(filename: str, payload: bytes) -> str:
    path = settings.history_dir / filename
    path.write_bytes(payload)
    return filename


def _best_prediction(vehicles: list[VehicleResult]) -> ModelPrediction | None:
    softmax = [
        prediction
        for vehicle in vehicles
        for prediction in vehicle.predictions
        if prediction.confidence is not None
    ]
    if softmax:
        return max(softmax, key=lambda item: item.confidence or 0.0)
    for vehicle in vehicles:
        if vehicle.predictions:
            return vehicle.predictions[0]
    return None


def _persist_analysis(
    repository: SqliteHistoryRepository,
    decoded: DecodedImage,
    image: np.ndarray,
    annotated: np.ndarray | None,
    vehicles: list[VehicleResult],
    vehicle_inputs: list[VehicleInput],
    detections: list[Detection],
    warnings: list[str],
    model_ids: list[str],
    use_detection: bool,
    detection_time_ms: float,
    total_time_ms: float,
) -> str:
    analysis_id = uuid.uuid4().hex
    created_at = _now_iso()

    original_file = _save_bytes(
        f"{analysis_id}_original.jpg",
        encode_jpeg_bytes(image, quality=settings.jpeg_quality, max_side=settings.history_image_max_side),
    )
    thumbnail_file = _save_bytes(
        f"{analysis_id}_thumbnail.jpg",
        encode_jpeg_bytes(
            make_thumbnail(image, settings.history_thumbnail_size),
            quality=settings.jpeg_quality,
        ),
    )
    annotated_file = None
    if annotated is not None:
        annotated_file = _save_bytes(
            f"{analysis_id}_annotated.jpg",
            encode_jpeg_bytes(annotated, quality=settings.jpeg_quality, max_side=settings.history_image_max_side),
        )

    crops = []
    for vehicle_input in vehicle_inputs:
        crop_file = _save_bytes(
            f"{analysis_id}_vehicle_{vehicle_input.vehicle_id}.jpg",
            encode_jpeg_bytes(vehicle_input.crop, quality=settings.jpeg_quality, max_side=900),
        )
        crops.append(
            {
                "vehicle_id": vehicle_input.vehicle_id,
                "label": vehicle_input.label,
                "file": crop_file,
            }
        )

    primary = _best_prediction(vehicles)
    record = {
        "id": analysis_id,
        "created_at": created_at,
        "filename": decoded.filename,
        "model_ids": ",".join(model_ids),
        "use_detection": bool(detections),
        "detection_count": len(detections),
        "predicted_vehicle": primary.predicted_class if primary else None,
        "top_model": primary.model_name if primary else None,
        "confidence": primary.confidence if primary else None,
        "confidence_type": primary.confidence_type if primary else None,
        "inference_time_ms": round(
            sum(prediction.inference_time_ms for vehicle in vehicles for prediction in vehicle.predictions), 2
        ),
        "original_file": original_file,
        "annotated_file": annotated_file,
        "thumbnail_file": thumbnail_file,
        "crops": crops,
        "results": {
            "detections": [detection.model_dump() for detection in detections],
            "vehicles": [vehicle.model_dump(exclude={"crop_image"}) for vehicle in vehicles],
            "comparison": vehicles[0].comparison.model_dump() if vehicles and vehicles[0].comparison else None,
            "warnings": warnings,
            "detection_time_ms": detection_time_ms,
            "total_time_ms": total_time_ms,
            "image": {"filename": decoded.filename, "width": decoded.width, "height": decoded.height},
        },
    }
    repository.create(record)
    return analysis_id


def analyze_image(
    registry: ModelRegistry,
    repository: SqliteHistoryRepository,
    decoded: DecodedImage,
    model_ids: list[str],
    use_detection: bool,
    detection_confidence: float,
    persist: bool = True,
) -> AnalyzeResponse:
    started = time.perf_counter()
    warnings: list[str] = []
    available_ids = []
    for model_id in model_ids:
        model = registry.get(model_id)
        if model is None:
            continue
        if model.available:
            available_ids.append(model_id)
        else:
            warnings.append(f"{model.short_name} is unavailable and was skipped: {model.error}")
    if not available_ids:
        raise AppError(503, "no_models_available", "None of the selected classification models are available.")

    vehicles_input: list[VehicleInput] = []
    detections: list[Detection] = []
    annotated: np.ndarray | None = None
    detection_time_ms = 0.0

    if use_detection and registry.detector.available:
        outcome = run_detection(registry, decoded.image, detection_confidence)
        detection_time_ms = outcome.detection_time_ms
        detections = outcome.detections
        annotated = outcome.annotated
        for vehicle in outcome.vehicles:
            vehicles_input.append(
                VehicleInput(
                    vehicle_id=vehicle.vehicle_id,
                    label=vehicle.label,
                    detection=vehicle.detection,
                    crop=vehicle.crop,
                )
            )
        if not vehicles_input:
            warnings.append(
                "No vehicles were detected above the confidence threshold. "
                "Lower the threshold, or disable detection to classify the full image."
            )
            return AnalyzeResponse(
                success=True,
                analysis_id=None,
                image=AnalysisImage(
                    filename=decoded.filename,
                    width=decoded.width,
                    height=decoded.height,
                    original_image=encode_jpeg_data_url(
                        decoded.image,
                        quality=settings.jpeg_quality,
                        max_side=settings.result_image_max_side,
                    ),
                    annotated_image=None,
                ),
                detections=[],
                vehicles=[],
                comparison=None,
                warnings=warnings,
                total_time_ms=round((time.perf_counter() - started) * 1000, 2),
                detection_time_ms=detection_time_ms,
            )
    elif use_detection and not registry.detector.available:
        warnings.append("Vehicle detection is unavailable. The full image was classified instead.")
        crop, _ = crop_with_padding(decoded.image, 0, 0, decoded.width, decoded.height, padding_ratio=0.0)
        vehicles_input.append(VehicleInput(1, "Full image (classification-only)", None, crop))
    else:
        crop, _ = crop_with_padding(decoded.image, 0, 0, decoded.width, decoded.height, padding_ratio=0.0)
        vehicles_input.append(VehicleInput(1, "Full image (classification-only)", None, crop))

    vehicles: list[VehicleResult] = []
    for vehicle in vehicles_input:
        predictions: list[ModelPrediction] = []
        for model_id in available_ids:
            model = registry.get(model_id)
            try:
                raw_prediction = model.predict(vehicle.crop)
                predictions.append(ModelPrediction(**raw_prediction))
            except Exception as exc:
                logger.exception("Inference failed for model %s", model_id)
                warnings.append(f"{model.short_name} failed on vehicle {vehicle.vehicle_id}: {exc}")
        comparison = build_comparison(predictions)
        vehicles.append(
            VehicleResult(
                vehicle_id=vehicle.vehicle_id,
                label=vehicle.label,
                detection=vehicle.detection,
                crop_image=encode_jpeg_data_url(
                    vehicle.crop,
                    quality=settings.jpeg_quality,
                    max_side=900,
                ),
                predictions=predictions,
                comparison=comparison,
            )
        )

    total_time_ms = round((time.perf_counter() - started) * 1000, 2)

    analysis_id = None
    if persist and any(vehicle.predictions for vehicle in vehicles):
        try:
            analysis_id = _persist_analysis(
                repository=repository,
                decoded=decoded,
                image=decoded.image,
                annotated=annotated,
                vehicles=vehicles,
                vehicle_inputs=vehicles_input,
                detections=detections,
                warnings=warnings,
                model_ids=available_ids,
                use_detection=bool(detections),
                detection_time_ms=detection_time_ms,
                total_time_ms=total_time_ms,
            )
        except Exception as exc:
            logger.exception("Failed to persist analysis history")
            warnings.append(f"Analysis completed but history could not be saved: {exc}")

    return AnalyzeResponse(
        success=True,
        analysis_id=analysis_id,
        image=AnalysisImage(
            filename=decoded.filename,
            width=decoded.width,
            height=decoded.height,
            original_image=encode_jpeg_data_url(
                decoded.image,
                quality=settings.jpeg_quality,
                max_side=settings.result_image_max_side,
            ),
            annotated_image=(
                encode_jpeg_data_url(
                    annotated,
                    quality=settings.jpeg_quality,
                    max_side=settings.result_image_max_side,
                )
                if annotated is not None
                else None
            ),
        ),
        detections=detections,
        vehicles=vehicles,
        comparison=vehicles[0].comparison if vehicles else None,
        warnings=warnings,
        total_time_ms=total_time_ms,
        detection_time_ms=detection_time_ms,
    )
