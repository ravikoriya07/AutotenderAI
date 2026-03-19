"use client";

import { Search, Bell, HelpCircle, Menu } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
}

export function Header({
  title,
  subtitle,
  searchPlaceholder = "Search...",
}: HeaderProps) {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="flex h-12 items-center justify-between bg-sidebar px-4">
        <button
          className="rounded p-2 text-sidebar-foreground hover:bg-sidebar-foreground/10 lg:hidden"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="text-lg font-semibold text-sidebar-foreground">
          AutotenderAI
        </span>
        <div className="w-10 lg:hidden" />
      </div>
      <div className="flex min-h-14 items-center justify-between gap-3 px-3 py-2 sm:px-6">
        <div className="flex flex-1 items-center gap-4">
          {title && (
            <div>
              <h1 className="text-lg font-semibold">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder={searchPlaceholder}
            className="h-9 w-48 rounded-md border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button className="rounded p-2 hover:bg-muted" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </button>
        <button className="rounded p-2 hover:bg-muted" aria-label="Help">
          <HelpCircle className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 pl-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
            JS
          </div>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            joe.sessions@thedck.com
          </span>
        </div>
        </div>
      </div>
    </header>
  );
}
