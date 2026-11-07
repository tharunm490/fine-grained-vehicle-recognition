"""Hybrid feature selection API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_registry, get_repository
from app.config import settings
from app.database.repository import SqliteHistoryRepository
from app.models.registry import ModelRegistry
from app.schemas.response import AnalyzeResponse
from app.services.inference_service import analyze_image
from app.utils.errors import AppError
from app.utils.image_utils import ImageValidationError, decode_upload

router = APIRouter(prefix="/hybrid", tags=["hybrid"])


def _validate_confidence(value: float) -> None:
    if not settings.detection_confidence_min <= value <= settings.detection_confidence_max:
        raise AppError(
            422,
            "invalid_confidence",
            f"Detection confidence must be between {settings.detection_confidence_min} "
            f"and {settings.detection_confidence_max}.",
        )


@router.post("/predict", response_model=AnalyzeResponse)
async def hybrid_predict(
    file: UploadFile = File(...),
    use_detection: bool = Form(True),
    detection_confidence: float = Form(settings.default_detection_confidence),
    registry: ModelRegistry = Depends(get_registry),
    repository: SqliteHistoryRepository = Depends(get_repository),
) -> AnalyzeResponse:
    """Run hybrid selection from the existing model predictions."""
    _validate_confidence(detection_confidence)
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

    return await run_in_threadpool(
        analyze_image,
        registry,
        repository,
        decoded,
        ["hybrid"],
        use_detection,
        detection_confidence,
    )
