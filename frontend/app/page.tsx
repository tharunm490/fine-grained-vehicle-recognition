"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CarFront,
  CheckCircle2,
  Cpu,
  Database,
  GitCompare,
  History,
  Layers,
  ScanLine,
  Server,
  Sparkles,
} from "lucide-react";
import { BackendStatus } from "@/components/layout/topbar";
import { ModelMark, ProvenanceBadge } from "@/components/models/model-ui";
import { EmptyState, SectionHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { api, apiUrl, getErrorMessage } from "@/lib/api";
import {
  formatDateShort,
  formatMs,
  formatProbability,
  formatRelative,
} from "@/lib/format";
import { APPROACH_LABELS, modelAccent, shortModelName } from "@/lib/models";
import type {
  HealthResponse,
  HistoryListResponse,
  HistoryStatsResponse,
  ModelsResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface DashboardState {
  models: ModelsResponse | null;
  stats: HistoryStatsResponse | null;
  history: HistoryListResponse | null;
  health: HealthResponse | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardState>({
    models: null,
    stats: null,
    history: null,
    health: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const retryDashboard = () => {
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    Promise.allSettled([
      api.models(controller.signal),
      api.historyStats(controller.signal),
      api.history({ limit: 5 }, controller.signal),
      api.health(controller.signal),
    ]).then((results) => {
      if (!active || controller.signal.aborted) return;
      const [models, stats, history, health] = results;

      setData({
        models: models.status === "fulfilled" ? models.value : null,
        stats: stats.status === "fulfilled" ? stats.value : null,
        history: history.status === "fulfilled" ? history.value : null,
        health: health.status === "fulfilled" ? health.value : null,
      });

      const rejected = results.find((result) => result.status === "rejected");
      setError(
        rejected && rejected.status === "rejected"
          ? getErrorMessage(rejected.reason)
          : null,
      );
      setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  const models = data.models?.models ?? [];
  const availableModels = models.filter((model) => model.available);
  const totalAnalyses = data.stats?.total_analyses;
  const recent = data.history?.items ?? [];
  const lastAnalysis = data.stats?.last_analysis_at;
  const detectorReady = data.health?.detector.available;

  return (
    <div className="space-y-7">
      <Hero
        loading={loading}
        models={models}
        availableCount={availableModels.length}
        device={data.models?.device ?? data.health?.device}
        lastAnalysis={lastAnalysis}
        totalAnalyses={totalAnalyses}
      />

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.045] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-5 items-center justify-center rounded-full border border-amber-400/25 text-[10px] font-semibold text-amber-300">
              !
            </span>
            <div>
              <p className="text-[11px] font-medium text-amber-200">Some dashboard data is unavailable</p>
              <p className="mt-0.5 text-[10px] text-amber-200/60">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={retryDashboard}
            className="rounded-lg border border-amber-400/25 px-2.5 py-1.5 text-[10px] font-medium text-amber-200 transition-colors hover:bg-amber-400/10"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Database}
          label="Analyses processed"
          value={loading ? "—" : String(totalAnalyses ?? 0)}
          detail={
            loading
              ? "Reading local history"
              : lastAnalysis
                ? `Last run ${formatRelative(lastAnalysis)}`
                : "Ready for the first analysis"
          }
          tone="cyan"
        />
        <StatCard
          icon={CarFront}
          label="Fine-grained classes"
          value="196"
          detail="Stanford Cars specification labels"
          tone="blue"
        />
        <StatCard
          icon={Layers}
          label="Classifier checkpoints"
          value={loading ? "—" : `${availableModels.length}/${models.length || 3}`}
          detail={
            loading
              ? "Verifying model registry"
              : availableModels.length === 3
                ? "All three models ready"
                : "One or more models unavailable"
          }
          tone="violet"
        />
        <StatCard
          icon={GitCompare}
          label="Approach lanes"
          value="03"
          detail="Approach 3: Hybrid Feature Fusion planned"
          tone="amber"
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <section className="rounded-2xl border border-border/70 bg-card/55 panel-glow">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
            <SectionHeader
              title="Recent analyses"
              description="Persisted results from the local SQLite history store."
              className="mb-0"
            />
            <Link
              href="/history"
              className="flex items-center gap-1 text-[10px] text-cyan-300/75 transition-colors hover:text-cyan-200"
            >
              View all
              <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="p-2">
            {loading ? (
              <div className="space-y-1.5 p-2">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="flex animate-pulse items-center gap-3 rounded-xl p-2.5"
                  >
                    <div className="size-12 rounded-lg bg-white/[0.04]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-2.5 w-1/3 rounded bg-white/[0.05]" />
                      <div className="h-2 w-1/2 rounded bg-white/[0.035]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recent.length ? (
              <div className="divide-y divide-border/35">
                {recent.map((item) => {
                  const topModelId = item.top_model
                    ? models.find((model) => model.name === item.top_model)?.id
                    : undefined;
                  const accent = modelAccent(topModelId ?? "");
                  return (
                    <Link
                      key={item.id}
                      href="/history"
                      className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.025]"
                    >
                      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-media/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={apiUrl(item.thumbnail_url)}
                          alt=""
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[11px] font-medium text-foreground/90">
                            {item.predicted_vehicle ?? item.filename}
                          </p>
                          {item.use_detection ? (
                            <span className="hidden shrink-0 rounded-full border border-cyan-400/15 bg-cyan-400/[0.05] px-1.5 py-0.5 font-mono text-[8px] text-cyan-200/65 sm:inline">
                              {item.detection_count} det.
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-muted-foreground/50">
                          <span className="truncate font-mono">{item.filename}</span>
                          <span>·</span>
                          <span>{formatDateShort(item.created_at)}</span>
                          <span>·</span>
                          <span>{formatMs(item.inference_time_ms)}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn("text-[10px] font-medium", accent.softText)}>
                          {item.top_model ? shortModelName(topModelId ?? "", item.top_model) : "—"}
                        </p>
                        <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/50">
                          {item.confidence !== null
                            ? formatProbability(item.confidence)
                            : item.confidence_type === "decision_function"
                              ? "Uncalibrated"
                              : "—"}
                        </p>
                      </div>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/25 transition-colors group-hover:text-cyan-300/60" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={ScanLine}
                title="No analyses yet"
                description="Your first recognition run will appear here with its prediction, confidence type and persisted history entry."
                action={
                  <Link
                    href="/recognition"
                    className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                  >
                    Analyze a vehicle
                    <ArrowRight className="size-3.5" />
                  </Link>
                }
                className="border-0 bg-transparent py-10"
              />
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border/70 bg-card/55 panel-glow">
            <div className="border-b border-border/60 px-4 py-3.5">
              <SectionHeader
                title="Runtime"
                description="Live backend state, not simulated telemetry."
                className="mb-0"
              />
            </div>
            <div className="space-y-1 p-2">
              <RuntimeRow
                label="API connection"
                value={<BackendStatus />}
                icon={Server}
              />
              <RuntimeRow
                label="Inference device"
                value={
                  <span className="rounded border border-border/60 bg-black/20 px-1.5 py-0.5 font-mono text-[9px] tracking-wide text-muted-foreground/80 uppercase">
                    {data.models?.device ?? data.health?.device ?? "unknown"}
                  </span>
                }
                icon={Cpu}
              />
              <RuntimeRow
                label="Detector"
                value={
                  detectorReady === undefined ? (
                    <span className="text-[10px] text-muted-foreground/50">Checking</span>
                  ) : (
                    <StatusText
                      ok={detectorReady}
                      okText={data.health?.detector.model ?? "Ready"}
                      failText="Unavailable"
                    />
                  )
                }
                icon={ScanLine}
              />
              <RuntimeRow
                label="History database"
                value={
                  <StatusText
                    ok={data.health?.database === "ok"}
                    okText="SQLite · connected"
                    failText="Unavailable"
                  />
                }
                icon={Database}
              />
              <RuntimeRow
                label="Detection runs"
                value={
                  <span className="font-mono text-[10px] text-foreground/75 tabular-nums">
                    {loading ? "—" : `${data.stats?.analyses_with_detection ?? 0}`}
                  </span>
                }
                icon={Activity}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-3.5 text-cyan-300/70" />
              <h2 className="text-xs font-medium text-foreground">Quick actions</h2>
            </div>
            <div className="grid gap-2">
              <QuickAction
                href="/recognition"
                icon={ScanLine}
                title="Run recognition"
                description="Upload and classify a vehicle"
              />
              <QuickAction
                href="/comparison"
                icon={GitCompare}
                title="Compare models"
                description="One image, three verdicts"
              />
              <QuickAction
                href="/performance"
                icon={BarChart3}
                title="Inspect performance"
                description="Metric provenance and latency"
              />
            </div>
          </section>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between gap-2">
          <SectionHeader
            title="Classifier lineup"
            description="Real checkpoints loaded by the FastAPI registry."
            className="mb-0"
          />
          <Link
            href="/performance"
            className="flex items-center gap-1 text-[10px] text-cyan-300/75 transition-colors hover:text-cyan-200"
          >
            Performance details
            <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {loading
            ? [0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-40 animate-pulse rounded-2xl border border-border/60 bg-card/40"
                />
              ))
            : models.map((model) => {
                const accent = modelAccent(model.id);
                const top1 = model.metrics.top1_accuracy;
                return (
                  <article
                    key={model.id}
                    className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/50 p-4 panel-glow"
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-60",
                        accent.gradient,
                      )}
                    />
                    <div className="relative">
                      <div className="flex items-start justify-between">
                        <ModelMark modelId={model.id} />
                        <span
                          className={cn(
                            "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px]",
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
                          {model.available ? "Ready" : "Unavailable"}
                        </span>
                      </div>
                      <p className="mt-3 text-[13px] font-medium text-foreground">
                        {model.short_name}
                      </p>
                      <p className="mt-0.5 text-[9px] text-muted-foreground/50">
                        {APPROACH_LABELS[model.approach_key]} · {model.input_size}
                      </p>
                      <div className="mt-4 flex items-end justify-between border-t border-border/50 pt-3">
                        <div>
                          <p className="font-mono text-[8px] tracking-[0.1em] text-muted-foreground/40 uppercase">
                            Top-1 accuracy
                          </p>
                          <div className="mt-1 flex items-baseline gap-1">
                            <p className={cn("text-lg font-semibold tabular-nums", accent.text)}>
                              {top1?.value !== null && top1?.value !== undefined
                                ? top1.value.toFixed(2)
                                : "—"}
                            </p>
                            <span className="text-[9px] text-muted-foreground/60">
                              {top1?.value !== null && top1?.value !== undefined ? "%" : "not supplied"}
                            </span>
                          </div>
                        </div>
                        <ProvenanceBadge status={top1?.status} />
                      </div>
                    </div>
                  </article>
                );
              })}
        </div>
      </section>
    </div>
  );
}

function Hero({
  loading,
  models,
  availableCount,
  device,
  lastAnalysis,
  totalAnalyses,
}: {
  loading: boolean;
  models: ModelsResponse["models"];
  availableCount: number;
  device?: string;
  lastAnalysis: string | null | undefined;
  totalAnalyses: number | undefined;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/45 panel-glow">
      <div className="surface-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_72%)]" />
      <div className="pointer-events-none absolute -top-40 -right-24 size-[420px] rounded-full bg-cyan-400/[0.055] blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-52 left-1/3 size-[360px] rounded-full bg-indigo-500/[0.05] blur-[100px]" />

      <div className="relative grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] lg:p-9">
        <div className="flex flex-col justify-center">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/[0.055] px-2.5 py-1 text-[10px] font-medium text-cyan-200/85">
              <span className="size-1 rounded-full bg-cyan-300" />
              Stanford Cars · 196 classes
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/[0.02] px-2.5 py-1 text-[10px] text-muted-foreground/65">
              <ScanLine className="size-3 text-cyan-300/60" />
              YOLO11n detection
            </span>
          </div>

          <h1 className="max-w-2xl text-balance text-[2rem] leading-[1.08] font-semibold tracking-[-0.045em] text-foreground sm:text-[2.7rem]">
            See the vehicle.
            <br />
            <span className="text-gradient">Name the exact model.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Fine-grained vehicle intelligence with a classical computer vision pipeline and two
            deep learning classifiers — all running against your local FastAPI backend.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Link
              href="/recognition"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-10 gap-2 rounded-xl bg-gradient-to-r from-accent-grad-1 via-accent-grad-2 to-accent-grad-3 px-4 font-semibold text-on-accent shadow-[0_10px_34px_-14px_var(--shadow-hero)] hover:brightness-105",
              )}
            >
              <ScanLine className="size-4" />
              Analyze a vehicle
            </Link>
            <Link
              href="/comparison"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-10 gap-2 rounded-xl border-border/80 bg-white/[0.02] px-4",
              )}
            >
              <GitCompare className="size-4" />
              Compare models
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-muted-foreground/50">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-emerald-400/60" />
              Real inference only
            </span>
            <span className="flex items-center gap-1.5">
              <Database className="size-3 text-cyan-300/50" />
              {totalAnalyses !== undefined ? `${totalAnalyses} saved analyses` : "Local history"}
            </span>
            <span className="flex items-center gap-1.5">
              <History className="size-3 text-violet-300/50" />
              {lastAnalysis ? `Last run ${formatRelative(lastAnalysis)}` : "No runs yet"}
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -inset-3 rounded-[28px] bg-gradient-to-br from-cyan-400/10 via-transparent to-indigo-500/10 blur-xl" />
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-panel-strong p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/50" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                <p className="text-[11px] font-medium text-foreground/85">Classifier stack</p>
              </div>
              <span className="font-mono text-[8px] tracking-[0.14em] text-muted-foreground/40 uppercase">
                Local · {device ?? "device"}
              </span>
            </div>

            <div className="mt-2 divide-y divide-border/35">
              {loading
                ? [0, 1, 2].map((index) => (
                    <div key={index} className="flex animate-pulse items-center gap-3 py-3">
                      <div className="size-8 rounded-lg bg-white/[0.04]" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 w-2/5 rounded bg-white/[0.05]" />
                        <div className="h-2 w-1/2 rounded bg-white/[0.035]" />
                      </div>
                    </div>
                  ))
                : models.map((model) => {
                    const accent = modelAccent(model.id);
                    return (
                      <div key={model.id} className="flex items-center gap-3 py-3">
                        <ModelMark modelId={model.id} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-medium text-foreground/90">
                            {model.short_name}
                          </p>
                          <p className="mt-0.5 text-[9px] text-muted-foreground/50">
                            {APPROACH_LABELS[model.approach_key]} · {model.num_classes} classes
                          </p>
                        </div>
                        <span
                          className={cn(
                            "flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[8px] uppercase",
                            model.available
                              ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
                              : "border-rose-400/20 bg-rose-400/[0.06] text-rose-300",
                          )}
                        >
                          <span className={cn("size-1 rounded-full", accent.dot)} />
                          {model.available ? "Ready" : "Offline"}
                        </span>
                      </div>
                    );
                  })}
            </div>

            <div className="mt-2 grid grid-cols-3 divide-x divide-border/40 border-t border-border/60 pt-3">
              <HeroFact label="Ready" value={`${availableCount}/3`} />
              <HeroFact label="Classes" value="196" />
              <HeroFact label="Latency" value="View live" href="/performance" />
            </div>
          </div>

          <div className="absolute -right-3 -bottom-3 -z-10 size-24 rounded-full border border-cyan-400/10 bg-cyan-400/[0.03] blur-md" />
        </div>
      </div>
    </section>
  );
}

function HeroFact({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <>
      <p className="font-mono text-[8px] tracking-[0.12em] text-muted-foreground/40 uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-[10px] font-medium text-foreground/75">{value}</p>
    </>
  );

  if (href) {
    return (
      <Link href="/performance" className="block px-2 text-center transition-colors hover:text-cyan-300">
        {content}
      </Link>
    );
  }

  return <div className="px-2 text-center">{content}</div>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  badge,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "blue" | "violet" | "amber";
  badge?: React.ReactNode;
}) {
  const tones = {
    cyan: "border-cyan-400/15 bg-cyan-400/[0.055] text-cyan-300",
    blue: "border-sky-400/15 bg-sky-400/[0.055] text-sky-300",
    violet: "border-violet-400/15 bg-violet-400/[0.055] text-violet-300",
    amber: "border-amber-400/15 bg-amber-400/[0.055] text-amber-300",
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card/50 p-4 panel-glow">
      <div className="flex items-start justify-between">
        <div className={cn("flex size-8 items-center justify-center rounded-lg border", tones[tone])}>
          <Icon className="size-4" strokeWidth={1.8} />
        </div>
        {badge ? (
          <span className="flex size-5 items-center justify-center rounded-md bg-white/[0.035] text-muted-foreground/45">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-[26px] leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
        {label}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground/45">{detail}</p>
    </div>
  );
}

function RuntimeRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: typeof Server;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground/40" />
      <p className="flex-1 text-[10px] text-muted-foreground/65">{label}</p>
      <div className="shrink-0">{value}</div>
    </div>
  );
}

function StatusText({ ok, okText, failText }: { ok: boolean; okText: string; failText: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 font-mono text-[9px]",
        ok ? "text-emerald-300/80" : "text-rose-300/80",
      )}
    >
      <span className={cn("size-1 rounded-full", ok ? "bg-emerald-400" : "bg-rose-400")} />
      {ok ? okText : failText}
    </span>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof ScanLine;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-xl border border-border/60 bg-white/[0.015] p-2.5 transition-colors hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]"
    >
      <span className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-black/20 text-cyan-300/70">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium text-foreground/80">{title}</span>
        <span className="block truncate text-[9px] text-muted-foreground/45">{description}</span>
      </span>
      <ArrowRight className="size-3 text-muted-foreground/25 transition-colors group-hover:text-cyan-300/60" />
    </Link>
  );
}
