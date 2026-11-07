"use client";

import { Activity, Cpu, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useBackendStatus } from "@/hooks/use-backend-status";
import { currentNavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function BackendStatus({ compact = false }: { compact?: boolean }) {
  const { connection, health } = useBackendStatus();
  const online = connection === "online";
  const checking = connection === "checking";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-medium",
        online
          ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
          : checking
            ? "border-amber-400/20 bg-amber-400/[0.06] text-amber-300"
            : "border-rose-400/20 bg-rose-400/[0.06] text-rose-300",
      )}
      title={
        online
          ? `${health?.app ?? "API"} · database ${health?.database ?? "unknown"}`
          : checking
            ? "Checking the backend connection"
            : "The backend is unreachable. Start FastAPI on port 8000."
      }
    >
      <span className="relative flex size-1.5">
        {!checking ? (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-50",
              online ? "bg-emerald-400" : "bg-rose-400",
            )}
          />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-1.5 rounded-full",
            online ? "bg-emerald-400" : checking ? "bg-amber-400" : "bg-rose-400",
          )}
        />
      </span>
      {compact ? null : <span>{online ? "API online" : checking ? "Connecting" : "API offline"}</span>}
      {online && health ? (
        <span className="hidden items-center gap-1 border-l border-current/15 pl-2 font-mono text-[9px] tracking-wide opacity-80 uppercase sm:flex">
          <Cpu className="size-2.5" />
          {health.device}
        </span>
      ) : null}
    </div>
  );
}

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const pathname = usePathname();
  const current = currentNavItem(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={onOpenMobile}
          className="flex size-9 items-center justify-center rounded-lg border border-border/80 text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="hidden items-center gap-2 font-mono text-[9px] tracking-[0.16em] text-muted-foreground/50 uppercase sm:flex">
            <span>AutoLens</span>
            <span className="text-muted-foreground/25">/</span>
            <span className="text-cyan-200/60">{current?.shortLabel ?? "Workspace"}</span>
          </div>
          <p className="truncate text-[13px] font-medium text-foreground sm:mt-1">
            {current?.label ?? "Vehicle Intelligence"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-white/[0.02] px-2.5 py-1.5 font-mono text-[9px] tracking-wide text-muted-foreground/70 uppercase md:flex">
            <Activity className="size-3 text-cyan-300/70" />
            Real inference
          </div>
          <BackendStatus />
        </div>
      </div>
    </header>
  );
}
