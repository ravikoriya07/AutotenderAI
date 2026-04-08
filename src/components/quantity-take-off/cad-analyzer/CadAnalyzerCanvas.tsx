"use client";

import { cn } from "@/lib/utils";
import { CadAnalyzerFloatingBridge } from "./CadAnalyzerFloatingBridge";

type CadAnalyzerCanvasProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Grid artboard + PDF stage. Toolbar is a separate overlay layer above the PDF (z-index).
 */
export function CadAnalyzerCanvas({ children, className }: CadAnalyzerCanvasProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-zinc-100/90 p-3 sm:p-4 lg:min-h-0",
        className
      )}
      style={{
        backgroundImage: `
          linear-gradient(to right, rgb(0 0 0 / 0.06) 1px, transparent 1px),
          linear-gradient(to bottom, rgb(0 0 0 / 0.06) 1px, transparent 1px)
        `,
        backgroundSize: "20px 20px",
      }}
    >
      <div
        className={cn(
          "relative flex min-h-[min(48dvh,360px)] w-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/80 bg-background shadow-md lg:min-h-0"
        )}
      >
        {/* PDF / placeholder — below toolbar in stacking order */}
        <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>

        {/* Overlay: must sit above transformed PDF layers */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[100] flex justify-center pb-6 pt-2">
          <CadAnalyzerFloatingBridge />
        </div>
      </div>
    </div>
  );
}
