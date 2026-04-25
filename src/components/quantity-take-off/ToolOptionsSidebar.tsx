"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";

export type ToolSidebarMode =
  | "autoCount"
  | "searchText"
  | "floorArea"
  | "facade"
  | "doorFinder"
  | "wallFinder"
  | "roomFinder";

export type ToolOptionsControlsProps = {
  mode: ToolSidebarMode;
  /** Auto count — symbol options */
  rotationInvariant: boolean;
  onRotationInvariantChange: (value: boolean) => void;
  confidence: number;
  onConfidenceChange: (value: number) => void;
  /** Search text */
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  caseSensitive: boolean;
  onCaseSensitiveChange: (value: boolean) => void;
  searchTextLoading: boolean;
  searchTextError: string | null;
};

export type ToolOptionsSidebarProps = ToolOptionsControlsProps & {
  open: boolean;
  onClose: () => void;
  className?: string;
  onTransitionEnd?: React.ComponentPropsWithoutRef<"aside">["onTransitionEnd"];
};

type ModeMeta = { title: string; description: string };
const MODE_META: Record<ToolSidebarMode, ModeMeta> = {
  autoCount: {
    title: "Auto Count",
    description: "Adjust detection sensitivity. Lower confidence finds more matches; higher is stricter.",
  },
  facade: {
    title: "Facade",
    description: "Detect and count windows on a facade section. Draw a region first, then analyze.",
  },
  doorFinder: {
    title: "Door Finder",
    description: "Locate all door symbols inside the selected region of the drawing.",
  },
  wallFinder: {
    title: "Wall Finder",
    description: "Detect walls and measure their total length within the selected area.",
  },
  roomFinder: {
    title: "Room Finder",
    description: "Identify room boundaries and calculate floor areas inside the selected region.",
  },
  searchText: {
    title: "Search Text",
    description: "Find text labels anywhere in the drawing. Matches are highlighted on the canvas.",
  },
  floorArea: {
    title: "Floor Area",
    description: "Click inside a room on the drawing. The boundary is traced and its area computed automatically.",
  },
};

/**
 * Tool-specific controls only (no outer shell). Used inside the unified QTO right sidebar.
 */
export function ToolOptionsControls({
  mode,
  rotationInvariant,
  onRotationInvariantChange,
  confidence,
  onConfidenceChange,
  searchTerm,
  onSearchTermChange,
  caseSensitive,
  onCaseSensitiveChange,
  searchTextLoading,
  searchTextError,
}: ToolOptionsControlsProps) {
  const { description } = MODE_META[mode];

  return (
    <>
      {/* Tool description */}
      <p className="mb-4 rounded-lg border border-border/50 bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>

      {mode === "floorArea" ? null : mode === "searchText" ? (
        <section className="space-y-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Search options
          </h3>

          <div className="space-y-1.5">
            <label
              htmlFor="qto-search-term"
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              Search text <span className="text-destructive">*</span>
            </label>
            <Input
              id="qto-search-term"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="e.g. SOCKET, LIGHT, FD30"
              autoComplete="off"
              disabled={searchTextLoading}
              aria-invalid={Boolean(searchTextError)}
              className={cn(searchTextError && "border-destructive")}
            />
            {searchTextError ? (
              <p className="text-xs text-destructive" role="alert">
                {searchTextError}
              </p>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-card/50 px-2.5 py-2.5 transition-colors hover:bg-muted/40 sm:px-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              checked={caseSensitive}
              onChange={(e) => onCaseSensitiveChange(e.target.checked)}
              disabled={searchTextLoading}
            />
            <span className="text-sm leading-snug text-foreground">
              Case sensitive
            </span>
          </label>
        </section>
      ) : (
        <section className="space-y-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Detection options
          </h3>

          {mode === "autoCount" ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-card/50 px-2.5 py-2.5 transition-colors hover:bg-muted/40 sm:px-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                checked={rotationInvariant}
                onChange={(e) => onRotationInvariantChange(e.target.checked)}
              />
              <div className="space-y-0.5">
                <span className="text-sm leading-snug text-foreground">
                  Detect rotated symbols
                </span>
                <p className="text-xs text-muted-foreground">
                  Find symbols at any angle, not just upright.
                </p>
              </div>
            </label>
          ) : null}

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium leading-tight text-foreground">
                Confidence threshold
              </span>
              <output
                className="inline-flex min-w-12 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/60 px-2 py-1 text-center text-sm font-semibold tabular-nums text-foreground shadow-sm"
                aria-live="polite"
              >
                {confidence.toFixed(2)}
              </output>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.99}
              step={0.01}
              value={confidence}
              onChange={(e) => onConfidenceChange(Number.parseFloat(e.target.value))}
              className={cn(
                "h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary",
                "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm",
                "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary"
              )}
              aria-valuemin={0.1}
              aria-valuemax={0.99}
              aria-valuenow={confidence}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>More matches</span>
              <span>Stricter match</span>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/**
 * Shared right panel for Quantity take-off: Auto Count symbol options or Search Text query.
 */
export function ToolOptionsSidebar({
  mode,
  open,
  onClose,
  className,
  onTransitionEnd,
  ...controls
}: ToolOptionsSidebarProps) {
  const { title } = MODE_META[mode];
  const ariaLabel = `${title} options`;

  return (
    <aside
      className={cn(
        "absolute bottom-0 right-0 top-0 z-50 flex max-h-full min-h-0 flex-col",
        "border-l border-border/70 bg-background/95 text-foreground shadow-md backdrop-blur-md",
        "rounded-l-lg",
        "w-full min-w-0 max-w-[min(100vw,320px)] md:w-70 lg:w-75",
        "transition-transform duration-300 ease-out motion-reduce:transition-none",
        open ? "translate-x-0" : "translate-x-full",
        className
      )}
      aria-modal="true"
      role="dialog"
      aria-label={ariaLabel}
      aria-hidden={!open}
      onTransitionEnd={onTransitionEnd}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-2.5 py-2 sm:px-3 sm:py-2.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent",
            "text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted/80 hover:text-foreground"
          )}
          aria-label={`Close ${title.toLowerCase()} panel`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-3 pt-3 sm:px-3 sm:pb-4 sm:pt-3.5">
        <ToolOptionsControls mode={mode} {...controls} />
      </div>
    </aside>
  );
}
