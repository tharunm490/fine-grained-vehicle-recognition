"use client";

import { useRef, useState } from "react";
import { ArrowDown, GitMerge, Info } from "lucide-react";
import { AnalysisResults } from "@/components/analysis/analysis-results";
import { ErrorState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ImageDropzone } from "@/components/upload/image-dropzone";
import { api, getErrorMessage } from "@/lib/api";
import type { AnalyzeResponse } from "@/lib/types";

const STEPS = [
  "Input vehicle image",
  "YOLO vehicle detection",
  "EfficientNet-B2 + DINOv2 prediction",
  "Confidence / prediction selection",
  "Hybrid Feature Fusion result",
];

export default function HybridPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runHybrid = async () => {
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
      setResult(await api.hybridPredict(file, { signal: controller.signal }));
    } catch (requestError) {
      if (!controller.signal.aborted) setError(getErrorMessage(requestError));
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  if (result) {
    return <AnalysisResults result={result} onReset={() => setResult(null)} resetLabel="New analysis" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approach 3"
        title={<>Hybrid <span className="text-gradient">Vehicle Recognition</span></>}
        description="Hybrid prediction selection using the strongest valid confidence from the existing deep-learning models."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/25 bg-orange-400/[0.06] px-2.5 py-1.5 text-[10px] text-orange-200">
            <GitMerge className="size-3" /> Existing model outputs
          </span>
        }
      />

      <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow sm:p-5">
        <h2 className="text-sm font-medium text-foreground">Hybrid architecture</h2>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {STEPS.map((step, index) => (
            <div key={step} className="flex items-center gap-2">
              <span className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2 text-center text-[10px] text-emerald-100">
                {step}
              </span>
              {index < STEPS.length - 1 ? <ArrowDown className="size-3 rotate-[-90deg] text-muted-foreground/50" /> : null}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[10px] text-muted-foreground/60">
          Classical CV runs as an additional comparison/reference branch.
        </p>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,430px)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border/70 bg-card/65 p-4 panel-glow">
          <h2 className="text-sm font-medium text-foreground">Run hybrid selection</h2>
          <ImageDropzone file={file} onFileChange={(next) => { setFile(next); setError(null); }} disabled={loading} />
          {error ? <ErrorState message={error} className="mt-4" /> : null}
          <Button className="mt-4 w-full" onClick={runHybrid} disabled={!file || loading}>
            {loading ? "Running models…" : "Run Hybrid Selection"}
          </Button>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Info className="size-3.5 text-cyan-300/70" /> Implementation status
          </h2>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground/70">
            The selected class is always an actual prediction from an available existing
            deep-learning model.
          </p>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground/70">
            Original planned implementation: DINOv2 embeddings + HOG + LBP + HSV feature-level
            fusion followed by a separate RBF SVM classifier. That model has not been trained.
          </p>
        </section>
      </div>
    </div>
  );
}
