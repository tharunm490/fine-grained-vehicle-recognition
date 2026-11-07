from fastapi import APIRouter, Depends, Query

from app.api.deps import get_registry
from app.models.registry import ModelRegistry
from app.schemas.response import BenchmarkResponse, ModelInfo, ModelsResponse
from app.utils.errors import AppError

router = APIRouter(tags=["models"])


@router.get("/models", response_model=ModelsResponse)
def list_models(registry: ModelRegistry = Depends(get_registry)) -> ModelsResponse:
    return ModelsResponse(
        models=registry.models_info(),
        device=str(registry.device),
        evaluation_available=registry.evaluation_available,
    )


@router.get("/models/benchmark", response_model=BenchmarkResponse)
def benchmark_models(
    iterations: int = Query(2, ge=1, le=5),
    force: bool = Query(False),
    registry: ModelRegistry = Depends(get_registry),
) -> BenchmarkResponse:
    return registry.benchmark(iterations=iterations, force=force)


@router.get("/models/{model_id}", response_model=ModelInfo)
def model_detail(
    model_id: str,
    registry: ModelRegistry = Depends(get_registry),
) -> ModelInfo:
    if model_id not in registry.models:
        raise AppError(404, "model_not_found", f"Unknown model '{model_id}'.")
    return registry.model_info(model_id)
