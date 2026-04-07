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
}

export function DashboardLayout({
  children,
  titleLeading,
  title,
  subtitle,
  searchPlaceholder,
}: DashboardLayoutProps) {
  const { collapsed } = useSidebar();
  return (
    <div className="flex min-h-screen min-w-0 overflow-x-hidden">
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
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <AppFooter />
      </div>
    </div>
  );
}
