"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  CarFront,
  CheckCircle2,
  Clock3,
  ImageIcon,
  Info,
  Layers,
  Loader2,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import { ComparisonPanel } from "@/components/analysis/comparison-panel";
import { PredictionCard } from "@/components/analysis/prediction-card";
import { ApproachBadge, ModelMark } from "@/components/models/model-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, apiUrl, getErrorMessage } from "@/lib/api";
import {
  formatDate,
  formatMs,
  formatProbability,
} from "@/lib/format";
import { shortModelName } from "@/lib/models";
import type { HistoryDetailResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HistoryDetailDialog({
  analysisId,
  onClose,
}: {
  analysisId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<HistoryDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeVehicle, setActiveVehicle] = useState(0);
  const [imageMode, setImageMode] = useState<"annotated" | "original">("original");
  const [reloadKey, setReloadKey] = useState(0);

  const retryDetail = () => {
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    api
      .historyDetail(analysisId, controller.signal)
      .then((response) => {
        if (!active) return;
        setDetail(response);
        setImageMode(response.use_detection ? "annotated" : "original");
      })
      .catch((requestError) => {
        if (!active || controller.signal.aborted) return;
        setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [analysisId, reloadKey]);

  const vehicle = detail?.vehicles[activeVehicle];
  const imageUrl = detail
    ? apiUrl(
        imageMode === "annotated" && detail.use_detection
          ? detail.annotated_image_url
          : detail.image_url,
      )
    : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto p-0 sm:max-w-6xl">
        <DialogHeader className="sticky top-0 z-10 gap-0 border-b border-border/70 bg-popover/95 px-5 py-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-300">
                  <ScanLine className="size-3.5" />
                </span>
                <DialogTitle className="text-sm font-medium">
                  Analysis #{analysisId.slice(0, 8).toUpperCase()}
                </DialogTitle>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[8px] font-medium text-emerald-300">
                  <CheckCircle2 className="size-2.5" />
                  Persisted
                </span>
              </div>
              <DialogDescription className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                <span className="flex items-center gap-1">
                  <CalendarClock className="size-3" />
                  {detail ? formatDate(detail.created_at) : "Loading timestamp"}
                </span>
                {detail ? (
                  <>
                    <span className="flex items-center gap-1">
                      <Clock3 className="size-3" />
                      {formatMs(detail.inference_time_ms)} visible inference
                    </span>
                    <span className="truncate font-mono">{detail.filename}</span>
                  </>
                ) : null}
              </DialogDescription>
            </div>
            {detail ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {detail.model_ids.map((modelId) => (
                  <span
                    key={modelId}
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/[0.02] px-1.5 py-0.5 text-[9px] text-muted-foreground/65"
                  >
                    <ModelMark modelId={modelId} className="size-3.5 rounded-sm border-0 bg-transparent p-0" />
                    {shortModelName(modelId)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3">
              <Loader2 className="size-5 animate-spin text-cyan-300" />
              <p className="text-xs text-muted-foreground">Loading saved analysis…</p>
            </div>
          ) : error || !detail ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.045] p-5 text-center">
              <p className="text-sm text-rose-200">{error ?? "Analysis not found."}</p>
              <button
                type="button"
                onClick={retryDetail}
                className="mt-3 rounded-lg border border-rose-400/25 px-3 py-1.5 text-[11px] text-rose-200 transition-colors hover:bg-rose-400/10"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
                <div className="overflow-hidden rounded-xl border border-border/70 bg-media/25">
                  <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="size-3 text-cyan-300/60" />
                      <span className="text-[10px] font-medium text-foreground/80">Saved frame</span>
                    </div>
                    {detail.use_detection ? (
                      <div className="flex rounded-md border border-border/70 bg-black/20 p-0.5">
                        <button
                          type="button"
                          onClick={() => setImageMode("annotated")}
                          className={cn(
                            "rounded px-2 py-0.5 text-[9px] transition-colors",
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
                            "rounded px-2 py-0.5 text-[9px] transition-colors",
                            imageMode === "original"
                              ? "bg-white/[0.08] text-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          Original
                        </button>
                      </div>
                    ) : (
                      <span className="font-mono text-[8px] tracking-wide text-muted-foreground/45 uppercase">
                        Classification-only
                      </span>
                    )}
                  </div>
                  <div className="flex min-h-[220px] items-center justify-center bg-media">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt="Saved vehicle analysis"
                        className="max-h-[440px] w-full object-contain"
                        onError={() => setImageMode("original")}
                      />
                    ) : (
                      <ImageIcon className="size-6 text-muted-foreground/35" />
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-white/[0.015] p-3.5">
                  <div className="flex items-center gap-1.5">
                    <Layers className="size-3.5 text-cyan-300/65" />
                    <p className="text-[11px] font-medium text-foreground/85">Run details</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <DetailStat label="Predicted vehicle" value={detail.predicted_vehicle ?? "—"} wide />
                    <DetailStat label="Detections" value={String(detail.detection_count)} />
                    <DetailStat label="Top model" value={detail.top_model ?? "—"} />
                    <DetailStat
                      label="Score"
                      value={
                        detail.confidence !== null
                          ? formatProbability(detail.confidence)
                          : detail.confidence_type === "decision_function"
                            ? "Uncalibrated"
                            : "—"
                      }
                    />
                  </div>

                  {detail.vehicles.length ? (
                    <div className="mt-4">
                      <p className="font-mono text-[8px] tracking-[0.12em] text-muted-foreground/40 uppercase">
                        Vehicles
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {detail.vehicles.map((item, index) => (
                          <button
                            key={item.vehicle_id}
                            type="button"
                            onClick={() => setActiveVehicle(index)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg border p-1.5 text-left transition-colors",
                              index === activeVehicle
                                ? "border-cyan-400/25 bg-cyan-400/[0.05]"
                                : "border-border/60 hover:bg-white/[0.03]",
                            )}
                          >
                            <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-media/25">
                              {item.crop_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={apiUrl(item.crop_url)} alt="" className="size-full object-cover" />
                              ) : (
                                <CarFront className="size-3 text-muted-foreground/45" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[10px] text-foreground/80">{item.label}</p>
                              <p className="mt-0.5 text-[8px] text-muted-foreground/45">
                                {item.predictions.length} model
                                {item.predictions.length === 1 ? "" : "s"}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {detail.warnings.length ? (
                    <div className="mt-3 space-y-1.5">
                      {detail.warnings.map((warning) => (
                        <div
                          key={warning}
                          className="flex items-start gap-1.5 rounded-md border border-amber-400/15 bg-amber-400/[0.04] p-2 text-[9px] leading-4 text-amber-200/65"
                        >
                          <TriangleAlert className="mt-0.5 size-2.5 shrink-0" />
                          {warning}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-start gap-1.5 rounded-md bg-white/[0.02] p-2 text-[8px] leading-4 text-muted-foreground/45">
                    <Info className="mt-0.5 size-2.5 shrink-0 text-cyan-300/50" />
                    Stored predictions are immutable. Re-running the same image can produce
                    different detections or scores.
                  </div>
                </div>
              </div>

              {vehicle ? (
                <div>
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-medium text-foreground">Classifier outputs</h3>
                      <p className="mt-0.5 text-[9px] text-muted-foreground/50">{vehicle.label}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {vehicle.predictions.map((prediction) => (
                        <span
                          key={prediction.model_id}
                          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/[0.02] px-1.5 py-0.5 text-[8px] text-muted-foreground/60"
                        >
                          <ModelMark modelId={prediction.model_id} className="size-3 rounded-sm border-0 bg-transparent p-0" />
                          {prediction.model_name}
                          <ApproachBadge approachKey={prediction.approach.includes("Classical") ? "classical" : "deep_learning"} />
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {vehicle.predictions.map((prediction) => (
                      <PredictionCard key={prediction.model_id} prediction={prediction} />
                    ))}
                  </div>

                  {vehicle.comparison ? (
                    <div className="mt-4">
                      <ComparisonPanel comparison={vehicle.comparison} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailStat({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <p className="font-mono text-[7px] tracking-[0.1em] text-muted-foreground/35 uppercase">
        {label}
      </p>
      <p className="mt-1 text-[10px] leading-4 font-medium text-foreground/80">{value}</p>
    </div>
  );
}
