"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Database,
  Info,
  RefreshCw,
  ShieldCheck,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AccuracyChart, LatencyChart, type AccuracyDatum, type LatencyDatum } from "@/components/charts/model-charts";
import { ApproachBadge, ModelMark, ProvenanceBadge } from "@/components/models/model-ui";
import { EmptyState, ErrorState, PageHeader, SectionHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { api, getErrorMessage } from "@/lib/api";
import { formatBytes, formatDate, formatMs } from "@/lib/format";
import { modelAccent, PROVENANCE, shortModelName } from "@/lib/models";
import type {
  BenchmarkResponse,
  MetricInfo,
  MetricStatus,
  ModelInfo,
  ModelsResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const METRIC_LABELS: Record<string, string> = {
  top1_accuracy: "Top-1 accuracy",
  top5_accuracy: "Top-5 accuracy",
  precision_macro: "Macro precision",
  recall_macro: "Macro recall",
  f1_macro: "Macro F1",
  val_loss: "Validation loss",
};

export default function PerformancePage() {
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResponse | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(true);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const benchmarkAbort = useRef<AbortController | null>(null);

  const retryData = () => {
    setModelsLoading(true);
    setModelsError(null);
    setBenchmarkLoading(true);
    setBenchmarkError(null);
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    api
      .models(controller.signal)
      .then((response) => {
        if (active) setModelsData(response);
      })
      .catch((requestError) => {
        if (!active || controller.signal.aborted) return;
        setModelsError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    api
      .benchmark(2, false, controller.signal)
      .then((response) => {
        if (active) setBenchmark(response);
      })
      .catch((requestError) => {
        if (!active || controller.signal.aborted) return;
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setBenchmarkError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setBenchmarkLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  const rerunBenchmark = async () => {
    benchmarkAbort.current?.abort();
    const controller = new AbortController();
    benchmarkAbort.current = controller;
    setBenchmarkLoading(true);
    setBenchmarkError(null);

    try {
      const response = await api.benchmark(2, true, controller.signal);
      setBenchmark(response);
      toast.success("Benchmark re-measured", {
        description: `Live latency on ${response.device}, ${response.iterations} iterations.`,
      });
    } catch (requestError) {
      if (controller.signal.aborted) return;
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setBenchmarkError(getErrorMessage(requestError));
    } finally {
      if (benchmarkAbort.current === controller) setBenchmarkLoading(false);
    }
  };

  const models = modelsData?.models ?? [];
  const accuracyData: AccuracyDatum[] = models.map((model) => ({
    name: shortModelName(model.id),
    top1: model.metrics.top1_accuracy?.value ?? null,
    top5: model.metrics.top5_accuracy?.value ?? null,
  }));
  const latencyData: LatencyDatum[] = (benchmark?.results ?? []).map((result) => ({
    name: shortModelName(result.model_id, models.find((m) => m.id === result.model_id)?.short_name),
    latency: result.latency_ms,
    color: modelAccent(result.model_id).chart,
  }));
  const anyAccuracy = accuracyData.some((item) => item.top1 !== null || item.top5 !== null);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Measured and reported evidence"
        title={
          <>
            Performance, with <span className="text-gradient">provenance attached.</span>
          </>
        }
        description="Accuracy figures stay attached to where they came from. Latency is measured live on the backend device. Missing metrics are shown as unavailable, never estimated."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={rerunBenchmark}
            disabled={benchmarkLoading}
            className="gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", benchmarkLoading && "animate-spin")} />
            Re-run latency
          </Button>
        }
      />

      {modelsError ? (
        <ErrorState
          message={modelsError}
          onRetry={retryData}
        />
      ) : null}

      <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow sm:p-5">
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <SectionHeader
            title="Fine-grained accuracy"
            description="DINOv2 is locally measured on 120 labelled images across four classes; other values remain reported or recorded as supplied."
            className="mb-0"
          />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/[0.02] px-2.5 py-1 text-[9px] text-muted-foreground/60">
            <BarChart3 className="size-3 text-cyan-300/70" />
            Provenance always attached
          </span>
        </div>

        <div className="mt-4">
          {modelsLoading ? (
            <div className="h-[290px] animate-pulse rounded-xl bg-white/[0.025]" />
          ) : anyAccuracy ? (
            <AccuracyChart data={accuracyData} />
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No accuracy metrics supplied"
              description="The model metadata did not include accuracy figures, so no chart or estimate is shown."
              className="border-0 bg-transparent"
            />
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {modelsLoading
          ? [0, 1, 2].map((index) => (
              <div key={index} className="h-[320px] animate-pulse rounded-2xl border border-border/60 bg-card/40" />
            ))
          : models.map((model) => <ModelMetricCard key={model.id} model={model} />)}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(310px,0.85fr)]">
        <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              title="Live inference latency"
              description="Measured by this backend on a synthetic image. Does not measure network or browser time."
              className="mb-0"
            />
            <div className="flex items-center gap-1.5">
              <ProvenanceBadge status="measured" />
              {benchmark ? (
                <span className="rounded border border-border/60 bg-black/20 px-1.5 py-0.5 font-mono text-[8px] tracking-wide text-muted-foreground/55 uppercase">
                  {benchmark.iterations} iterations · {benchmark.device}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-3">
            {benchmarkLoading && !benchmark ? (
              <div className="h-[240px] animate-pulse rounded-xl bg-white/[0.025]" />
            ) : benchmarkError ? (
              <ErrorState message={benchmarkError} onRetry={rerunBenchmark} />
            ) : latencyData.length ? (
              <LatencyChart data={latencyData} />
            ) : (
              <EmptyState
                icon={Timer}
                title="Latency unavailable"
                description="No benchmark results were returned by the backend."
                className="border-0 bg-transparent"
              />
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[9px] text-muted-foreground/45">
            <span>
              {benchmark
                ? `Measured ${formatDate(benchmark.measured_at)}`
                : "Waiting for benchmark result"}
            </span>
            <span className="flex items-center gap-1">
              <Info className="size-3" />
              Lower raw latency is not higher accuracy
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-emerald-300/70" />
            <h2 className="text-sm font-medium text-foreground">Provenance legend</h2>
          </div>
          <div className="space-y-2.5">
            {(Object.keys(PROVENANCE) as MetricStatus[]).map((status) => {
              const meta = PROVENANCE[status];
              return (
                <div key={status} className="rounded-xl border border-border/60 bg-white/[0.015] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <ProvenanceBadge status={status} />
                    <span className="font-mono text-[8px] text-muted-foreground/35 uppercase">
                      {status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[9px] leading-4 text-muted-foreground/55">
                    {meta.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
        <section className="rounded-2xl border border-border/70 bg-card/55 panel-glow">
          <div className="border-b border-border/60 px-4 py-3.5">
            <SectionHeader
              title="Checkpoint and architecture facts"
              description="Loaded from the model registry in the running backend."
              className="mb-0"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-4 py-2.5 font-mono text-[8px] font-medium tracking-[0.1em] text-muted-foreground/45 uppercase">
                    Model
                  </th>
                  <th className="px-3 py-2.5 font-mono text-[8px] font-medium tracking-[0.1em] text-muted-foreground/45 uppercase">
                    Input
                  </th>
                  <th className="px-3 py-2.5 font-mono text-[8px] font-medium tracking-[0.1em] text-muted-foreground/45 uppercase">
                    Params
                  </th>
                  <th className="px-3 py-2.5 font-mono text-[8px] font-medium tracking-[0.1em] text-muted-foreground/45 uppercase">
                    Checkpoint
                  </th>
                  <th className="px-3 py-2.5 font-mono text-[8px] font-medium tracking-[0.1em] text-muted-foreground/45 uppercase">
                    Load time
                  </th>
                  <th className="px-4 py-2.5 font-mono text-[8px] font-medium tracking-[0.1em] text-muted-foreground/45 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr key={model.id} className="border-b border-border/35 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ModelMark modelId={model.id} className="size-7 rounded-md" />
                        <div>
                          <p className="text-[10px] font-medium text-foreground/85">{model.short_name}</p>
                          <p className="mt-0.5 text-[8px] text-muted-foreground/45">
                            {model.framework}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[9px] text-muted-foreground/65">
                      {model.input_size}
                    </td>
                    <td className="px-3 py-3 text-[9px] text-muted-foreground/65">
                      {model.parameters ?? "—"}
                    </td>
                    <td className="max-w-[230px] px-3 py-3">
                      <p className="truncate font-mono text-[9px] text-muted-foreground/65">
                        {model.checkpoint_filename}
                      </p>
                      <p className="mt-0.5 font-mono text-[8px] text-muted-foreground/35">
                        {formatBytes(model.checkpoint_size_bytes)}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-mono text-[9px] text-muted-foreground/65">
                      {formatMs(model.load_time_ms)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px]",
                          model.available
                            ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
                            : "border-rose-400/20 bg-rose-400/[0.06] text-rose-300",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1 rounded-full",
                            model.available ? "bg-emerald-400" : "bg-rose-400",
                          )}
                        />
                        {model.available ? "Loaded" : "Unavailable"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow">
            <div className="flex items-center gap-2">
              <Database className="size-3.5 text-cyan-300/70" />
              <h2 className="text-sm font-medium text-foreground">Optional evaluation</h2>
            </div>
            <div
              className={cn(
                "mt-3 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[10px]",
                modelsData?.evaluation_available
                  ? "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300"
                  : "border-amber-400/20 bg-amber-400/[0.05] text-amber-200/80",
              )}
            >
              {modelsData?.evaluation_available ? (
                <CheckCircle2 className="size-3.5 shrink-0" />
              ) : (
                <TriangleAlert className="size-3.5 shrink-0" />
              )}
              {modelsData?.evaluation_available
                ? "Evaluation dataset is configured."
                : "Evaluation dataset is not configured in this environment."}
            </div>
            <p className="mt-3 text-[10px] leading-4 text-muted-foreground/55">
              The backend can measure Top-1/Top-5 on a labelled Stanford Cars directory when
              <code className="mx-1 rounded bg-black/25 px-1 py-0.5 font-mono text-[9px] text-cyan-200/70">
                EVAL_DATASET_DIR
              </code>
              is set. No confusion matrix is displayed because per-class predictions were not
              supplied for experimentation.
            </p>
            <div className="mt-3 rounded-lg border border-border/60 bg-white/[0.015] p-2.5 font-mono text-[8px] leading-4 text-muted-foreground/45">
              EVAL_DATASET_DIR/&lt;class_name&gt;/*.jpg
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-3.5 text-amber-300/70" />
              <h2 className="text-sm font-medium text-foreground">Reading these numbers</h2>
            </div>
            <ul className="mt-3 space-y-2.5 text-[10px] leading-4 text-muted-foreground/55">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-cyan-300/60" />
                SVM probabilities are sigmoid-calibrated on the training split, so they are
                estimates rather than guarantees. Accuracy is low because the 2,807 handcrafted
                features are weaker than learned representations.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-violet-300/60" />
                DINOv2 measured 93.33% top-1 and 98.33% top-5 on 120 labelled images across
                four classes. This is not a full 196-class test score; the checkpoint metadata
                separately reports 94.35% on its original split.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-300/60" />
                EfficientNet-B2&apos;s reported figures refer to a fine-tuned run; checkpoint
                equivalence is not independently established.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-300/60" />
                Latency depends heavily on CPU/GPU, image size, number of detections and thread
                contention. Treat it as an environment-specific measurement.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function ModelMetricCard({ model }: { model: ModelInfo }) {
  const accent = modelAccent(model.id);
  const top1 = model.metrics.top1_accuracy;
  const top5 = model.metrics.top5_accuracy;
  const extraMetrics = Object.entries(model.metrics).filter(
    ([key]) => !["top1_accuracy", "top5_accuracy"].includes(key),
  );

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b opacity-60",
          accent.gradient,
        )}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <ModelMark modelId={model.id} />
            <div>
              <p className="text-xs font-medium text-foreground">{model.short_name}</p>
              <p className="mt-0.5 text-[9px] text-muted-foreground/45">{model.input_size}</p>
            </div>
          </div>
          <ApproachBadge approachKey={model.approach_key} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <MetricBlock label="Top-1 accuracy" metric={top1} accentClass={accent.text} />
          <MetricBlock label="Top-5 accuracy" metric={top5} accentClass={accent.text} />
        </div>

        {extraMetrics.length ? (
          <div className="mt-4 space-y-1.5 border-t border-border/50 pt-3">
            {extraMetrics.map(([key, metric]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-muted-foreground/55">
                  {METRIC_LABELS[key] ?? key.replaceAll("_", " ")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[9px] text-foreground/75 tabular-nums">
                    {metric.value === null
                      ? "—"
                      : `${metric.value.toFixed(2)}${metric.unit}`}
                  </span>
                  <ProvenanceBadge status={metric.status} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 border-t border-border/50 pt-3 text-[9px] text-muted-foreground/35">
            No additional metrics supplied.
          </div>
        )}

        <div className="mt-4 rounded-lg border border-border/50 bg-black/15 px-2.5 py-2">
          <p className="font-mono text-[8px] tracking-wide text-muted-foreground/35 uppercase">Source</p>
          <p className="mt-1 line-clamp-3 text-[9px] leading-4 text-muted-foreground/50">
            {top1?.source ?? "No source supplied."}
          </p>
        </div>

        {model.notes.length ? (
          <p className="mt-2.5 line-clamp-2 text-[9px] leading-4 text-muted-foreground/40">
            {model.notes[0]}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function MetricBlock({
  label,
  metric,
  accentClass,
}: {
  label: string;
  metric: MetricInfo | undefined;
  accentClass: string;
}) {
  return (
    <div>
      <p className="font-mono text-[8px] tracking-[0.1em] text-muted-foreground/40 uppercase">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={cn("text-lg font-semibold tabular-nums", accentClass)}>
          {metric?.value !== null && metric?.value !== undefined ? metric.value.toFixed(2) : "—"}
        </span>
        <span className="text-[9px] text-muted-foreground/50">
          {metric?.value !== null && metric?.value !== undefined ? metric.unit || "" : "not supplied"}
        </span>
      </div>
      <div className="mt-1.5">
        <ProvenanceBadge status={metric?.status} />
      </div>
    </div>
  );
}
