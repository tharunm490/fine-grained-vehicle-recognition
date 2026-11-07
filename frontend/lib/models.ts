import type { MetricStatus } from "@/lib/types";

export interface ModelAccent {
  text: string;
  softText: string;
  surface: string;
  border: string;
  dot: string;
  chart: string;
  gradient: string;
}

export const MODEL_ACCENTS: Record<string, ModelAccent> = {
  classical_svm: {
    text: "text-amber-300",
    softText: "text-amber-200/80",
    surface: "bg-amber-400/10",
    border: "border-amber-400/25",
    dot: "bg-amber-400",
    chart: "var(--chart-classical)",
    gradient: "from-amber-400/20 via-amber-400/5 to-transparent",
  },
  efficientnet_b2: {
    text: "text-cyan-300",
    softText: "text-cyan-200/80",
    surface: "bg-cyan-400/10",
    border: "border-cyan-400/25",
    dot: "bg-cyan-400",
    chart: "var(--chart-efficientnet)",
    gradient: "from-cyan-400/20 via-cyan-400/5 to-transparent",
  },
  dinov2: {
    text: "text-violet-300",
    softText: "text-violet-200/80",
    surface: "bg-violet-400/10",
    border: "border-violet-400/25",
    dot: "bg-violet-400",
    chart: "var(--chart-dinov2)",
    gradient: "from-violet-400/20 via-violet-400/5 to-transparent",
  },
};

const FALLBACK_ACCENT: ModelAccent = {
  text: "text-sky-300",
  softText: "text-sky-200/80",
  surface: "bg-sky-400/10",
  border: "border-sky-400/25",
  dot: "bg-sky-400",
  chart: "var(--chart-fallback)",
  gradient: "from-sky-400/20 via-sky-400/5 to-transparent",
};

export function modelAccent(modelId: string): ModelAccent {
  return MODEL_ACCENTS[modelId] ?? FALLBACK_ACCENT;
}

export const MODEL_SHORT_NAMES: Record<string, string> = {
  classical_svm: "Classical SVM",
  efficientnet_b2: "EfficientNet-B2",
  dinov2: "DINOv2 ViT-B/14",
};

export function shortModelName(modelId: string, fallback?: string | null): string {
  return MODEL_SHORT_NAMES[modelId] ?? fallback ?? modelId;
}

export const APPROACH_LABELS: Record<string, string> = {
  classical: "Classical CV",
  deep_learning: "Deep Learning",
};

export interface ProvenanceMeta {
  label: string;
  description: string;
  className: string;
}

export const PROVENANCE: Record<MetricStatus, ProvenanceMeta> = {
  recorded: {
    label: "Recorded",
    description: "Recorded during the original experiment; not re-measured here.",
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  },
  reported: {
    label: "Reported",
    description: "Reported by the team for a run that has not been independently verified.",
    className: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  },
  checkpoint_metadata: {
    label: "Checkpoint metadata",
    description: "Stored inside the supplied checkpoint file; not independently verified.",
    className: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  },
  measured: {
    label: "Measured now",
    description: "Measured by this running backend in the current environment.",
    className: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
  },
  unavailable: {
    label: "Not supplied",
    description: "This metric was not supplied and is not estimated or fabricated.",
    className: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  },
};

export function metricStatusMeta(status: MetricStatus | undefined): ProvenanceMeta {
  return PROVENANCE[status ?? "unavailable"] ?? PROVENANCE.unavailable;
}
