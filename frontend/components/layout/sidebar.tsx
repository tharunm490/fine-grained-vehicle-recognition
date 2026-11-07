"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface SidebarContentProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  mobile?: boolean;
}

export function SidebarContent({
  collapsed = false,
  onNavigate,
  onToggleCollapse,
  mobile = false,
}: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-[76px] shrink-0 items-center border-b border-sidebar-border/80",
          collapsed ? "justify-center px-2" : "justify-between px-5",
        )}
      >
        <Brand collapsed={collapsed} />
        {!collapsed ? (
          <span className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.06] px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] text-cyan-200/70 uppercase">
            v1.0
          </span>
        ) : null}
      </div>

      <nav className="scrollbar-none flex-1 overflow-y-auto px-3 py-5">
        {!collapsed ? (
          <p className="mb-2.5 px-2.5 font-mono text-[9px] font-medium tracking-[0.2em] text-sidebar-foreground/35 uppercase">
            Workspace
          </p>
        ) : null}
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex h-10 items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-150",
                  collapsed ? "justify-center px-0" : "px-2.5",
                  active
                    ? "bg-sidebar-accent text-white shadow-[inset_0_1px_0_var(--highlight)]"
                    : "text-sidebar-foreground/60 hover:bg-white/[0.035] hover:text-sidebar-foreground",
                )}
              >
                {active ? (
                  <span className="absolute top-1/2 left-0 h-5 w-[2px] -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_var(--cyan-glow-strong)]" />
                ) : null}
                <Icon
                  className={cn(
                    "size-[18px] shrink-0 transition-colors",
                    active ? "text-cyan-300" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80",
                  )}
                  strokeWidth={active ? 2 : 1.7}
                />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
                {!collapsed && active ? (
                  <span className="ml-auto size-1 rounded-full bg-cyan-300/80" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={cn("shrink-0 border-t border-sidebar-border/80", collapsed ? "p-2" : "p-3")}>
        {!collapsed ? (
          <div className="mb-3 rounded-xl border border-dashed border-border/80 bg-white/[0.018] p-3">
            <div className="flex items-center gap-2">
              <Lock className="size-3.5 text-muted-foreground/70" />
              <p className="text-[11px] font-medium text-sidebar-foreground/80">Hybrid ensemble</p>
              <span className="ml-auto rounded-full bg-white/[0.05] px-1.5 py-0.5 font-mono text-[8px] tracking-[0.1em] text-muted-foreground uppercase">
                Later
              </span>
            </div>
            <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground/60">
              Approach 3 is not implemented. Classical and deep learning only.
            </p>
          </div>
        ) : (
          <div
            className="mb-2 flex h-8 items-center justify-center rounded-lg text-muted-foreground/50"
            title="Approach 3 — coming later"
          >
            <Lock className="size-3.5" />
          </div>
        )}

        {mobile ? (
          <div className="flex items-center gap-2 px-2 pt-2 pb-1 text-[10px] text-muted-foreground/60">
            <Sparkles className="size-3 text-cyan-300/60" />
            Stanford Cars · 196 classes
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[11px] font-medium text-sidebar-foreground/45 transition-colors hover:bg-white/[0.035] hover:text-sidebar-foreground/80",
              collapsed && "justify-center px-0",
            )}
            title={collapsed ? "Expand sidebar" : undefined}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" />
                Collapse sidebar
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

interface DesktopSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function DesktopSidebar({ collapsed, onToggleCollapse }: DesktopSidebarProps) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border/80 bg-sidebar/95 backdrop-blur-xl transition-[width] duration-300 lg:flex",
        collapsed ? "w-[76px]" : "w-[268px]",
      )}
    >
      <div className="w-full">
        <SidebarContent collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      </div>
    </aside>
  );
}
