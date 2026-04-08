"use client";

import { CadAnalyzerSubHeader } from "./CadAnalyzerSubHeader";
import { CadAnalyzerCanvas } from "./CadAnalyzerCanvas";
import { CadAnalyzerToolProvider } from "@/contexts/CadAnalyzerToolContext";

type CadAnalyzerModuleProps = {
  /** PDF iframe, loader, or placeholder */
  canvasContent: React.ReactNode;
};

/**
 * Sub-header (Analyze / Clear), full-width canvas, floating bottom tool bar.
 */
export function CadAnalyzerModule({ canvasContent }: CadAnalyzerModuleProps) {
  return (
    <CadAnalyzerToolProvider>
      <div className="flex min-h-[min(64dvh,640px)] min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm lg:min-h-[min(70dvh,720px)]">
        <CadAnalyzerSubHeader />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CadAnalyzerCanvas className="min-h-[min(48dvh,360px)] lg:min-h-0 lg:flex-1">
            {canvasContent}
          </CadAnalyzerCanvas>
        </div>
      </div>
    </CadAnalyzerToolProvider>
  );
}
