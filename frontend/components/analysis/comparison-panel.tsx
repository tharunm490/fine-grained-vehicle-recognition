import { CheckCircle2, Info, Split } from "lucide-react";
import { modelAccent, shortModelName } from "@/lib/models";
import type { ComparisonSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ComparisonPanel({
  comparison,
  className,
  includeTop5 = false,
}: {
  comparison: ComparisonSummary;
  className?: string;
  includeTop5?: boolean;
}) {
  const rows = includeTop5
    ? comparison.rows
    : comparison.rows.filter((row) => row.metric !== "Top-5 predictions");

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/70 bg-card/60 panel-glow",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3.5">
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-lg border",
            comparison.all_agree
              ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"
              : "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
          )}
        >
          {comparison.all_agree ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Split className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">
            {comparison.all_agree
              ? "All models agree on the Top-1 class"
              : comparison.majority_class
                ? "Models disagree — majority verdict available"
                : "Models disagree — no majority verdict"}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {comparison.majority_class
              ? `Majority: ${comparison.majority_class} · ${comparison.agreeing_models.length}/${comparison.model_ids.length} models`
              : `${comparison.model_ids.length} different predictions · agreement is not proof of correctness`}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/50">
              <th className="w-[140px] px-4 py-2.5 font-mono text-[9px] font-medium tracking-[0.12em] text-muted-foreground/50 uppercase">
                Metric
              </th>
              {comparison.model_ids.map((modelId) => {
                const accent = modelAccent(modelId);
                return (
                  <th key={modelId} className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("size-1.5 rounded-full", accent.dot)} />
                      <span className={cn("text-[11px] font-medium", accent.softText)}>
                        {shortModelName(modelId, comparison.model_names[modelId])}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric} className="border-b border-border/35 last:border-0">
                <th className="px-4 py-2.5 align-top text-[10px] font-medium whitespace-nowrap text-muted-foreground/65">
                  {row.metric}
                </th>
                {comparison.model_ids.map((modelId) => (
                  <td
                    key={modelId}
                    className="max-w-[280px] px-3 py-2.5 align-top text-[11px] leading-4 text-foreground/80"
                  >
                    {row.values[modelId] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 border-t border-border/50 px-4 py-3 text-[10px] leading-4 text-muted-foreground/55">
        <Info className="mt-0.5 size-3 shrink-0 text-cyan-300/60" />
        {comparison.note}
      </div>
    </section>
  );
}
