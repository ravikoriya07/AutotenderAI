"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarNavGroupItem } from "@/config/sidebarNavigation";
import { isNavGroupActive, isNavLinkActive } from "@/config/sidebarNavigation";

type SidebarNavGroupProps = {
  group: SidebarNavGroupItem;
  pathname: string | null;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  onExpandSidebar: () => void;
};

export function SidebarNavGroup({
  group,
  pathname,
  collapsed,
  open,
  onToggle,
  onNavigate,
  onExpandSidebar,
}: SidebarNavGroupProps) {
  const sectionActive = isNavGroupActive(pathname, group);
  const Icon = group.icon;

  const handleParentClick = () => {
    if (collapsed) {
      onExpandSidebar();
      if (!open) onToggle();
      return;
    }
    onToggle();
  };

  const handleParentLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (collapsed) {
      event.preventDefault();
      onExpandSidebar();
      if (!open) onToggle();
      return;
    }
    onNavigate();
  };

  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          "flex items-center rounded-lg transition-colors",
          collapsed && sectionActive
            ? "bg-primary text-primary-foreground"
            : sectionActive && !open
              ? "bg-primary/15 text-primary"
              : sectionActive
                ? "text-primary"
                : "text-sidebar-foreground"
        )}
      >
        <Link
          href={group.href}
          onClick={handleParentLinkClick}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            collapsed && "justify-center px-2",
            !collapsed && sectionActive && !open && "font-medium",
            !collapsed &&
              !sectionActive &&
              "hover:bg-sidebar-foreground/10"
          )}
          title={collapsed ? group.label : undefined}
          aria-current={sectionActive ? "true" : undefined}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden />
          {!collapsed && <span className="truncate">{group.label}</span>}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={handleParentClick}
            className={cn(
              "mr-1 rounded-md p-1.5 transition-colors hover:bg-sidebar-foreground/10",
              sectionActive && "text-primary"
            )}
            aria-expanded={open}
            aria-label={
              open
                ? `Collapse ${group.label} submenu`
                : `Expand ${group.label} submenu`
            }
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                open && "rotate-180"
              )}
              aria-hidden
            />
          </button>
        )}
      </div>

      {!collapsed && open && (
        <div
          className="ml-3 space-y-0.5 border-l border-sidebar-foreground/15 pl-2"
          role="group"
          aria-label={`${group.label} modules`}
        >
          {group.children.map((child) => {
            const childActive = isNavLinkActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                  childActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-sidebar-foreground/90 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                )}
                aria-current={childActive ? "page" : undefined}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
