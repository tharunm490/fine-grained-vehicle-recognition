import Link from "next/link";
import { Aperture } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/"
      className={cn(
        "group flex items-center gap-3 overflow-hidden",
        collapsed ? "justify-center" : "",
      )}
      aria-label="AutoLens home"
    >
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-gradient-to-br from-cyan-400/20 via-sky-400/10 to-transparent text-cyan-300 shadow-[0_0_24px_-8px_var(--brand-glow)]">
        <Aperture className="size-[19px]" strokeWidth={1.8} />
        <span className="absolute inset-0 rounded-xl ring-1 ring-white/5" />
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <p className="text-[15px] leading-none font-semibold tracking-[-0.02em] text-foreground">
            Auto<span className="text-cyan-300">Lens</span>
          </p>
          <p className="mt-1 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
            Vehicle Intelligence
          </p>
        </div>
      ) : null}
    </Link>
  );
}
