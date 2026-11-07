"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CarFront,
  Check,
  CircleAlert,
  Cpu,
  Layers,
  Radar,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AnalysisResults } from "@/components/analysis/analysis-results";
import { ModelMark } from "@/components/models/model-ui";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ImageDropzone } from "@/components/upload/image-dropzone";
import { useElapsed } from "@/hooks/use-elapsed";
import { useModels } from "@/hooks/use-models";
import { api, getErrorMessage } from "@/lib/api";
import { formatSeconds } from "@/lib/format";
import { modelAccent } from "@/lib/models";
import type { AnalyzeResponse, ModelInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function RecognitionPage() {
  const { data: modelsData, loading: modelsLoading, error: modelsError, reload } = useModels();
  const [file, setFile] = useState<File | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const initialised = useRef(false);
  const [useDetection, setUseDetection] = useState(true);
  const [detectionConfidence, setDetectionConfidence] = useState(0.35);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const elapsedMs = useElapsed(loading);

  const availableModels = modelsData?.models.filter((model) => model.available) ?? [];

  useEffect(() => {
    if (modelsData && !initialised.current) {
      setSelectedModels(
        modelsData.models.filter((model) => model.available).map((model) => model.id),
      );
      initialised.current = true;
    }
  }, [modelsData]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const toggleModel = (model: ModelInfo) => {
    if (!model.available || loading) return;
    setSelectedModels((current) =>
      current.includes(model.id)
        ? current.filter((id) => id !== model.id)
        : [...current, model.id],
    );
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError("Choose a JPG or PNG vehicle image first.");
      return;
    }
    if (!selectedModels.length) {
      setError("Select at least one classification model.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const response = await api.recognize(file, {
        models: selectedModels,
        useDetection,
        detectionConfidence,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setResult(response);
      toast.success("Analysis complete", {
        description: response.analysis_id
          ? `Saved to history as #${response.analysis_id.slice(0, 8).toUpperCase()}`
          : "Inference finished.",
      });
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (requestError) {
      if (controller.signal.aborted) return;
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(getErrorMessage(requestError));
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setResult(null);
    setError(null);
    setFile(null);
    setUseDetection(true);
    setDetectionConfidence(0.35);
  };

  const canAnalyze = Boolean(file) && selectedModels.length > 0 && !loading;

  return (
    <div ref={resultsRef} className="scroll-mt-24">
      <PageHeader
        eyebrow="Inference workspace"
        title={
          <>
            From image to <span className="text-gradient">exact vehicle specification</span>
          </>
        }
        description="YOLO11n finds vehicles, then the classifiers resolve each crop across 196 fine-grained Stanford Cars classes. Every result is persisted to local history."
        actions={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-muted-foreground">
              <ScanLine className="size-3 text-cyan-300/70" />
              YOLO11n detection
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-muted-foreground">
              <CarFront className="size-3 text-cyan-300/70" />
              196 classes
            </span>
          </>
        }
      />

      {result ? (
        <AnalysisResults result={result} onReset={reset} resetLabel="New analysis" />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-border/70 bg-card/65 p-4 panel-glow xl:sticky xl:top-[88px]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">1. Choose an image</h2>
              <span className="font-mono text-[9px] tracking-wide text-muted-foreground/45 uppercase">
                JPG · PNG
              </span>
            </div>

            <ImageDropzone
              file={file}
              onFileChange={(next) => {
                setFile(next);
                setError(null);
              }}
              disabled={loading}
            />

            <div className="my-5 h-px bg-border/60" />

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">2. Classifiers</h2>
              <button
                type="button"
                className="text-[10px] text-cyan-300/75 transition-colors hover:text-cyan-200"
                onClick={() =>
                  setSelectedModels(
                    selectedModels.length === availableModels.length
                      ? []
                      : availableModels.map((model) => model.id),
                  )
                }
                disabled={loading || !availableModels.length}
              >
                {selectedModels.length === availableModels.length ? "Clear all" : "Select all"}
              </button>
            </div>

            {modelsLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="h-[58px] animate-pulse rounded-xl border border-border/60 bg-white/[0.02]"
                  />
                ))}
              </div>
            ) : modelsError ? (
              <ErrorState message={modelsError} onRetry={reload} className="p-3" />
            ) : (
              <div className="space-y-2">
                {modelsData?.models.map((model) => {
                  const selected = selectedModels.includes(model.id);
                  const accent = modelAccent(model.id);
                  return (
                    <button
                      key={model.id}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      disabled={!model.available || loading}
                      onClick={() => toggleModel(model)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all",
                        selected
                          ? "border-cyan-400/25 bg-cyan-400/[0.045]"
                          : "border-border/65 bg-white/[0.012] hover:bg-white/[0.03]",
                        !model.available && "cursor-not-allowed opacity-45",
                      )}
                    >
                      <ModelMark modelId={model.id} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[11px] font-medium text-foreground/90">
                            {model.short_name}
                          </p>
                          {!model.available ? (
                            <span className="rounded bg-rose-400/10 px-1 py-0.5 text-[8px] text-rose-300">
                              Unavailable
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[9px] text-muted-foreground/50">
                          {model.input_size} · {model.num_classes} classes
                        </p>
                      </div>
                      <div
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                          selected
                            ? cn("border-transparent", accent.dot, "text-slate-950")
                            : "border-border/90 bg-black/20",
                        )}
                      >
                        {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="my-5 h-px bg-border/60" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-foreground">3. Detection</h2>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground/55">
                  Locate vehicles first, then classify each crop.
                </p>
              </div>
              <Switch
                checked={useDetection}
                onCheckedChange={setUseDetection}
                disabled={loading}
                aria-label="Enable vehicle detection"
              />
            </div>

            <div
              className={cn(
                "mt-3.5 rounded-xl border border-border/60 bg-white/[0.015] p-3 transition-opacity",
                !useDetection && "opacity-45",
              )}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground/70">Detector confidence</span>
                <span className="rounded border border-border/60 bg-black/25 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200/80 tabular-nums">
                  {Math.round(detectionConfidence * 100)}%
                </span>
              </div>
              <Slider
                value={detectionConfidence}
                min={0.1}
                max={0.9}
                step={0.05}
                disabled={!useDetection || loading}
                onValueChange={(value) => {
                  if (typeof value === "number") setDetectionConfidence(value);
                }}
                aria-label="Detection confidence threshold"
              />
              <p className="mt-2 text-[9px] leading-4 text-muted-foreground/45">
                {useDetection
                  ? "Lower values catch more vehicles but may include background cars."
                  : "Detection is off. The full image is classified as one vehicle."}
              </p>
            </div>

            {error ? <ErrorState message={error} className="mt-4" /> : null}

            <Button
              type="button"
              size="lg"
              className="mt-5 h-11 w-full gap-2 rounded-xl bg-gradient-to-r from-accent-grad-1 via-accent-grad-2 to-accent-grad-3 font-semibold text-on-accent shadow-[0_8px_30px_-12px_var(--shadow-action)] hover:brightness-105 disabled:opacity-45"
              onClick={handleAnalyze}
              disabled={!canAnalyze}
            >
              {loading ? (
                <>
                  <span className="size-3.5 animate-spin rounded-full border-2 border-on-accent/25 border-t-on-accent" />
                  Analyzing · {formatSeconds(elapsedMs)}
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  Analyze vehicle
                </>
              )}
            </Button>
            <p className="mt-2.5 text-center text-[9px] leading-4 text-muted-foreground/45">
              Fine-grained CPU inference can take several seconds per vehicle. The run is saved to
              history automatically.
            </p>
          </section>

          <section>
            {loading ? (
              <LoadingPanel elapsedMs={elapsedMs} modelCount={selectedModels.length} useDetection={useDetection} />
            ) : (
              <IdlePanel models={availableModels} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function IdlePanel({ models }: { models: ModelInfo[] }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/45 panel-glow">
      <div className="surface-grid pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
      <div className="relative p-5 sm:p-7">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-lg">
            <div className="mb-4 flex size-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300 cyan-glow">
              <ScanLine className="size-5" strokeWidth={1.7} />
            </div>
            <h2 className="text-xl font-medium tracking-tight text-foreground">
              A full inspection pipeline, not a single guess.
            </h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Upload a car, motorcycle, bus or truck. The system localizes each vehicle, classifies
              its exact model and compares the evidence across classical, deep learning and hybrid
              models.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {models.map((model) => {
                const accent = modelAccent(model.id);
                return (
                  <span
                    key={model.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]",
                      accent.border,
                      accent.surface,
                      accent.softText,
                    )}
                  >
                    <span className={cn("size-1 rounded-full", accent.dot)} />
                    {model.short_name}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex size-36 shrink-0 items-center justify-center self-center lg:self-start">
            <div className="relative flex size-36 items-center justify-center rounded-full border border-cyan-300/15 bg-cyan-400/[0.025]">
              <div className="absolute inset-3 rounded-full border border-dashed border-cyan-300/15" />
              <div className="absolute inset-8 rounded-full border border-cyan-300/10" />
              <Radar className="size-10 text-cyan-300/50" strokeWidth={1.2} />
              <span className="absolute top-1/2 left-1/2 h-px w-full -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
              <span className="absolute top-1/2 left-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-cyan-300/20 to-transparent" />
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          <PipelineStep
            index="01"
            icon={CarFront}
            title="Localize"
            description="YOLO11n detects car, motorcycle, bus and truck instances with annotated boxes."
          />
          <PipelineStep
            index="02"
            icon={Layers}
            title="Classify"
            description="Each crop is evaluated against 196 Stanford Cars classes using the selected models."
          />
          <PipelineStep
            index="03"
            icon={Sparkles}
            title="Compare"
            description="Top-1 agreement and confidence types are surfaced without treating scores as certainty."
          />
        </div>

        <div className="mt-5 flex flex-col gap-2.5 rounded-xl border border-border/60 bg-white/[0.015] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-[10px] leading-4 text-muted-foreground/60">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-400/60" />
            If nothing is detected, lower the threshold or switch detection off to classify the full
            frame.
          </div>
          <Link
            href="/about"
            className="flex shrink-0 items-center gap-1 text-[10px] text-cyan-300/75 transition-colors hover:text-cyan-200"
          >
            Pipeline details
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function PipelineStep({
  index,
  icon: Icon,
  title,
  description,
}: {
  index: string;
  icon: typeof CarFront;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-white/[0.018] p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-black/20 text-cyan-300/75">
          <Icon className="size-3.5" strokeWidth={1.7} />
        </div>
        <span className="font-mono text-[9px] tracking-widest text-muted-foreground/30">{index}</span>
      </div>
      <p className="mt-3 text-[11px] font-medium text-foreground/85">{title}</p>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground/55">{description}</p>
    </div>
  );
}

function LoadingPanel({
  elapsedMs,
  modelCount,
  useDetection,
}: {
  elapsedMs: number;
  modelCount: number;
  useDetection: boolean;
}) {
  return (
    <div className="flex min-h-[540px] flex-col items-center justify-center rounded-2xl border border-border/70 bg-card/45 px-6 py-12 panel-glow">
      <div className="relative flex size-36 items-center justify-center">
        <span className="absolute inset-0 animate-pulse-soft rounded-full border border-cyan-300/15" />
        <span className="absolute inset-4 rounded-full border border-dashed border-cyan-300/20" />
        <span className="absolute inset-8 rounded-full bg-cyan-400/[0.045]" />
        <Radar className="size-9 animate-pulse-soft text-cyan-300/70" strokeWidth={1.3} />
        <span className="absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent animate-scan" />
      </div>
      <p className="mt-7 font-mono text-[10px] tracking-[0.18em] text-cyan-200/60 uppercase">
        Running local inference
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {formatSeconds(elapsedMs)}
      </p>
      <p className="mt-2 max-w-sm text-center text-xs leading-5 text-muted-foreground">
        The detector{useDetection ? "" : " is bypassed"} and {modelCount} classifier
        {modelCount === 1 ? "" : "s"} are processing your image on the backend device.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/[0.02] px-2.5 py-1 text-[10px] text-muted-foreground/70">
          <Timer className="size-3 text-cyan-300/60" />
          Real elapsed time
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/[0.02] px-2.5 py-1 text-[10px] text-muted-foreground/70">
          <Cpu className="size-3 text-cyan-300/60" />
          CPU-friendly
        </span>
      </div>
      <div className="mt-8 flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2.5 text-[10px] leading-4 text-amber-200/65">
        <CircleAlert className="mt-0.5 size-3 shrink-0" />
        DINOv2 at 518 × 518 is the slowest stage. Please keep this tab open until the run completes.
      </div>
    </div>
  );
}
