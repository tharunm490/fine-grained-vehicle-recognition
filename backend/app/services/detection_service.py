import time
from dataclasses import dataclass

import numpy as np

from app.config import settings
from app.models.registry import ModelRegistry
from app.schemas.response import BoundingBox, Detection
from app.utils.errors import AppError
from app.utils.image_utils import crop_with_padding, draw_detection_boxes


@dataclass
class VehicleCrop:
    vehicle_id: int
    label: str
    detection: Detection | None
    crop: np.ndarray


@dataclass
class DetectionOutcome:
    detections: list[Detection]
    vehicles: list[VehicleCrop]
    annotated: np.ndarray | None
    detection_time_ms: float


def run_detection(
    registry: ModelRegistry,
    image: np.ndarray,
    confidence: float,
) -> DetectionOutcome:
    if not registry.detector.available:
        raise AppError(
            503,
            "detector_unavailable",
            "Vehicle detection is unavailable. Use classification-only mode instead.",
        )
    started = time.perf_counter()
    try:
        raw_detections = registry.detector.detect(image, confidence, settings.max_detections)
    except Exception as exc:
        raise AppError(500, "detection_failed", f"Vehicle detection failed: {exc}") from exc
    elapsed = round((time.perf_counter() - started) * 1000, 2)

    if not raw_detections:
        return DetectionOutcome(detections=[], vehicles=[], annotated=None, detection_time_ms=elapsed)

    annotated = draw_detection_boxes(image, raw_detections)
    detections: list[Detection] = []
    vehicles: list[VehicleCrop] = []
    for index, item in enumerate(raw_detections, start=1):
        box = item["bounding_box"]
        crop, _ = crop_with_padding(image, box["x1"], box["y1"], box["x2"], box["y2"])
        detection = Detection(
            vehicle_id=index,
            detection_class=item["detection_class"],
            detection_confidence=round(float(item["detection_confidence"]), 4),
            bounding_box=BoundingBox(
                x1=round(float(box["x1"]), 2),
                y1=round(float(box["y1"]), 2),
                x2=round(float(box["x2"]), 2),
                y2=round(float(box["y2"]), 2),
            ),
        )
        detections.append(detection)
        vehicles.append(
            VehicleCrop(
                vehicle_id=index,
                label=f"Vehicle {index} · {detection.detection_class}",
                detection=detection,
                crop=crop,
            )
        )

    return DetectionOutcome(
        detections=detections,
        vehicles=vehicles,
        annotated=annotated,
        detection_time_ms=elapsed,
    )
