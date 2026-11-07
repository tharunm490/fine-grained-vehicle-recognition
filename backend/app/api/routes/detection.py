from fastapi import APIRouter, Depends, File, Form, UploadFile
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_registry
from app.config import settings
from app.models.registry import ModelRegistry
from app.schemas.response import AnalysisImage, DetectionResponse
from app.services.detection_service import run_detection
from app.utils.errors import AppError
from app.utils.image_utils import ImageValidationError, decode_upload, encode_jpeg_data_url

router = APIRouter(tags=["detection"])


@router.post("/detect", response_model=DetectionResponse)
async def detect_vehicles(
    file: UploadFile = File(...),
    confidence: float = Form(settings.default_detection_confidence),
    registry: ModelRegistry = Depends(get_registry),
) -> DetectionResponse:
    if not (settings.detection_confidence_min <= confidence <= settings.detection_confidence_max):
        raise AppError(
            422,
            "invalid_confidence",
            f"Detection confidence must be between {settings.detection_confidence_min} and "
            f"{settings.detection_confidence_max}.",
        )
    if not registry.detector.available:
        raise AppError(
            503,
            "detector_unavailable",
            "Vehicle detection is unavailable. Classification-only recognition is still available.",
        )

    payload = await file.read(settings.max_upload_bytes + 1)
    try:
        decoded = await run_in_threadpool(
            decode_upload,
            payload,
            file.filename,
            settings.max_upload_bytes,
            settings.max_image_pixels,
            settings.min_image_side,
            file.content_type,
        )
    except ImageValidationError as exc:
        raise AppError(422, "invalid_image", str(exc)) from exc

    outcome = await run_in_threadpool(run_detection, registry, decoded.image, confidence)
    warnings = []
    if not outcome.detections:
        warnings.append("No vehicles were detected above the selected confidence threshold.")

    return DetectionResponse(
        success=True,
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
                    outcome.annotated,
                    quality=settings.jpeg_quality,
                    max_side=settings.result_image_max_side,
                )
                if outcome.annotated is not None
                else None
            ),
        ),
        detections=outcome.detections,
        crops=[
            encode_jpeg_data_url(vehicle.crop, quality=settings.jpeg_quality, max_side=900)
            for vehicle in outcome.vehicles
        ],
        detection_time_ms=outcome.detection_time_ms,
        warnings=warnings,
    )
