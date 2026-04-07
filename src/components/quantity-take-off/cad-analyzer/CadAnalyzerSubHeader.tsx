"use client";

import { Hand, Search, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Matches `abc.html` header-actions: pan/zoom, selection, analyze, clear.
 */
export function CadAnalyzerSubHeader() {
  return (
    <div className="flex min-w-0 flex-col gap-2 border-b border-border/80 bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-primary shadow-sm">
          <svg
            width="18"
            height="18"
            viewBox="0 0 32 32"
            fill="none"
            className="text-primary"
            aria-hidden
          >
            <rect
              x="4"
              y="4"
              width="24"
              height="24"
              rx="4"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M12 16L16 20L24 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h2 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
          DCK CAD Analyzer
        </h2>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          disabled
          title="Pan & Zoom (Hand Tool)"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          )}
          aria-label="Pan and zoom"
        >
          <Hand className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled
          title="Selection Tool"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary shadow-sm"
          )}
          aria-label="Selection tool"
        >
          <Square className="h-4 w-4" />
        </button>
        <Button
          type="button"
          size="sm"
          className="h-9 gap-1.5 px-3"
          disabled
          title="Analyze"
        >
          <Search className="h-3.5 w-3.5" />
          Analyze
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 border-destructive/40 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}
