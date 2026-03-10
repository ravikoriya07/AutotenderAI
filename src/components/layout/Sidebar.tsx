"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  Search,
  Briefcase,
  FileText,
  Lightbulb,
  FileDown,
  FlaskConical,
  BookOpen,
  Library,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNav = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/projects", label: "Projects", icon: Briefcase },
  { href: "/my-drafts", label: "My Drafts", icon: FileText },
  { href: "/ideator", label: "Ideator", icon: Lightbulb },
  { href: "/extract", label: "Extract", icon: FileDown },
  { href: "/research", label: "Research", icon: FlaskConical },
];

const bottomNav = [
  { href: "/answer-bank", label: "Answer Bank", icon: BookOpen },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

const recentItems = [
  "how does L...",
  "Document -...",
  "Document -...",
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebar();

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
      <div className="flex h-14 items-center justify-between border-b border-sidebar-foreground/10 px-4">
        {!collapsed && (
          <Link href="/" className="font-semibold text-lg">
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
          {mainNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
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

        {!collapsed && (
          <div className="mt-6">
            <h3 className="mb-2 px-3 text-xs font-medium text-sidebar-foreground/70">
              Recently opened
            </h3>
            <ul className="space-y-1">
              {recentItems.map((item, i) => (
                <li key={i}>
                  <Link
                    href="#"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-foreground/10"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 space-y-1">
          {bottomNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
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

      {!collapsed && (
        <div className="border-t border-sidebar-foreground/10 p-3 text-xs text-sidebar-foreground/60">
          17°C Mostly cloudy
        </div>
      )}
    </aside>
    </>
  );
}
