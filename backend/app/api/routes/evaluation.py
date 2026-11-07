from fastapi import APIRouter, Depends

from app.api.deps import get_registry
from app.models.registry import ModelRegistry
from app.schemas.request import EvaluationRequest
from app.schemas.response import EvaluationResponse
from app.services.evaluation_service import run_evaluation

router = APIRouter(tags=["evaluation"])


@router.post("/evaluate", response_model=EvaluationResponse)
def evaluate_models(
    payload: EvaluationRequest,
    registry: ModelRegistry = Depends(get_registry),
) -> EvaluationResponse:
    return run_evaluation(registry, payload.models, payload.max_per_class)
