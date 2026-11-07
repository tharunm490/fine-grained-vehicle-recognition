import { Badge } from "@/components/ui/badge";
import { APPROACH_LABELS, metricStatusMeta, modelAccent, shortModelName } from "@/lib/models";
import type { MetricInfo, MetricStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Boxes, Cpu, Layers, Sparkles, GitMerge } from "lucide-react";

export function ModelMark({ modelId, className }: { modelId: string; className?: string }) {
  const accent = modelAccent(modelId);
  const Icon =
    modelId === "classical_svm"
      ? Cpu
      : modelId === "efficientnet_b2"
      ? Layers
      : modelId === "hybrid"
      ? GitMerge
      : Sparkles;

  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border",
        accent.surface,
        accent.border,
        accent.text,
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={1.8} />
    </div>
  );
}

export function ApproachBadge({ approachKey }: { approachKey: string }) {
  const classical = approachKey === "classical";
  const hybrid = approachKey === "hybrid";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 rounded-full border font-normal",
        classical
          ? "border-amber-400/20 bg-amber-400/[0.06] text-amber-200/80"
          : hybrid
          ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/80"
          : "border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-200/80",
      )}
    >
      {classical ? (
        <Boxes className="size-2.5" />
      ) : hybrid ? (
        <GitMerge className="size-2.5" />
      ) : (
        <Layers className="size-2.5" />
      )}
      {APPROACH_LABELS[approachKey] ?? "Model"}
    </Badge>
  );
}

export function ProvenanceBadge({
  status,
  className,
}: {
  status: MetricStatus | undefined;
  className?: string;
}) {
  const meta = metricStatusMeta(status);
  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[8px] tracking-[0.08em] uppercase",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function MetricDisplay({
  metric,
  className,
  digits = 2,
}: {
  metric: MetricInfo | undefined;
  className?: string;
  digits?: number;
}) {
  if (!metric || metric.value === null) {
    return (
      <div className={className}>
        <p className="text-2xl font-semibold text-muted-foreground/45">—</p>
        <p className="mt-1 text-[10px] text-muted-foreground/50">Not supplied</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {metric.value.toFixed(digits)}
        </p>
        <span className="text-xs text-muted-foreground">{metric.unit}</span>
      </div>
      <div className="mt-1.5">
        <ProvenanceBadge status={metric.status} />
      </div>
    </div>
  );
}

export function ModelIdentity({
  modelId,
  fallbackName,
  compact = false,
}: {
  modelId: string;
  fallbackName?: string | null;
  compact?: boolean;
}) {
  const accent = modelAccent(modelId);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ModelMark modelId={modelId} className={compact ? "size-6 rounded-md" : undefined} />
      <p className={cn("truncate text-sm font-medium", accent.softText)}>
        {shortModelName(modelId, fallbackName)}
      </p>
    </div>
  );
}
