"use client";

import { ResearchProjectProvider } from "@/contexts/ResearchProjectContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ResearchProjectProvider>{children}</ResearchProjectProvider>;
}
