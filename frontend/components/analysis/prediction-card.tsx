import { AlertCircle } from "lucide-react";
import { ModelIdentity } from "@/components/models/model-ui";
import { formatMs, formatProbability } from "@/lib/format";
import { modelAccent } from "@/lib/models";
import type { ModelPrediction } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PredictionCard({ prediction }: { prediction: ModelPrediction }) {
  const accent = modelAccent(prediction.model_id);
  const legacy = prediction.confidence_type === "decision_function";
  const calibrated = prediction.confidence_type === "calibrated";
  const probabilistic = !legacy;
  const headlineValue =
    prediction.confidence !== null ? formatProbability(prediction.confidence) : "—";

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/75 panel-glow">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b opacity-70",
          accent.gradient,
        )}
      />
      <div className="relative flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <ModelIdentity modelId={prediction.model_id} fallbackName={prediction.model_name} />
          <span
            className={cn(
              "shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[8px] tracking-[0.08em] uppercase",
              legacy
                ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                : "border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-200/80",
            )}
          >
            {calibrated ? "Calibrated" : legacy ? "Legacy" : "Softmax"}
          </span>
        </div>

        <div className="mt-5">
          <p className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground/50 uppercase">
            Top-1 prediction
          </p>
          <h3 className="mt-1.5 min-h-10 text-[15px] leading-5 font-medium text-foreground">
            {prediction.predicted_class}
          </h3>
        </div>

        <div className="mt-4 flex items-end gap-3">
          <p
            className={cn(
              "text-[28px] leading-none font-semibold tracking-tight tabular-nums",
              accent.text,
            )}
          >
            {legacy ? "—" : headlineValue}
          </p>
          <div className="mb-0.5">
            <p className="text-[10px] text-muted-foreground">
              {calibrated
                ? "calibrated probability"
                : legacy
                  ? "legacy uncalibrated record"
                  : "softmax probability"}
            </p>
            {legacy ? (
              <p className="mt-0.5 flex items-center gap-1 text-[9px] text-amber-300/70">
                <AlertCircle className="size-2.5" />
                Re-run the analysis to get calibrated probabilities
              </p>
            ) : null}
          </div>
        </div>

        {probabilistic && prediction.confidence !== null ? (
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={cn("h-full rounded-full opacity-90", accent.dot)}
              style={{ width: `${Math.max(prediction.confidence * 100, 1)}%` }}
            />
          </div>
        ) : null}

        <div className="mt-5 flex-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/50 uppercase">
              Top-5 classes
            </p>
            {probabilistic ? (
              <span className="text-[9px] text-muted-foreground/45">
                {calibrated ? "calibrated probability" : "softmax probability"}
              </span>
            ) : null}
          </div>
          <div className="space-y-2">
            {prediction.top_5.map((item) => {
              const width = probabilistic ? (item.confidence ?? 0) * 100 : 0;
              return (
                <div key={`${prediction.model_id}-${item.class_id}`}>
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="w-3 shrink-0 font-mono text-[9px] text-muted-foreground/40">
                        {item.rank}
                      </span>
                      <span
                        className={cn(
                          "truncate",
                          item.rank === 1 ? "text-foreground/90" : "text-muted-foreground/75",
                        )}
                      >
                        {item.class_name}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[9px] text-muted-foreground/60 tabular-nums">
                      {probabilistic
                        ? item.confidence !== null
                          ? `${(item.confidence * 100).toFixed(2)}%`
                          : "—"
                        : "—"}
                    </span>
                  </div>
                  {probabilistic ? (
                    <div className="mt-1 ml-[18px] h-[3px] overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className={cn("h-full rounded-full opacity-75", accent.dot)}
                        style={{ width: `${Math.max(width, 1)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 font-mono text-[9px] text-muted-foreground/45">
          <span>class #{prediction.predicted_class_id}</span>
          <span>{formatMs(prediction.inference_time_ms)} inference</span>
        </div>

        {prediction.note ? (
          <p className="mt-2.5 text-[9px] leading-4 text-muted-foreground/45">{prediction.note}</p>
        ) : null}
      </div>
    </article>
  );
}
