"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  // Search,
  Briefcase,
  FileText,
  // Lightbulb,
  FlaskConical,
  // BookOpen,
  Library,
  Ruler,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { toast } from "react-toastify";
import { clearAuthSession } from "@/lib/authStorage";
import { logoutUser } from "@/services/authService";
import { cn } from "@/lib/utils";

const mainNav = [
  // { href: "/search", label: "Search", icon: Search },
  { href: "/projects", label: "Projects", icon: Briefcase },
  { href: "/my-drafts", label: "My Drafts", icon: FileText },
  // { href: "/ideator", label: "Ideator", icon: Lightbulb },
  { href: "/research", label: "Research", icon: FlaskConical },
];

const bottomNav = [
  // { href: "/answer-bank", label: "Answer Bank", icon: BookOpen },
  { href: "/library", label: "Library", icon: Library },
  { href: "/quantity-take-off", label: "Quantity take-off", icon: Ruler },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Exact match, or sub-routes that belong to the same nav section (e.g. `/quantity-take-off/view`). */
function isSidebarNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === "/research" && pathname.startsWith("/research/")) return true;
  if (href === "/quantity-take-off" && pathname.startsWith("/quantity-take-off/"))
    return true;
  if (href === "/projects" && pathname.startsWith("/projects/")) return true;
  if (href === "/my-drafts" && pathname.startsWith("/my-drafts")) return true;
  return false;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, setCollapsed } = useSidebar();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const closeOnMobile = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setCollapsed(true);
    }
  }, [setCollapsed]);

  useEffect(() => {
    closeOnMobile();
  }, [pathname, closeOnMobile]);

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
          collapsed ? "max-lg:-translate-x-full lg:w-16" : "max-lg:translate-x-0 lg:w-64"
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

      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {[...mainNav, ...bottomNav].map((item) => {
            const isActive = isSidebarNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeOnMobile}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-sidebar-foreground/10"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
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
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-foreground/10 disabled:opacity-60"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
