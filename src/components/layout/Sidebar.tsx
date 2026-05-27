"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "@/contexts/SidebarContext";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { toast } from "react-toastify";
import { clearAuthSession } from "@/lib/authStorage";
import { logoutUser } from "@/services/authService";
import { cn } from "@/lib/utils";
import {
  SIDEBAR_BOTTOM_NAV,
  SIDEBAR_MAIN_NAV,
  isNavGroupActive,
  isNavLinkActive,
  isSidebarNavGroup,
} from "@/config/sidebarNavigation";
import { SidebarNavGroup } from "@/components/layout/SidebarNavGroup";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, setCollapsed } = useSidebar();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    for (const item of SIDEBAR_MAIN_NAV) {
      if (isSidebarNavGroup(item) && isNavGroupActive(pathname, item)) {
        setExpandedGroups((prev) =>
          prev[item.id] ? prev : { ...prev, [item.id]: true }
        );
      }
    }
  }, [pathname]);

  const closeOnMobile = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      setCollapsed(true);
    }
  }, [setCollapsed]);

  useEffect(() => {
    closeOnMobile();
  }, [pathname, closeOnMobile]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  const expandSidebar = useCallback(() => {
    setCollapsed(false);
  }, [setCollapsed]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logoutUser();
    } catch {
      toast.error("Logout request failed. Clearing local session.");
    } finally {
      clearAuthSession();
      closeOnMobile();
      router.replace("/login");
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, closeOnMobile, router]);

  const navItems = useMemo(
    () => [...SIDEBAR_MAIN_NAV, ...SIDEBAR_BOTTOM_NAV],
    []
  );

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
          collapsed ? "pointer-events-none invisible opacity-0" : "opacity-100"
        )}
        onClick={() => setCollapsed(true)}
        aria-hidden
      />
      <aside
        className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
          "fixed left-0 top-0 z-40 h-screen",
          "max-lg:w-64 max-lg:shadow-xl",
          collapsed
            ? "max-lg:-translate-x-full lg:w-16"
            : "max-lg:translate-x-0 lg:w-64"
        )}
      >
        <div className="flex h-14 min-w-0 items-center justify-between border-b border-sidebar-foreground/10 px-4">
          {!collapsed && (
            <Link href="/" className="min-w-0 flex-1 truncate font-semibold text-lg">
              AutotenderAI
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded p-1.5 hover:bg-sidebar-foreground/10"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3" aria-label="Main navigation">
          <div className="space-y-1">
            {navItems.map((item) => {
              if (isSidebarNavGroup(item)) {
                return (
                  <SidebarNavGroup
                    key={item.id}
                    group={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    open={
                      expandedGroups[item.id] ??
                      isNavGroupActive(pathname, item)
                    }
                    onToggle={() => toggleGroup(item.id)}
                    onNavigate={closeOnMobile}
                    onExpandSidebar={expandSidebar}
                  />
                );
              }

              const isActive = isNavLinkActive(
                pathname,
                item.href,
                item.matchSubpaths
              );
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeOnMobile}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    collapsed && "justify-center px-2",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-sidebar-foreground/10"
                  )}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-sidebar-foreground/10 p-3">
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-foreground/10 disabled:opacity-60",
              collapsed && "justify-center px-2"
            )}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
