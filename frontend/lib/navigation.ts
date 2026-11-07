import {
  BarChart3,
  GitCompare,
  History,
  Info,
  LayoutDashboard,
  ScanLine,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}

export const NAV_ITEMS = [
  {
    href: "/",
    label: "Overview",
    shortLabel: "Overview",
    description: "System command center",
    icon: LayoutDashboard,
  },
  {
    href: "/recognition",
    label: "Vehicle Recognition",
    shortLabel: "Recognition",
    description: "Detect and classify vehicles",
    icon: ScanLine,
  },
  {
    href: "/comparison",
    label: "Model Comparison",
    shortLabel: "Comparison",
    description: "Compare three classifiers",
    icon: GitCompare,
  },
  {
    href: "/performance",
    label: "Model Performance",
    shortLabel: "Performance",
    description: "Metrics and latency",
    icon: BarChart3,
  },
  {
    href: "/history",
    label: "Detection History",
    shortLabel: "History",
    description: "Inspect persisted analyses",
    icon: History,
  },
  {
    href: "/about",
    label: "About Project",
    shortLabel: "About",
    description: "Architecture and provenance",
    icon: Info,
  },
] as const satisfies readonly NavItem[];

export function currentNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
}
