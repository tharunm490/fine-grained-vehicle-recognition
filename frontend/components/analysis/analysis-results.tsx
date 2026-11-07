"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CarFront,
  CheckCircle2,
  Clock3,
  History,
  ImageIcon,
  Info,
  Layers,
  RotateCcw,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import { ComparisonPanel } from "@/components/analysis/comparison-panel";
import { PredictionCard } from "@/components/analysis/prediction-card";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { formatMs, formatProbability } from "@/lib/format";
import { modelAccent } from "@/lib/models";
import type { AnalyzeResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AnalysisResultsProps {
  result: AnalyzeResponse;
  onReset?: () => void;
  resetLabel?: string;
}

export function AnalysisResults({ result, onReset, resetLabel = "New analysis" }: AnalysisResultsProps) {
  const [activeVehicle, setActiveVehicle] = useState(0);
  const [imageMode, setImageMode] = useState<"annotated" | "original">(
    result.image.annotated_image ? "annotated" : "original",
  );

  const vehicle = result.vehicles[activeVehicle];
  const annotatedAvailable = Boolean(result.image.annotated_image);
  const shownImage =
    imageMode === "annotated" && result.image.annotated_image
      ? result.image.annotated_image
      : result.image.original_image;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-medium text-emerald-300">
            <CheckCircle2 className="size-3" />
            Analysis complete
          </span>
          {result.analysis_id ? (
            <span className="rounded-full border border-border/70 bg-white/[0.02] px-2.5 py-1 font-mono text-[9px] tracking-wide text-muted-foreground/70">
              #{result.analysis_id.slice(0, 8).toUpperCase()}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/[0.02] px-2.5 py-1 font-mono text-[9px] tracking-wide text-muted-foreground/60 uppercase">
            <Clock3 className="size-3 text-cyan-300/70" />
            {formatMs(result.total_time_ms)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {result.analysis_id ? (
            <Link
              href="/history"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <History className="size-3.5" />
              History
            </Link>
          ) : null}
          {onReset ? (
            <Button variant="secondary" size="sm" onClick={onReset} className="gap-1.5">
              <RotateCcw className="size-3.5" />
              {resetLabel}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 panel-glow">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-3.5 text-cyan-300/70" />
              <p className="text-xs font-medium text-foreground">Input frame</p>
              <span className="font-mono text-[9px] text-muted-foreground/45">
                {result.image.width} × {result.image.height}
              </span>
            </div>
            <div className="flex rounded-lg border border-border/70 bg-black/20 p-0.5">
              <button
                type="button"
                disabled={!annotatedAvailable}
                onClick={() => setImageMode("annotated")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                  imageMode === "annotated"
                    ? "bg-white/[0.08] text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Annotated
              </button>
              <button
                type="button"
                onClick={() => setImageMode("original")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors",
                  imageMode === "original"
                    ? "bg-white/[0.08] text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Original
              </button>
            </div>
          </div>

          <div className="relative flex min-h-[260px] items-center justify-center bg-media">
            {shownImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shownImage}
                  alt={
                    imageMode === "annotated"
                      ? "Uploaded image with vehicle detections"
                      : "Uploaded vehicle image"
                  }
                  className="max-h-[560px] w-full object-contain"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-media/80 to-transparent px-4 pt-14 pb-3">
                  <p className="truncate font-mono text-[9px] text-on-media/55">
                    {result.image.filename}
                  </p>
                  <span className="shrink-0 rounded-full border border-on-media/10 bg-media/30 px-2 py-0.5 font-mono text-[8px] tracking-wide text-on-media/60 uppercase backdrop-blur">
                    {result.detection_time_ms > 0
                      ? `${result.detections.length} detection${result.detections.length === 1 ? "" : "s"}`
                      : "No detector"}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground/45">
                <ImageIcon className="size-6" />
                <p className="text-xs">Image preview unavailable</p>
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-border/70 bg-card/60 panel-glow">
          <div className="border-b border-border/60 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <ScanLine className="size-3.5 text-cyan-300/70" />
              <p className="text-xs font-medium text-foreground">Run summary</p>
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-3">
              <SummaryStat label="Total time" value={formatMs(result.total_time_ms)} />
              <SummaryStat
                label="Detection"
                value={result.detection_time_ms > 0 ? formatMs(result.detection_time_ms) : "Bypassed"}
              />
              <SummaryStat label="Detections" value={String(result.detections.length)} />
              <SummaryStat
                label="Models run"
                value={String(vehicle?.predictions.length ?? 0)}
              />
            </div>
          </div>

          <div className="flex-1 px-4 py-4">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/50 uppercase">
                Vehicle results
              </p>
              <span className="text-[9px] text-muted-foreground/45">
                {result.vehicles.length} detected
              </span>
            </div>

            {result.vehicles.length ? (
              <div className="space-y-1.5">
                {result.vehicles.map((item, index) => (
                  <button
                    key={item.vehicle_id}
                    type="button"
                    onClick={() => setActiveVehicle(index)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-colors",
                      index === activeVehicle
                        ? "border-cyan-400/25 bg-cyan-400/[0.055]"
                        : "border-border/60 bg-white/[0.012] hover:bg-white/[0.035]",
                    )}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-media/30">
                      {item.crop_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.crop_image}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <CarFront className="size-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-foreground/90">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-[9px] text-muted-foreground/50">
                        {item.detection
                          ? `${item.detection.detection_class} · ${formatProbability(item.detection.detection_confidence)} detector confidence`
                          : "Classification-only crop"}
                      </p>
                    </div>
                    {index === activeVehicle ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-cyan-300" />
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/80 p-4 text-center">
                <CarFront className="mx-auto size-5 text-muted-foreground/40" />
                <p className="mt-2 text-[11px] text-muted-foreground">No vehicles were detected.</p>
                <p className="mt-1 text-[9px] leading-4 text-muted-foreground/50">
                  Lower the detection threshold or disable detection to classify the full frame.
                </p>
              </div>
            )}

            {result.warnings.length ? (
              <div className="mt-3 space-y-2">
                {result.warnings.map((warning) => (
                  <div
                    key={warning}
                    className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-2.5 py-2 text-[10px] leading-4 text-amber-200/75"
                  >
                    <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                    {warning}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/60 bg-white/[0.015] p-3 text-[10px] leading-4 text-muted-foreground/60">
              <Info className="mt-0.5 size-3 shrink-0 text-cyan-300/60" />
              <span>
                Confidence reflects model output only. It does not certify that a fine-grained
                prediction is correct.
              </span>
            </div>
          </div>
        </section>
      </div>

      {vehicle ? (
        <div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="size-3.5 text-cyan-300/70" />
                <h2 className="text-sm font-medium text-foreground">Classifier outputs</h2>
              </div>
              <p className="mt-1 pl-[22px] text-[11px] text-muted-foreground">
                {vehicle.label} · top-5 fine-grained classes per model
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {vehicle.predictions.map((prediction) => {
                const accent = modelAccent(prediction.model_id);
                return (
                  <span
                    key={prediction.model_id}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px]",
                      accent.border,
                      accent.surface,
                      accent.softText,
                    )}
                  >
                    <span className={cn("size-1 rounded-full", accent.dot)} />
                    {prediction.model_name}
                  </span>
                );
              })}
            </div>
          </div>

          {vehicle.predictions.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {vehicle.predictions.map((prediction) => (
                <PredictionCard key={prediction.model_id} prediction={prediction} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
              No classifier predictions were returned for this vehicle.
            </div>
          )}

          {vehicle.comparison ? (
            <div className="mt-5">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">Agreement analysis</h2>
                <Link
                  href="/comparison"
                  className="flex items-center gap-1 text-[10px] text-cyan-300/80 transition-colors hover:text-cyan-200"
                >
                  Full comparison workspace
                  <ArrowRight className="size-3" />
                </Link>
              </div>
              <ComparisonPanel comparison={vehicle.comparison} />
            </div>
          ) : (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-border/70 bg-white/[0.018] px-3.5 py-3 text-[10px] leading-4 text-muted-foreground/60">
              <Info className="mt-0.5 size-3 shrink-0 text-cyan-300/60" />
              Select at least two models to generate an agreement analysis.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[8px] tracking-[0.12em] text-muted-foreground/45 uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground/90 tabular-nums">{value}</p>
    </div>
  );
}
