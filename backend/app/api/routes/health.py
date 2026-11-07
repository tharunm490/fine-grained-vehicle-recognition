from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.deps import get_registry, get_repository
from app.config import settings
from app.database.repository import SqliteHistoryRepository
from app.models.registry import ModelRegistry
from app.schemas.response import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(
    registry: ModelRegistry = Depends(get_registry),
    repository: SqliteHistoryRepository = Depends(get_repository),
) -> HealthResponse:
    health_data = registry.health()
    database_state = "ok"
    try:
        repository.count()
    except Exception:
        database_state = "error"

    all_models_ready = all(item["available"] for item in health_data["models"])
    detector_ready = bool(health_data["detector"]["available"])
    status = "ok" if all_models_ready and detector_ready and database_state == "ok" else "degraded"

    return HealthResponse(
        status=status,
        app=settings.app_name,
        version=settings.app_version,
        device=health_data["device"],
        timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        uptime_seconds=registry.uptime_seconds,
        database=database_state,
        models=health_data["models"],
        detector=health_data["detector"],
        evaluation_available=registry.evaluation_available,
    )
