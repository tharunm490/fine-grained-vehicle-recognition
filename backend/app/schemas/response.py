from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(protected_namespaces=())


class MetricInfo(ApiModel):
    value: float | None = None
    unit: str = "%"
    source: str = "unavailable"
    status: Literal["recorded", "reported", "checkpoint_metadata", "measured", "unavailable"] = "unavailable"
    note: str | None = None


class ModelInfo(ApiModel):
    id: str
    name: str
    short_name: str
    approach: str
    approach_key: Literal["classical", "deep_learning", "hybrid"]
    architecture: str
    description: str
    training_approach: str
    feature_extraction: str
    input_size: str
    num_classes: int
    framework: str
    parameters: str | None = None
    available: bool
    error: str | None = None
    device: str | None = None
    checkpoint_filename: str
    checkpoint_size_bytes: int
    load_time_ms: float | None = None
    metrics: dict[str, MetricInfo] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)


class ModelsResponse(ApiModel):
    success: bool = True
    models: list[ModelInfo]
    device: str
    evaluation_available: bool = False


class TopPrediction(ApiModel):
    rank: int
    class_id: int
    class_name: str
    score: float | None = None
    confidence: float | None = None
    relative_score: float | None = None


class ModelPrediction(ApiModel):
    model_id: str
    model_name: str
    approach: str
    predicted_class: str
    predicted_class_id: int
    confidence: float | None = None
    confidence_type: Literal["softmax", "calibrated", "decision_function"] = "softmax"
    top_5: list[TopPrediction] = Field(default_factory=list)
    inference_time_ms: float
    note: str | None = None


class HybridResult(ApiModel):
    predicted_class: str
    predicted_class_id: int
    source_model_id: str
    source_model_name: str
    source_confidence: float | None = None
    model_agreement: Literal["agree", "disagree", "unavailable"] = "unavailable"
    selection_explanation: str


class BoundingBox(ApiModel):
    x1: float
    y1: float
    x2: float
    y2: float


class Detection(ApiModel):
    vehicle_id: int
    detection_class: str
    detection_confidence: float
    bounding_box: BoundingBox


class ComparisonRow(ApiModel):
    metric: str
    values: dict[str, str]


class ComparisonSummary(ApiModel):
    model_ids: list[str]
    model_names: dict[str, str]
    rows: list[ComparisonRow]
    all_agree: bool
    agreeing_models: list[str]
    majority_class: str | None = None
    note: str


class VehicleResult(ApiModel):
    vehicle_id: int
    label: str
    detection: Detection | None = None
    crop_image: str | None = None
    predictions: list[ModelPrediction] = Field(default_factory=list)
    comparison: ComparisonSummary | None = None
    hybrid: HybridResult | None = None


class AnalysisImage(ApiModel):
    filename: str
    width: int
    height: int
    original_image: str | None = None
    annotated_image: str | None = None


class AnalyzeResponse(ApiModel):
    success: bool
    analysis_id: str | None = None
    image: AnalysisImage
    detections: list[Detection] = Field(default_factory=list)
    vehicles: list[VehicleResult] = Field(default_factory=list)
    comparison: ComparisonSummary | None = None
    warnings: list[str] = Field(default_factory=list)
    total_time_ms: float
    detection_time_ms: float = 0.0


class HealthModels(ApiModel):
    id: str
    available: bool
    error: str | None = None


class DetectorHealth(ApiModel):
    available: bool
    model: str
    source: str
    classes: list[str]
    error: str | None = None


class HealthResponse(ApiModel):
    status: Literal["ok", "degraded"]
    app: str
    version: str
    device: str
    timestamp: str
    uptime_seconds: float
    database: str
    models: list[HealthModels]
    detector: DetectorHealth
    evaluation_available: bool


class BenchmarkItem(ApiModel):
    model_id: str
    available: bool
    latency_ms: float | None = None
    error: str | None = None


class BenchmarkResponse(ApiModel):
    success: bool
    device: str
    iterations: int
    measured_at: str
    results: list[BenchmarkItem]


class HistorySummary(ApiModel):
    id: str
    created_at: str
    filename: str
    predicted_vehicle: str | None = None
    top_model: str | None = None
    confidence: float | None = None
    confidence_type: str | None = None
    detection_count: int = 0
    use_detection: bool = False
    inference_time_ms: float = 0.0
    model_ids: list[str] = Field(default_factory=list)
    thumbnail_url: str


class HistoryListResponse(ApiModel):
    success: bool = True
    items: list[HistorySummary]
    total: int
    limit: int
    offset: int


class HistoryStatsResponse(ApiModel):
    total_analyses: int
    analyses_with_detection: int
    last_analysis_at: str | None = None
    by_model: dict[str, int] = Field(default_factory=dict)


class StoredVehicle(ApiModel):
    vehicle_id: int
    label: str
    detection: Detection | None = None
    crop_url: str | None = None
    predictions: list[ModelPrediction] = Field(default_factory=list)
    comparison: ComparisonSummary | None = None


class HistoryDetailResponse(ApiModel):
    success: bool = True
    id: str
    created_at: str
    filename: str
    image_url: str
    annotated_image_url: str
    thumbnail_url: str
    model_ids: list[str]
    use_detection: bool
    detection_count: int
    predicted_vehicle: str | None = None
    top_model: str | None = None
    confidence: float | None = None
    confidence_type: str | None = None
    inference_time_ms: float = 0.0
    detections: list[Detection] = Field(default_factory=list)
    vehicles: list[StoredVehicle] = Field(default_factory=list)
    comparison: ComparisonSummary | None = None
    warnings: list[str] = Field(default_factory=list)


class DetectionResponse(ApiModel):
    success: bool
    image: AnalysisImage
    detections: list[Detection] = Field(default_factory=list)
    crops: list[str] = Field(default_factory=list)
    detection_time_ms: float
    warnings: list[str] = Field(default_factory=list)


class EvaluationModelResult(ApiModel):
    model_id: str
    model_name: str
    samples: int
    top1_accuracy: float
    top5_accuracy: float


class EvaluationResponse(ApiModel):
    success: bool
    dataset_size: int
    classes_found: int
    results: list[EvaluationModelResult]
    measured_at: str
    note: str
