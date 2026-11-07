"use client";

import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  FileImage,
  GitCompare,
  Layers,
  ScanLine,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
} from "lucide-react";
import { ApproachBadge, ModelMark, ProvenanceBadge } from "@/components/models/model-ui";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useModels } from "@/hooks/use-models";
import { cn } from "@/lib/utils";

const ENDPOINTS = [
  { method: "GET", path: "/api/health", note: "Runtime, device, database, detector and model health" },
  { method: "GET", path: "/api/models", note: "Model registry, metrics and provenance metadata" },
  { method: "GET", path: "/api/models/benchmark", note: "Live latency benchmark on the backend device" },
  { method: "POST", path: "/api/detect", note: "YOLO11n detection with annotated image and crops" },
  { method: "POST", path: "/api/recognize", note: "Detect, classify selected models, persist history" },
  { method: "POST", path: "/api/recognize/compare", note: "Run all three classifiers and build agreement" },
  { method: "GET", path: "/api/history", note: "Paginated history, optionally filtered by model" },
  { method: "GET", path: "/api/history/stats", note: "Aggregate counts and last analysis timestamp" },
  { method: "GET", path: "/api/history/{id}", note: "Full stored analysis, vehicles and comparison" },
  { method: "GET", path: "/api/history/{id}/image", note: "Original, annotated, thumbnail or crop JPEG" },
  { method: "DELETE", path: "/api/history/{id}", note: "Delete one analysis and its stored files" },
  { method: "DELETE", path: "/api/history", note: "Clear all persisted analyses and files" },
  { method: "POST", path: "/api/evaluate", note: "Optional labelled-dataset evaluation, if configured" },
] as const;

export default function AboutPage() {
  const { data, loading } = useModels();
  const models = data?.models ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project anatomy"
        title={
          <>
            A fine-grained vision system, <span className="text-gradient">without invented certainty.</span>
          </>
        }
        description="AutoLens combines vehicle detection, three classification checkpoints, cross-model agreement and local persistence. This page documents what is implemented, how it works and where the limits are."
        actions={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-muted-foreground">
              <Code2 className="size-3 text-cyan-300/70" />
              Next.js + FastAPI
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.04] px-2.5 py-1.5 text-[10px] text-emerald-200/70">
              <Sparkles className="size-3" />
              Approach 3: Hybrid Feature Fusion
            </span>
          </>
        }
      />

      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/50 p-4 panel-glow sm:p-5">
        <div className="surface-grid pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
        <div className="relative">
          <SectionHeader
            title="Request lifecycle"
            description="Uploads never leave your machine unless you deliberately deploy the backend elsewhere."
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <FlowStep
              index="01"
              icon={FileImage}
              title="Validate & decode"
              description="JPEG/PNG only, 12 MB max, 40 MP cap, EXIF orientation normalized with Pillow."
            />
            <FlowStep
              index="02"
              icon={ScanLine}
              title="Detect vehicles"
              description="YOLO11n finds COCO car, motorcycle, bus and truck instances above the threshold."
            />
            <FlowStep
              index="03"
              icon={BrainCircuit}
              title="Classify crops"
              description="Selected classifiers resolve each crop across 196 fine-grained Stanford Cars classes."
            />
            <FlowStep
              index="04"
              icon={GitCompare}
              title="Build agreement"
              description="Top-1 labels, score types, inference times and disagreement are compared."
            />
            <FlowStep
              index="05"
              icon={Database}
              title="Persist locally"
              description="The response, crops, annotation and thumbnail are stored as SQLite plus JPEG files."
            />
          </div>
        </div>
      </section>

      <section>
        <SectionHeader
          title="Approach map"
          description="Three approaches are documented: classical computer vision, deep learning, and the planned Hybrid Feature Fusion architecture."
        />
        <div className="grid gap-3 lg:grid-cols-3">
          <ApproachCard
            label="Approach 1"
            title="Classical computer vision"
            tone="amber"
            status="Implemented"
            icon={Cpu}
            body="Handcrafted HOG, LBP and HSV features are standardized, reduced with PCA and classified by an RBF SVM, then calibrated with sigmoid (Platt) scaling. It provides an interpretable, CPU-only baseline."
            points={["2,807 fused features", "PCA · 300 components", "RBF-kernel SVC", "Calibrated probabilities"]}
          />
          <ApproachCard
            label="Approach 2"
            title="Deep learning"
            tone="cyan"
            status="Implemented · 2 checkpoints"
            icon={Layers}
            body="EfficientNet-B2 supplies strong convolutional features. DINOv2 ViT-B/14 supplies high-resolution self-supervised transformer features with a fine-tuned MLP head."
            points={["196-class linear head", "260 px CNN input", "518 px ViT input", "Softmax probabilities"]}
          />
          <ApproachCard
            label="Approach 3"
            title="Hybrid Feature Fusion"
            tone="emerald"
            status="Planned · not trained"
            icon={Sparkles}
            body="Planned feature-level fusion: DINOv2 embeddings + HOG + LBP + HSV → feature fusion → RBF SVM classifier. The classifier has not been trained or evaluated."
            points={["DINOv2 embeddings", "HOG + LBP + HSV", "Feature fusion", "RBF SVM classifier"]}
          />
        </div>
      </section>

      <section>
        <SectionHeader
          title="Classifier implementation"
          description="Live metadata from the running model registry."
        />
        <div className="grid gap-3 lg:grid-cols-3">
          {loading
            ? [0, 1, 2].map((index) => (
                <div key={index} className="h-64 animate-pulse rounded-2xl border border-border/60 bg-card/40" />
              ))
            : models.map((model) => (
                <article
                  key={model.id}
                  className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <ModelMark modelId={model.id} />
                      <div>
                        <p className="text-xs font-medium text-foreground">{model.short_name}</p>
                        <p className="mt-0.5 text-[9px] text-muted-foreground/45">{model.framework}</p>
                      </div>
                    </div>
                    <ApproachBadge approachKey={model.approach_key} />
                  </div>
                  <p className="mt-3.5 text-[10px] leading-5 text-muted-foreground/60">{model.architecture}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ModelFact label="Input" value={model.input_size} />
                    <ModelFact label="Classes" value={String(model.num_classes)} />
                    <ModelFact label="Parameters" value={model.parameters ?? "Not supplied"} />
                    <ModelFact label="Checkpoint" value={model.checkpoint_filename} mono />
                  </div>
                  <div className="mt-3 border-t border-border/50 pt-2.5">
                    <p className="text-[9px] leading-4 text-muted-foreground/50">
                      {model.feature_extraction}
                    </p>
                    {model.notes.length ? (
                      <p className="mt-1.5 text-[9px] leading-4 text-muted-foreground/40">
                        {model.notes[0]}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(310px,0.7fr)]">
        <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow sm:p-5">
          <div className="flex items-center gap-2">
            <Workflow className="size-3.5 text-cyan-300/70" />
            <h2 className="text-sm font-medium text-foreground">HTTP API surface</h2>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground/50">
            FastAPI with Pydantic response models, structured errors and local CORS for the frontend.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-border/60">
            {ENDPOINTS.map((endpoint) => (
              <div
                key={`${endpoint.method}-${endpoint.path}`}
                className="flex flex-col gap-1 border-b border-border/40 bg-white/[0.012] px-3 py-2.5 last:border-0 sm:flex-row sm:items-center sm:gap-3"
              >
                <span
                  className={cn(
                    "w-fit shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8px] font-medium tracking-wide",
                    endpoint.method === "GET"
                      ? "border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-300"
                      : endpoint.method === "POST"
                        ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
                        : "border-rose-400/20 bg-rose-400/[0.06] text-rose-300",
                  )}
                >
                  {endpoint.method}
                </span>
                <code className="shrink-0 font-mono text-[10px] text-foreground/75">{endpoint.path}</code>
                <span className="text-[9px] leading-4 text-muted-foreground/45 sm:ml-auto sm:text-right">
                  {endpoint.note}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-emerald-300/70" />
              <h2 className="text-sm font-medium text-foreground">Data and metric honesty</h2>
            </div>
            <div className="mt-3 space-y-2.5">
              <PolicyItem
                title="No mock predictions"
                text="Every class name, score, latency and history entry comes from the running backend or its SQLite store."
              />
              <PolicyItem
                title="No fabricated evaluation"
                text="No confusion matrix, ROC curve or per-class table is generated without a labelled dataset."
              />
              <PolicyItem
                title="Provenance is visible"
                text="Recorded, reported, checkpoint-metadata and live-measured values are labelled differently throughout."
              />
              <PolicyItem
                title="SVM probabilities are calibrated"
                text="The classical SVM uses sigmoid (Platt) calibration fitted with 5-fold cross-validation on the training split. Its percentages are calibrated estimates, not guarantees. EfficientNet-B2 and DINOv2 return softmax probabilities."
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <ProvenanceBadge status="recorded" />
              <ProvenanceBadge status="reported" />
              <ProvenanceBadge status="checkpoint_metadata" />
              <ProvenanceBadge status="measured" />
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow">
            <div className="flex items-center gap-2">
              <Terminal className="size-3.5 text-cyan-300/70" />
              <h2 className="text-sm font-medium text-foreground">Local quick start</h2>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border/60 bg-code p-3 font-mono text-[9px] leading-5 text-muted-foreground/65">
{`# backend
cd backend
.\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --port 8000

# frontend
cd frontend
npm run dev`}
            </pre>
            <p className="mt-2 text-[9px] leading-4 text-muted-foreground/40">
              Frontend API base is configured with <span className="font-mono">NEXT_PUBLIC_API_URL</span>.
            </p>
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow sm:p-5">
        <SectionHeader
          title="Technology stack"
          description="Libraries actually used by this implementation."
        />
        <div className="grid gap-3 md:grid-cols-3">
          <StackGroup
            icon={Code2}
            title="Frontend"
            items={["Next.js 16 App Router", "React 19 + TypeScript", "Tailwind CSS v4", "shadcn/ui + Base UI", "Recharts", "Lucide icons"]}
          />
          <StackGroup
            icon={Server}
            title="Backend & models"
            items={["FastAPI + Pydantic", "PyTorch + torchvision", "scikit-learn 1.6.1", "scikit-image + OpenCV", "Ultralytics YOLO11n", "Pillow + SQLite"]}
          />
          <StackGroup
            icon={Cpu}
            title="Runtime"
            items={["Python 3.12 virtualenv", "Node.js 24 + npm", "CPU-ready (auto CUDA)", "Local JPEG history", "GZip responses", "Strict upload validation"]}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/55 p-4 panel-glow sm:p-5">
        <SectionHeader
          title="Known limitations"
          description="Deliberately documented instead of hidden behind optimistic copy."
        />
        <div className="grid gap-2 md:grid-cols-2">
          {[
            "DINOv2 at 518×518 is slow on CPU; full three-model runs can take several seconds per vehicle.",
            "YOLO11n may detect background vehicles or miss partially occluded ones; adjust the threshold or classify the full frame.",
            "The supplied EfficientNet-B2 file is named as a transfer checkpoint; reported fine-tuned metrics are not independently verified.",
            "DINOv2 measured 93.33% top-1 / 98.33% top-5 on 120 labelled images across four classes; checkpoint metadata reports 94.35% on an unavailable original split, so this is not a full 196-class test score.",
            "The classical SVM is weak on fine-grained classes. Its probabilities are sigmoid-calibrated but low (mean top-1 confidence 3.23%, ECE 16.77% on the 120-image validation set).",
            "The planned Hybrid Feature Fusion architecture combines DINOv2 embeddings with HOG, LBP and HSV features before an RBF SVM classifier. It has not been trained or evaluated.",
          ].map((item) => (
            <div
              key={item}
              className="flex items-start gap-2 rounded-xl border border-border/55 bg-white/[0.012] px-3 py-2.5 text-[10px] leading-4 text-muted-foreground/55"
            >
              <Sparkles className="mt-0.5 size-3 shrink-0 text-amber-300/55" />
              {item}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/12 bg-gradient-to-r from-cyan-400/[0.04] via-transparent to-indigo-500/[0.04] p-4 panel-glow">
        <div>
          <p className="text-xs font-medium text-foreground/85">Ready to inspect the real outputs?</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground/50">
            Upload a vehicle or review measured and reported model evidence.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/recognition" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
            <ScanLine className="size-3.5" />
            Open recognition
          </Link>
          <Link
            href="/performance"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            Model performance
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function FlowStep({
  index,
  icon: Icon,
  title,
  description,
}: {
  index: string;
  icon: typeof FileImage;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-xl border border-border/60 bg-white/[0.018] p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-black/20 text-cyan-300/75">
          <Icon className="size-3.5" strokeWidth={1.7} />
        </div>
        <span className="font-mono text-[8px] tracking-widest text-muted-foreground/30">{index}</span>
      </div>
      <p className="mt-3 text-[10px] font-medium text-foreground/85">{title}</p>
      <p className="mt-1 text-[9px] leading-4 text-muted-foreground/50">{description}</p>
    </div>
  );
}

function ApproachCard({
  label,
  title,
  body,
  points,
  tone,
  status,
  icon: Icon,
  disabled = false,
}: {
  label: string;
  title: string;
  body: string;
  points: string[];
  tone: "amber" | "cyan" | "emerald" | "neutral";
  status: string;
  icon: typeof Cpu;
  disabled?: boolean;
}) {
  const tones = {
    amber: "border-amber-400/15 bg-amber-400/[0.035] text-amber-300",
    cyan: "border-cyan-400/15 bg-cyan-400/[0.035] text-cyan-300",
    emerald: "border-emerald-400/15 bg-emerald-400/[0.035] text-emerald-300",
    neutral: "border-border/70 bg-white/[0.012] text-muted-foreground/55",
  };

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card/50 p-4 panel-glow",
        disabled && "border-dashed opacity-75",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={cn("flex size-8 items-center justify-center rounded-lg border", tones[tone])}>
          <Icon className="size-4" strokeWidth={1.8} />
        </div>
        <span
          className={cn(
            "rounded-full border px-1.5 py-0.5 font-mono text-[8px] tracking-wide",
            disabled
              ? "border-amber-400/20 bg-amber-400/[0.05] text-amber-300/75"
              : "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300/80",
          )}
        >
          {status}
        </span>
      </div>
      <p className="mt-3 font-mono text-[8px] tracking-[0.14em] text-muted-foreground/35 uppercase">
        {label}
      </p>
      <h3 className="mt-1 text-[13px] font-medium text-foreground/90">{title}</h3>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground/55">{body}</p>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {points.map((point) => (
          <span
            key={point}
            className="rounded-md border border-border/50 bg-black/15 px-1.5 py-1 text-[8px] text-muted-foreground/55"
          >
            {disabled ? point : <span className="flex items-center gap-1"><CheckCircle2 className="size-2.5 text-emerald-400/50" />{point}</span>}
          </span>
        ))}
      </div>
    </article>
  );
}

function ModelFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border/50 bg-black/15 px-2 py-1.5">
      <p className="font-mono text-[7px] tracking-[0.08em] text-muted-foreground/35 uppercase">{label}</p>
      <p className={cn("mt-0.5 truncate text-[9px] text-foreground/70", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function PolicyItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-400/60" />
      <p className="text-[9px] leading-4 text-muted-foreground/55">
        <span className="font-medium text-foreground/70">{title}. </span>
        {text}
      </p>
    </div>
  );
}

function StackGroup({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Code2;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-white/[0.015] p-3.5">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-cyan-300/65" />
        <p className="text-[11px] font-medium text-foreground/80">{title}</p>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-md border border-border/55 bg-black/15 px-1.5 py-1 text-[8px] text-muted-foreground/55"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
