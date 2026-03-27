"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
}

export function DashboardLayout({
  children,
  title,
  subtitle,
  searchPlaceholder,
}: DashboardLayoutProps) {
  const { collapsed } = useSidebar();
  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden">
      <Sidebar />
      <div
        className={cn(
          "min-w-0 transition-all duration-300",
          "max-lg:pl-0",
          collapsed ? "lg:pl-16" : "lg:pl-64"
        )}
      >
        <Header
          title={title}
          subtitle={subtitle}
          searchPlaceholder={searchPlaceholder}
        />
        {children}
      </div>
    </div>
  );
}
