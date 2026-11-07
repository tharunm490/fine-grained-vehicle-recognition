import type {
  AnalyzeResponse,
  ApiErrorBody,
  BenchmarkResponse,
  DetectionResponse,
  EvaluationResponse,
  HealthResponse,
  HistoryDetailResponse,
  HistoryListResponse,
  HistoryStatsResponse,
  ModelsResponse,
} from "@/lib/types";

const configuredBase = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE_URL = (configuredBase || "http://127.0.0.1:8000").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 0, code = "request_failed", details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      cache: "no-store",
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      `Cannot reach the AutoLens API at ${API_BASE_URL}. Make sure the backend is running.`,
      0,
      "network_error",
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    const body = payload as ApiErrorBody | null;
    throw new ApiError(
      body?.error?.message || `The API returned HTTP ${response.status}.`,
      response.status,
      body?.error?.code || "request_failed",
      body?.error?.details,
    );
  }

  return payload as T;
}

export interface RecognitionOptions {
  models?: string[];
  useDetection?: boolean;
  detectionConfidence?: number;
  signal?: AbortSignal;
}

function recognitionFormData(file: File, options: RecognitionOptions): FormData {
  const form = new FormData();
  form.append("file", file);
  form.append("models", options.models?.length ? options.models.join(",") : "all");
  form.append("use_detection", String(options.useDetection ?? true));
  form.append("detection_confidence", String(options.detectionConfidence ?? 0.35));
  return form;
}

export const api = {
  health: (signal?: AbortSignal) =>
    request<HealthResponse>("/api/health", { signal }),

  models: (signal?: AbortSignal) =>
    request<ModelsResponse>("/api/models", { signal }),

  benchmark: (iterations = 2, force = false, signal?: AbortSignal) =>
    request<BenchmarkResponse>(
      `/api/models/benchmark?iterations=${iterations}&force=${force}`,
      { signal },
    ),

  recognize: (file: File, options: RecognitionOptions = {}) =>
    request<AnalyzeResponse>("/api/recognize", {
      method: "POST",
      body: recognitionFormData(file, options),
      signal: options.signal,
    }),

  recognizeCompare: (file: File, options: Omit<RecognitionOptions, "models"> = {}) =>
    request<AnalyzeResponse>("/api/recognize/compare", {
      method: "POST",
      body: recognitionFormData(file, { ...options, models: [] }),
      signal: options.signal,
    }),

  detect: (file: File, confidence = 0.35, signal?: AbortSignal) => {
    const form = new FormData();
    form.append("file", file);
    form.append("confidence", String(confidence));
    return request<DetectionResponse>("/api/detect", {
      method: "POST",
      body: form,
      signal,
    });
  },

  history: (
    params: { limit?: number; offset?: number; model?: string } = {},
    signal?: AbortSignal,
  ) => {
    const search = new URLSearchParams();
    search.set("limit", String(params.limit ?? 20));
    search.set("offset", String(params.offset ?? 0));
    if (params.model) search.set("model", params.model);
    return request<HistoryListResponse>(`/api/history?${search.toString()}`, { signal });
  },

  historyStats: (signal?: AbortSignal) =>
    request<HistoryStatsResponse>("/api/history/stats", { signal }),

  historyDetail: (id: string, signal?: AbortSignal) =>
    request<HistoryDetailResponse>(`/api/history/${encodeURIComponent(id)}`, { signal }),

  deleteHistory: (id: string) =>
    request<{ success: boolean; deleted: string }>(
      `/api/history/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),

  clearHistory: () =>
    request<{ success: boolean; deleted_count: number }>("/api/history", {
      method: "DELETE",
    }),

  evaluate: (payload: { models?: string[]; max_per_class?: number } = {}) =>
    request<EvaluationResponse>("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  hybridPredict: (file: File, options: Omit<RecognitionOptions, "models"> = {}) => {
    const form = new FormData();
    form.append("file", file);
    form.append("use_detection", String(options.useDetection ?? true));
    form.append("detection_confidence", String(options.detectionConfidence ?? 0.35));
    return request<AnalyzeResponse>("/api/hybrid/predict", {
      method: "POST",
      body: form,
      signal: options.signal,
    });
  },
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
