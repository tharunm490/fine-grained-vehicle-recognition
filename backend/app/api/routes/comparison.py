from fastapi import APIRouter, Depends

from app.api.deps import get_registry
from app.models.registry import ModelRegistry
from app.schemas.response import ModelsResponse

router = APIRouter(tags=["comparison"])


@router.get("/comparison", response_model=ModelsResponse)
def comparison_overview(registry: ModelRegistry = Depends(get_registry)) -> ModelsResponse:
    return ModelsResponse(
        models=registry.models_info(),
        device=str(registry.device),
        evaluation_available=registry.evaluation_available,
    )
