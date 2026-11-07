"use client";

import { useSyncExternalStore, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DesktopSidebar, SidebarContent } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "autolens-sidebar-collapsed";
const sidebarListeners = new Set<() => void>();

function subscribeToSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    sidebarListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSidebarSnapshot() {
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

function getSidebarServerSnapshot() {
  return false;
}

function setSidebarCollapsed(collapsed: boolean) {
  window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  sidebarListeners.forEach((listener) => listener());
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setSidebarCollapsed(!collapsed);
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute -top-[28rem] left-[18%] h-[52rem] w-[52rem] rounded-full bg-cyan-500/[0.055] blur-[140px]" />
        <div className="absolute top-[12%] -right-[20rem] h-[40rem] w-[40rem] rounded-full bg-indigo-500/[0.05] blur-[140px]" />
        <div className="surface-grid absolute inset-0 opacity-45 [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_72%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
      </div>

      <DesktopSidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[284px] border-sidebar-border bg-sidebar p-0 sm:max-w-[284px]"
        >
          <SidebarContent mobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-300",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[268px]",
        )}
      >
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1520px] flex-1 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
          {children}
        </main>
        <footer className="mx-auto flex w-full max-w-[1520px] flex-wrap items-center justify-between gap-2 border-t border-border/40 px-4 py-5 text-[10px] text-muted-foreground/50 sm:px-6 lg:px-10">
          <p>AutoLens · Fine-grained vehicle intelligence with Stanford Cars</p>
          <p className="font-mono tracking-wide">YOLO11n · EfficientNet-B2 · DINOv2 · SVM</p>
        </footer>
      </div>
    </>
  );
}
