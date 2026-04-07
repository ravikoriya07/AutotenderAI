"use client";

import { cn } from "@/lib/utils";

type CadAnalyzerCanvasProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Center workspace with light grid (Photoshop-style artboard). Content is the PDF / placeholder.
 */
export function CadAnalyzerCanvas({ children, className }: CadAnalyzerCanvasProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-[min(52dvh,420px)] flex-1 items-center justify-center overflow-hidden bg-zinc-100/90 p-3 sm:min-h-[min(58dvh,520px)] sm:p-4 lg:min-h-0",
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
          "relative flex h-full w-full max-h-[min(70dvh,780px)] max-w-full items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-background shadow-md"
        )}
      >
        {children}
      </div>
    </div>
  );
}
