"use client";

import { Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Analyze / Clear. Canvas tools live in `FloatingActionBar`.
 */
export function CadAnalyzerSubHeader() {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 border-b border-border/80 bg-muted/30 px-3 py-2.5">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
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
