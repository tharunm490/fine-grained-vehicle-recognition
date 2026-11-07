"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Clock3,
  Database,
  Eye,
  History,
  ImageIcon,
  Info,
  Layers,
  RefreshCw,
  ScanLine,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { HistoryDetailDialog } from "@/components/history/history-detail-dialog";
import { ModelMark } from "@/components/models/model-ui";
import { EmptyState, ErrorState, PageHeader } from "@/components/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModels } from "@/hooks/use-models";
import { api, apiUrl, getErrorMessage } from "@/lib/api";
import {
  formatDate,
  formatMs,
  formatProbability,
  formatRelative,
} from "@/lib/format";
import { modelAccent, shortModelName } from "@/lib/models";
import type { HistoryListResponse, HistoryStatsResponse, HistorySummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 9;

export default function HistoryPage() {
  const { data: modelsData } = useModels();
  const [history, setHistory] = useState<HistoryListResponse | null>(null);
  const [stats, setStats] = useState<HistoryStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modelFilter, setModelFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<HistorySummary | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    Promise.all([
      api.history(
        {
          limit: PAGE_SIZE,
          offset,
          model: modelFilter === "all" ? undefined : modelFilter,
        },
        controller.signal,
      ),
      api.historyStats(controller.signal),
    ])
      .then(([list, summary]) => {
        if (!active) return;
        setHistory(list);
        setStats(summary);
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
  }, [offset, modelFilter, reloadKey]);

  const models = modelsData?.models ?? [];
  const items = history?.items ?? [];
  const total = history?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const lastModel = stats
    ? Object.entries(stats.by_model).sort((a, b) => b[1] - a[1])[0]
    : undefined;

  const reloadHistory = () => {
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  };

  const changeModelFilter = (value: string) => {
    if (value === modelFilter) return;
    setLoading(true);
    setError(null);
    setModelFilter(value);
    setOffset(0);
  };

  const goToOffset = (nextOffset: number) => {
    if (nextOffset === offset) return;
    setLoading(true);
    setError(null);
    setOffset(nextOffset);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setMutating(true);
    try {
      await api.deleteHistory(deleteTarget.id);
      toast.success("Analysis deleted", {
        description: `#${deleteTarget.id.slice(0, 8).toUpperCase()} and its stored images were removed.`,
      });
      setDeleteTarget(null);
      if (items.length === 1 && offset > 0) {
        goToOffset(Math.max(0, offset - PAGE_SIZE));
      } else {
        reloadHistory();
      }
    } catch (requestError) {
      toast.error("Delete failed", { description: getErrorMessage(requestError) });
    } finally {
      setMutating(false);
    }
  };

  const handleClear = async () => {
    setMutating(true);
    try {
      const response = await api.clearHistory();
      toast.success("History cleared", {
        description: `${response.deleted_count} analys${response.deleted_count === 1 ? "is" : "es"} and associated files removed.`,
      });
      setClearOpen(false);
      setOffset(0);
      reloadHistory();
    } catch (requestError) {
      toast.error("Could not clear history", { description: getErrorMessage(requestError) });
    } finally {
      setMutating(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Local audit trail"
        title={
          <>
            Every run, <span className="text-gradient">remembered locally.</span>
          </>
        }
        description="Analyses, crops, annotations and comparison results persist in SQLite. Inspect any saved run, or remove records and their image files from the backend."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={reloadHistory}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setClearOpen(true)}
              disabled={!total || mutating}
              className="gap-1.5"
            >
              <Trash2 className="size-3.5" />
              Clear history
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HistoryStat
          icon={History}
          label="Saved analyses"
          value={loading && !stats ? "—" : String(stats?.total_analyses ?? 0)}
          detail={total !== stats?.total_analyses ? `${total} in current filter` : "SQLite history"}
          tone="cyan"
        />
        <HistoryStat
          icon={ScanLine}
          label="Runs with detection"
          value={loading && !stats ? "—" : String(stats?.analyses_with_detection ?? 0)}
          detail="YOLO localization was enabled"
          tone="blue"
        />
        <HistoryStat
          icon={Clock3}
          label="Last analysis"
          value={
            stats?.last_analysis_at
              ? formatRelative(stats.last_analysis_at)
              : loading
                ? "—"
                : "None"
          }
          detail={stats?.last_analysis_at ? formatDate(stats.last_analysis_at) : "No saved runs"}
          tone="violet"
        />
        <HistoryStat
          icon={Layers}
          label="Most used model"
          value={lastModel ? shortModelName(lastModel[0]) : loading ? "—" : "None"}
          detail={lastModel ? `${lastModel[1]} saved run${lastModel[1] === 1 ? "" : "s"}` : "No model usage yet"}
          tone="amber"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/55 panel-glow">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-3.5 text-cyan-300/65" />
            <h2 className="text-xs font-medium text-foreground">Stored analyses</h2>
            <span className="rounded-full border border-border/60 bg-black/20 px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground/55">
              {total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {modelFilter !== "all" ? (
              <button
                type="button"
                onClick={() => changeModelFilter("all")}
                className="flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-1 text-[9px] text-cyan-200/80"
              >
                {shortModelName(modelFilter)}
                <X className="size-2.5" />
              </button>
            ) : null}
            <Select
              value={modelFilter}
              onValueChange={(value) => {
                if (typeof value === "string") changeModelFilter(value);
              }}
            >
              <SelectTrigger size="sm" className="w-[170px] bg-black/20 text-[10px]">
                <SelectValue placeholder="All models" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All models</SelectItem>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.short_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorState
              message={error}
              onRetry={reloadHistory}
            />
          </div>
        ) : loading && !history ? (
          <div className="space-y-1.5 p-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-3 rounded-xl p-2.5">
                <div className="size-14 rounded-lg bg-white/[0.04]" />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 w-1/3 rounded bg-white/[0.05]" />
                  <div className="h-2 w-1/2 rounded bg-white/[0.035]" />
                </div>
                <div className="h-6 w-16 rounded bg-white/[0.035]" />
              </div>
            ))}
          </div>
        ) : items.length ? (
          <div className={cn("divide-y divide-border/35 transition-opacity", loading && "opacity-55")}>
            {items.map((item) => {
              const topModel = models.find((model) => model.name === item.top_model);
              const topModelId = topModel?.id ?? item.model_ids[0] ?? "";
              const accent = modelAccent(topModelId);
              return (
                <div
                  key={item.id}
                  className="group flex flex-col gap-3 px-3.5 py-3 transition-colors hover:bg-white/[0.018] sm:flex-row sm:items-center"
                >
                  <button
                    type="button"
                    onClick={() => setDetailId(item.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-media/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={apiUrl(item.thumbnail_url)}
                        alt=""
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {item.use_detection ? (
                        <span className="absolute right-0.5 bottom-0.5 rounded bg-media/70 px-1 py-0.5 font-mono text-[7px] text-on-media/80 backdrop-blur">
                          {item.detection_count}
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[11px] font-medium text-foreground/90">
                          {item.predicted_vehicle ?? "No prediction"}
                        </p>
                        {!item.use_detection ? (
                          <span className="rounded border border-border/60 bg-white/[0.02] px-1 py-0.5 font-mono text-[7px] tracking-wide text-muted-foreground/45 uppercase">
                            full frame
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[8px] text-muted-foreground/45">
                        <span className="max-w-[220px] truncate">{item.filename}</span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <CalendarClock className="size-2.5" />
                          {formatDate(item.created_at)}
                        </span>
                        <span>·</span>
                        <span>{formatMs(item.inference_time_ms)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {item.model_ids.map((modelId) => (
                          <span
                            key={modelId}
                            className="flex items-center gap-1 rounded-full border border-border/55 bg-black/15 px-1.5 py-0.5 text-[8px] text-muted-foreground/55"
                          >
                            <ModelMark modelId={modelId} className="size-2.5 rounded-sm border-0 bg-transparent p-0" />
                            {shortModelName(modelId)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right sm:w-[92px]">
                      <p className={cn("text-[10px] font-medium", accent.softText)}>
                        {item.top_model ? shortModelName(topModelId, item.top_model) : "—"}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/55">
                        {item.confidence !== null
                          ? formatProbability(item.confidence)
                          : item.confidence_type === "decision_function"
                            ? "Uncalibrated"
                            : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDetailId(item.id)}
                        className="gap-1"
                      >
                        <Eye className="size-3" />
                        <span className="hidden sm:inline">Inspect</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(item)}
                        className="text-muted-foreground/50 hover:bg-rose-400/10 hover:text-rose-300"
                        aria-label="Delete analysis"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={History}
            title={modelFilter === "all" ? "History is empty" : "No analyses for this model"}
            description={
              modelFilter === "all"
                ? "Run a recognition or comparison from the workspace. Every result and crop is persisted here automatically."
                : "Try clearing the model filter or run a new analysis with this classifier selected."
            }
            action={
              <Link
                href="/recognition"
                className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
              >
                <ScanLine className="size-3.5" />
                Run recognition
              </Link>
            }
            className="border-0 bg-transparent"
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[9px] text-muted-foreground/45">
            {loading && history ? (
              <>
                <RefreshCw className="size-2.5 animate-spin" />
                Refreshing history…
              </>
            ) : (
              <>
                <Info className="size-3" />
                Page {page} of {pageCount} · {total} matching record{total === 1 ? "" : "s"}
              </>
            )}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => goToOffset(Math.max(0, offset - PAGE_SIZE))}
              className="gap-1"
            >
              <ArrowLeft className="size-3" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => goToOffset(offset + PAGE_SIZE)}
              className="gap-1"
            >
              Next
              <ArrowRight className="size-3" />
            </Button>
          </div>
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-white/[0.015] px-3.5 py-3 text-[10px] leading-4 text-muted-foreground/50">
        <Database className="mt-0.5 size-3 shrink-0 text-cyan-300/55" />
        History is stored only on this backend in <span className="mx-1 font-mono text-[9px]">data/vehicles.db</span>.
        Deleting an analysis removes its database row and stored JPEG files. Nothing is uploaded to a
        third-party service.
      </div>

      {detailId ? (
        <HistoryDetailDialog analysisId={detailId} onClose={() => setDetailId(null)} />
      ) : null}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-rose-400/10 text-rose-300">
              <Trash2 className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.predicted_vehicle ?? deleteTarget.filename}" and its stored images will be permanently removed.`
                : "This analysis will be permanently removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={mutating}
              className="bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
            >
              {mutating ? "Deleting…" : "Delete analysis"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-rose-400/10 text-rose-300">
              <TriangleAlert className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>Clear all history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all {stats?.total_analyses ?? 0} saved analyses, thumbnails,
              annotations and vehicle crops. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClear}
              disabled={mutating}
              className="bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
            >
              {mutating ? "Clearing…" : "Clear everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HistoryStat({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof History;
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "blue" | "violet" | "amber";
}) {
  const tones = {
    cyan: "border-cyan-400/15 bg-cyan-400/[0.05] text-cyan-300",
    blue: "border-sky-400/15 bg-sky-400/[0.05] text-sky-300",
    violet: "border-violet-400/15 bg-violet-400/[0.05] text-violet-300",
    amber: "border-amber-400/15 bg-amber-400/[0.05] text-amber-300",
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card/50 p-4 panel-glow">
      <div className={cn("flex size-8 items-center justify-center rounded-lg border", tones[tone])}>
        <Icon className="size-4" strokeWidth={1.8} />
      </div>
      <p className="mt-4 truncate text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1.5 text-[9px] font-medium tracking-wide text-muted-foreground/65 uppercase">
        {label}
      </p>
      <p className="mt-1 truncate text-[9px] text-muted-foreground/45">{detail}</p>
    </div>
  );
}
