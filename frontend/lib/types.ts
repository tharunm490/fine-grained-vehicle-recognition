export type MetricStatus =
  | "recorded"
  | "reported"
  | "checkpoint_metadata"
  | "measured"
  | "unavailable";

export interface MetricInfo {
  value: number | null;
  unit: string;
  source: string;
  status: MetricStatus;
  note: string | null;
}

export interface ModelInfo {
  id: string;
  name: string;
  short_name: string;
  approach: string;
  approach_key: "classical" | "deep_learning";
  architecture: string;
  description: string;
  training_approach: string;
  feature_extraction: string;
  input_size: string;
  num_classes: number;
  framework: string;
  parameters: string | null;
  available: boolean;
  error: string | null;
  device: string | null;
  checkpoint_filename: string;
  checkpoint_size_bytes: number;
  load_time_ms: number | null;
  metrics: Record<string, MetricInfo>;
  notes: string[];
}

export interface ModelsResponse {
  success: boolean;
  models: ModelInfo[];
  device: string;
  evaluation_available: boolean;
}

export interface TopPrediction {
  rank: number;
  class_id: number;
  class_name: string;
  score: number | null;
  confidence: number | null;
  relative_score: number | null;
}

export interface ModelPrediction {
  model_id: string;
  model_name: string;
  approach: string;
  predicted_class: string;
  predicted_class_id: number;
  confidence: number | null;
  confidence_type: "softmax" | "calibrated" | "decision_function";
  top_5: TopPrediction[];
  inference_time_ms: number;
  note: string | null;
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Detection {
  vehicle_id: number;
  detection_class: string;
  detection_confidence: number;
  bounding_box: BoundingBox;
}

export interface ComparisonRow {
  metric: string;
  values: Record<string, string>;
}

export interface ComparisonSummary {
  model_ids: string[];
  model_names: Record<string, string>;
  rows: ComparisonRow[];
  all_agree: boolean;
  agreeing_models: string[];
  majority_class: string | null;
  note: string;
}

export interface VehicleResult {
  vehicle_id: number;
  label: string;
  detection: Detection | null;
  crop_image: string | null;
  predictions: ModelPrediction[];
  comparison: ComparisonSummary | null;
}

export interface AnalysisImage {
  filename: string;
  width: number;
  height: number;
  original_image: string | null;
  annotated_image: string | null;
}

export interface AnalyzeResponse {
  success: boolean;
  analysis_id: string | null;
  image: AnalysisImage;
  detections: Detection[];
  vehicles: VehicleResult[];
  comparison: ComparisonSummary | null;
  warnings: string[];
  total_time_ms: number;
  detection_time_ms: number;
}

export interface HealthModel {
  id: string;
  available: boolean;
  error: string | null;
}

export interface DetectorHealth {
  available: boolean;
  model: string;
  source: string;
  classes: string[];
  error: string | null;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  app: string;
  version: string;
  device: string;
  timestamp: string;
  uptime_seconds: number;
  database: string;
  models: HealthModel[];
  detector: DetectorHealth;
  evaluation_available: boolean;
}

export interface BenchmarkItem {
  model_id: string;
  available: boolean;
  latency_ms: number | null;
  error: string | null;
}

export interface BenchmarkResponse {
  success: boolean;
  device: string;
  iterations: number;
  measured_at: string;
  results: BenchmarkItem[];
}

export interface HistorySummary {
  id: string;
  created_at: string;
  filename: string;
  predicted_vehicle: string | null;
  top_model: string | null;
  confidence: number | null;
  confidence_type: string | null;
  detection_count: number;
  use_detection: boolean;
  inference_time_ms: number;
  model_ids: string[];
  thumbnail_url: string;
}

export interface HistoryListResponse {
  success: boolean;
  items: HistorySummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface HistoryStatsResponse {
  total_analyses: number;
  analyses_with_detection: number;
  last_analysis_at: string | null;
  by_model: Record<string, number>;
}

export interface StoredVehicle {
  vehicle_id: number;
  label: string;
  detection: Detection | null;
  crop_url: string | null;
  predictions: ModelPrediction[];
  comparison: ComparisonSummary | null;
}

export interface HistoryDetailResponse {
  success: boolean;
  id: string;
  created_at: string;
  filename: string;
  image_url: string;
  annotated_image_url: string;
  thumbnail_url: string;
  model_ids: string[];
  use_detection: boolean;
  detection_count: number;
  predicted_vehicle: string | null;
  top_model: string | null;
  confidence: number | null;
  confidence_type: string | null;
  inference_time_ms: number;
  detections: Detection[];
  vehicles: StoredVehicle[];
  comparison: ComparisonSummary | null;
  warnings: string[];
}

export interface DetectionResponse {
  success: boolean;
  image: AnalysisImage;
  detections: Detection[];
  crops: string[];
  detection_time_ms: number;
  warnings: string[];
}

export interface EvaluationModelResult {
  model_id: string;
  model_name: string;
  samples: number;
  top1_accuracy: number;
  top5_accuracy: number;
}

export interface EvaluationResponse {
  success: boolean;
  dataset_size: number;
  classes_found: number;
  results: EvaluationModelResult[];
  measured_at: string;
  note: string;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
