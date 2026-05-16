"use client";

import { cn } from "@/lib/utils";

interface SourceReferenceBadgeProps {
  /** Citation text as shown in the answer, e.g. `[41, 43]`. */
  displayText: string;
  /** Resolved library names (or `Source N` fallbacks), one per seq. */
  labels: string[];
}

export function SourceReferenceBadge({ displayText, labels }: SourceReferenceBadgeProps) {
  const tooltipBody =
    labels.length === 1 ? labels[0] : labels.join("\n");

  return (
    <span className="group/source-ref relative inline align-baseline">
      <span
        className={cn(
          "mx-0.5 inline-flex cursor-help items-center rounded-md px-1.5 py-0.5",
          "text-[0.78em] font-semibold leading-none",
          "bg-primary/10 text-primary ring-1 ring-primary/20",
          "transition-all duration-150",
          "group-hover/source-ref:bg-primary/20 group-hover/source-ref:ring-primary/40 group-hover/source-ref:shadow-sm",
          "group-focus-within/source-ref:bg-primary/20 group-focus-within/source-ref:ring-primary/40"
        )}
        tabIndex={0}
        aria-describedby={undefined}
      >
        {displayText}
      </span>
      {/* Tooltip renders below the badge to avoid overflow-y-auto clipping */}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-[calc(100%+6px)] left-1/2 z-50 w-max max-w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2",
          "rounded-lg border border-primary/20 bg-popover px-3 py-2 text-left text-[11px] font-medium leading-snug text-popover-foreground",
          "shadow-lg opacity-0 transition-opacity duration-150",
          "group-hover/source-ref:opacity-100 group-focus-within/source-ref:opacity-100",
          "whitespace-pre-line"
        )}
      >
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary mb-0.5">
          Source{labels.length > 1 ? "s" : ""}
        </span>
        {tooltipBody}
        {/* Caret pointing up */}
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-b-popover"
          aria-hidden
        />
      </span>
    </span>
  );
}
