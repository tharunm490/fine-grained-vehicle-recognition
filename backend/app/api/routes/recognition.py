from fastapi import APIRouter, Depends, File, Form, UploadFile
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_registry, get_repository
from app.config import settings
from app.database.repository import SqliteHistoryRepository
from app.models.registry import ModelRegistry
from app.schemas.response import AnalyzeResponse
from app.services.inference_service import analyze_image, parse_model_selection
from app.utils.errors import AppError
from app.utils.image_utils import ImageValidationError, decode_upload

router = APIRouter(tags=["recognition"])


def _validate_confidence(value: float) -> float:
    if not (settings.detection_confidence_min <= value <= settings.detection_confidence_max):
        raise AppError(
            422,
            "invalid_confidence",
            f"Detection confidence must be between {settings.detection_confidence_min} and "
            f"{settings.detection_confidence_max}.",
        )
    return value


async def _run(
    file: UploadFile,
    models: str,
    use_detection: bool,
    detection_confidence: float,
    registry: ModelRegistry,
    repository: SqliteHistoryRepository,
) -> AnalyzeResponse:
    _validate_confidence(detection_confidence)
    model_ids = parse_model_selection(models)
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
        model_ids,
        use_detection,
        detection_confidence,
    )


@router.post("/recognize", response_model=AnalyzeResponse)
async def recognize_vehicle(
    file: UploadFile = File(...),
    models: str = Form("all"),
    use_detection: bool = Form(True),
    detection_confidence: float = Form(settings.default_detection_confidence),
    registry: ModelRegistry = Depends(get_registry),
    repository: SqliteHistoryRepository = Depends(get_repository),
) -> AnalyzeResponse:
    return await _run(file, models, use_detection, detection_confidence, registry, repository)


@router.post("/recognize/compare", response_model=AnalyzeResponse)
async def recognize_compare(
    file: UploadFile = File(...),
    use_detection: bool = Form(True),
    detection_confidence: float = Form(settings.default_detection_confidence),
    registry: ModelRegistry = Depends(get_registry),
    repository: SqliteHistoryRepository = Depends(get_repository),
) -> AnalyzeResponse:
    return await _run(
        file,
        "all,hybrid",
        use_detection,
        detection_confidence,
        registry,
        repository,
    )
