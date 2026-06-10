import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  ClipboardList,
  FlaskConical,
  Library,
  Package,
  Ruler,
  Settings,
} from "lucide-react";
import {
  DEFAULT_INVENTORY_MODULE,
  INQUIRY_MANAGEMENT_BASE,
  INQUIRY_MANAGEMENT_LABEL,
  INVENTORY_MODULES,
} from "@/features/inventory-management/config/modules";

export type SidebarNavLinkItem = {
  kind: "link";
  href: string;
  label: string;
  icon: LucideIcon;
  /** When true, any path under `href/` counts as active (e.g. `/projects/[id]`). */
  matchSubpaths?: boolean;
};

export type SidebarNavGroupItem = {
  kind: "group";
  id: string;
  label: string;
  icon: LucideIcon;
  /** Default route when the parent row is activated. */
  href: string;
  /** Path prefix used to mark the group (and parent) active. */
  matchPrefix: string;
  children: ReadonlyArray<{ href: string; label: string }>;
};

export type SidebarNavItem = SidebarNavLinkItem | SidebarNavGroupItem;

export function isSidebarNavGroup(
  item: SidebarNavItem
): item is SidebarNavGroupItem {
  return item.kind === "group";
}

export const SIDEBAR_MAIN_NAV: SidebarNavItem[] = [
  {
    kind: "link",
    href: "/projects",
    label: "Projects",
    icon: Briefcase,
    matchSubpaths: true,
  },
  {
    kind: "link",
    href: "/research",
    label: "Research",
    icon: FlaskConical,
    matchSubpaths: true,
  },
  {
    kind: "group",
    id: "inquiry-management",
    label: INQUIRY_MANAGEMENT_LABEL,
    icon: Package,
    href: `${INQUIRY_MANAGEMENT_BASE}/${DEFAULT_INVENTORY_MODULE}`,
    matchPrefix: INQUIRY_MANAGEMENT_BASE,
    children: INVENTORY_MODULES.map((mod) => ({
      href: mod.href,
      label: mod.label,
    })),
  },
];

export const SIDEBAR_BOTTOM_NAV: SidebarNavLinkItem[] = [
  { kind: "link", href: "/library", label: "Library", icon: Library },
  {
    kind: "link",
    href: "/quantity-take-off",
    label: "Quantity take-off",
    icon: Ruler,
    matchSubpaths: true,
  },
  {
    kind: "link",
    href: "/schedule-of-works",
    label: "Schedule of Works",
    icon: ClipboardList,
    matchSubpaths: true,
  },
  { kind: "link", href: "/settings", label: "Settings", icon: Settings },
];

export function isNavLinkActive(
  pathname: string | null,
  href: string,
  matchSubpaths = false
): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (matchSubpaths && pathname.startsWith(`${href}/`)) return true;
  return false;
}

export function isNavGroupActive(
  pathname: string | null,
  group: SidebarNavGroupItem
): boolean {
  if (!pathname) return false;
  return (
    pathname === group.matchPrefix ||
    pathname.startsWith(`${group.matchPrefix}/`)
  );
}
