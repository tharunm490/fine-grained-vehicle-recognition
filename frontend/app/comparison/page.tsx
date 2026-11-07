"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  GitCompare,
  Info,
  ShieldCheck,
  Timer,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AnalysisResults } from "@/components/analysis/analysis-results";
import { ApproachBadge, ModelMark } from "@/components/models/model-ui";
import { ErrorState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ImageDropzone } from "@/components/upload/image-dropzone";
import { useElapsed } from "@/hooks/use-elapsed";
import { useModels } from "@/hooks/use-models";
import { api, getErrorMessage } from "@/lib/api";
import { formatSeconds } from "@/lib/format";
import type { AnalyzeResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ComparisonPage() {
  const { data: modelsData, error: modelsError, reload } = useModels();
  const [file, setFile] = useState<File | null>(null);
  const [useDetection, setUseDetection] = useState(true);
  const [detectionConfidence, setDetectionConfidence] = useState(0.35);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const elapsedMs = useElapsed(loading);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleCompare = async () => {
    if (!file) {
      setError("Choose a JPG or PNG vehicle image first.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const response = await api.recognizeCompare(file, {
        useDetection,
        detectionConfidence,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setResult(response);
      const comparison = response.comparison;
      toast.success(
        comparison?.all_agree ? "All models agree" : "Comparison complete — models split",
        {
          description: response.analysis_id
            ? `Saved as #${response.analysis_id.slice(0, 8).toUpperCase()}`
            : "Agreement analysis is ready.",
        },
      );
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (requestError) {
      if (controller.signal.aborted) return;
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(getErrorMessage(requestError));
    } finally {
      if (abortRef.current === controller) setLoading(false);
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

  return (
    <div ref={resultsRef} className="scroll-mt-24">
      <PageHeader
        eyebrow="Cross-model evidence"
        title={
          <>
            One image. <span className="text-gradient">Three independent verdicts.</span>
          </>
        }
        description="Run the classical SVM, EfficientNet-B2 and DINOv2 on the same vehicle crop, then inspect agreement, score types and top-5 alternatives side by side."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-muted-foreground">
            <GitCompare className="size-3 text-cyan-300/70" />
            All classifiers, every run
          </span>
        }
      />

      {result ? (
        <AnalysisResults result={result} onReset={reset} resetLabel="New comparison" />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,430px)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-border/70 bg-card/65 p-4 panel-glow xl:sticky xl:top-[88px]">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-400/[0.06] font-mono text-[9px] text-cyan-200">
                01
              </span>
              <h2 className="text-sm font-medium text-foreground">Upload the same frame</h2>
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

            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-foreground">Vehicle detection</h2>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground/55">
                  When enabled, every detected vehicle is compared independently.
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
            </div>

            {error ? <ErrorState message={error} className="mt-4" /> : null}

            <Button
              type="button"
              size="lg"
              className="mt-5 h-11 w-full gap-2 rounded-xl bg-gradient-to-r from-accent-grad-1 via-accent-grad-2 to-accent-grad-3 font-semibold text-on-accent shadow-[0_8px_30px_-12px_var(--shadow-action)] hover:brightness-105 disabled:opacity-45"
              onClick={handleCompare}
              disabled={!file || loading}
            >
              {loading ? (
                <>
                  <span className="size-3.5 animate-spin rounded-full border-2 border-on-accent/25 border-t-on-accent" />
                  Comparing · {formatSeconds(elapsedMs)}
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  Compare all models
                </>
              )}
            </Button>
            <p className="mt-2.5 text-center text-[9px] leading-4 text-muted-foreground/45">
              Comparison runs the detector and all three classifiers. Expect a longer wait on CPU.
            </p>

            {!loading ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/60 bg-white/[0.015] px-3 py-2.5 text-[10px] leading-4 text-muted-foreground/55">
                <Info className="mt-0.5 size-3 shrink-0 text-cyan-300/60" />
                Agreement only means the models returned the same Top-1 label. It is not a
                correctness guarantee.
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-card/45 p-5 panel-glow">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-xl">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-300">
                    <GitCompare className="size-4.5" strokeWidth={1.7} />
                  </div>
                  <h2 className="text-xl font-medium tracking-tight text-foreground">
                    Three approaches to the same fine-grained problem.
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    The comparison deliberately mixes a handcrafted-feature SVM with two learned
                    vision models. Their failure modes differ, which makes disagreement informative.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-black/20 px-3 py-2.5">
                  <Timer className="size-4 text-cyan-300/65" />
                  <div>
                    <p className="font-mono text-[8px] tracking-wide text-muted-foreground/45 uppercase">
                      Full stack
                    </p>
                    <p className="mt-0.5 text-[11px] text-foreground/80">3 classifiers + YOLO</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {modelsData?.models.map((model) => (
                  <div
                    key={model.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/60 bg-white/[0.015] p-3.5 sm:flex-row sm:items-center"
                  >
                    <ModelMark modelId={model.id} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-foreground/90">{model.name}</p>
                        <ApproachBadge approachKey={model.approach_key} />
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-muted-foreground/55">
                        {model.description}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[9px] text-muted-foreground/45">
                        {model.input_size} · {model.num_classes} classes
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-cyan-200/55">
                        {model.approach_key === "classical" ? "score-based" : "softmax"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {modelsError ? (
                <ErrorState message={modelsError} onRetry={reload} className="mt-4" />
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <CompareCaveat
                icon={Check}
                title="What agreement means"
                text="All selected models returned the same Top-1 label for the same crop."
                tone="emerald"
              />
              <CompareCaveat
                icon={CircleAlert}
                title="Where scores differ"
                text="SVM emits sigmoid-calibrated probabilities. EfficientNet-B2 and DINOv2 emit softmax probabilities."
                tone="amber"
              />
              <CompareCaveat
                icon={ShieldCheck}
                title="What is never claimed"
                text="Calibrated probabilities are estimates, not guarantees; no fabricated confusion matrix and no guaranteed correctness."
                tone="cyan"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CompareCaveat({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: typeof Check;
  title: string;
  text: string;
  tone: "emerald" | "amber" | "cyan";
}) {
  const tones = {
    emerald: "border-emerald-400/15 bg-emerald-400/[0.035] text-emerald-300",
    amber: "border-amber-400/15 bg-amber-400/[0.035] text-amber-300",
    cyan: "border-cyan-400/15 bg-cyan-400/[0.035] text-cyan-300",
  };

  return (
    <div className={cn("rounded-xl border p-3.5", tones[tone])}>
      <Icon className="size-3.5" />
      <p className="mt-2.5 text-[11px] font-medium text-foreground/80">{title}</p>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground/55">{text}</p>
    </div>
  );
}
