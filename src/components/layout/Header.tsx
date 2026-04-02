"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Search, Bell, HelpCircle, Menu } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";
import { getAuthUserEmail, getAuthUserName } from "@/lib/authStorage";
import { getShortDisplayName, getUserInitials } from "@/lib/userDisplay";

interface HeaderProps {
  /** Renders before the page title (e.g. back control). */
  titleLeading?: ReactNode;
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
}

export function Header({
  titleLeading,
  title,
  subtitle,
  searchPlaceholder = "Search...",
}: HeaderProps) {
  const { collapsed, setCollapsed } = useSidebar();
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(getAuthUserName());
    setEmail(getAuthUserEmail());
  }, [pathname]);

  const initials = getUserInitials(displayName, email);
  const shortName = getShortDisplayName(displayName, email);

  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="flex h-12 min-w-0 items-center justify-between gap-2 bg-sidebar px-4">
        <button
          className="shrink-0 rounded p-2 text-sidebar-foreground hover:bg-sidebar-foreground/10 lg:hidden"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-lg font-semibold text-sidebar-foreground lg:flex-none lg:text-left">
          AutotenderAI
        </span>
        <div className="w-10 shrink-0 lg:hidden" aria-hidden />
      </div>
      <div className="flex min-h-14 min-w-0 items-center justify-between gap-3 px-3 py-2 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {titleLeading ? (
            <div className="shrink-0">{titleLeading}</div>
          ) : null}
          {title && (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{title}</h1>
              {subtitle && (
                <p className="line-clamp-2 text-sm text-muted-foreground sm:line-clamp-none">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
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
        <div
          className="flex min-w-0 items-center gap-2 pl-2"
          aria-label={
            email
              ? `${shortName}, ${email}`
              : displayName
                ? shortName
                : "Account"
          }
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary"
            aria-hidden
          >
            {initials}
          </div>
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-sm font-medium leading-tight">
              {shortName}
            </span>
            {email ? (
              <span className="truncate text-xs text-muted-foreground" title={email}>
                {email}
              </span>
            ) : null}
          </div>
        </div>
        </div>
      </div>
    </header>
  );
}
