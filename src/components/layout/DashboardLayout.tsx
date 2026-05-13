"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AppFooter } from "./AppFooter";
import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  titleLeading?: React.ReactNode;
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
  /**
   * When true the layout is clamped to the dynamic viewport height so that
   * internal flex children (e.g. a chat view) can own their own scroll
   * region. The global AppFooter is suppressed in this mode.
   */
  fullHeight?: boolean;
}

export function DashboardLayout({
  children,
  titleLeading,
  title,
  subtitle,
  searchPlaceholder,
  fullHeight = false,
}: DashboardLayoutProps) {
  const { collapsed } = useSidebar();
  return (
    <div
      className={cn(
        "flex min-w-0",
        fullHeight
          ? "h-dvh overflow-hidden"
          : "min-h-screen overflow-x-hidden"
      )}
    >
      <Sidebar />
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300",
          "max-lg:pl-0",
          collapsed ? "lg:pl-16" : "lg:pl-64"
        )}
      >
        <Header
          titleLeading={titleLeading}
          title={title}
          subtitle={subtitle}
          searchPlaceholder={searchPlaceholder}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        {!fullHeight && <AppFooter />}
      </div>
    </div>
  );
}
