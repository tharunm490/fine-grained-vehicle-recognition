from pydantic import BaseModel, ConfigDict, Field


class RecognitionRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    models: list[str] = Field(default_factory=list)
    use_detection: bool = True
    detection_confidence: float = 0.35


class DetectionRequest(BaseModel):
    confidence: float = 0.35


class EvaluationRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    models: list[str] = Field(default_factory=list)
    max_per_class: int = 5
