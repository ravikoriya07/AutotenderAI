"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type ToolSidebarMode =
  | "autoCount"
  | "searchText"
  | "doorFinder"
  | "wallFinder";

export type ToolOptionsSidebarProps = {
  mode: ToolSidebarMode;
  open: boolean;
  onClose: () => void;
  className?: string;
  onTransitionEnd?: React.ComponentPropsWithoutRef<"aside">["onTransitionEnd"];
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
  onSearchTextSubmit: () => void;
  searchTextLoading: boolean;
  searchTextError: string | null;
  searchSubmitDisabled: boolean;
};

/**
 * Shared right panel for Quantity take-off: Auto Count symbol options or Search Text query.
 */
export function ToolOptionsSidebar({
  mode,
  open,
  onClose,
  className,
  onTransitionEnd,
  rotationInvariant,
  onRotationInvariantChange,
  confidence,
  onConfidenceChange,
  searchTerm,
  onSearchTermChange,
  caseSensitive,
  onCaseSensitiveChange,
  onSearchTextSubmit,
  searchTextLoading,
  searchTextError,
  searchSubmitDisabled,
}: ToolOptionsSidebarProps) {
  const title =
    mode === "autoCount"
      ? "Auto count"
      : mode === "doorFinder"
        ? "Door finder"
        : mode === "wallFinder"
          ? "Wall finder"
          : "Search text";
  const ariaLabel =
    mode === "autoCount"
      ? "Auto count options"
      : mode === "doorFinder"
        ? "Door finder options"
        : mode === "wallFinder"
          ? "Wall finder options"
          : "Search text";

  return (
    <aside
      className={cn(
        "absolute bottom-0 right-0 top-0 z-50 flex max-h-full min-h-0 flex-col",
        "border-l border-border/70 bg-background/95 text-foreground shadow-md backdrop-blur-md",
        "rounded-l-lg",
        "w-full md:w-[280px] lg:w-[300px] xl:w-[320px]",
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
        {mode === "autoCount" ||
        mode === "doorFinder" ||
        mode === "wallFinder" ? (
          <section className="space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {mode === "doorFinder"
                ? "Door finder"
                : mode === "wallFinder"
                  ? "Wall finder"
                  : "Symbol options"}
            </h3>

            {mode === "autoCount" ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-card/50 px-2.5 py-2.5 transition-colors hover:bg-muted/40 sm:px-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  checked={rotationInvariant}
                  onChange={(e) => onRotationInvariantChange(e.target.checked)}
                />
                <span className="text-sm leading-snug text-foreground">
                  Detect rotated symbols
                </span>
              </label>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm font-medium leading-tight text-foreground">
                Confidence threshold
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
                <input
                  type="range"
                  min={0.1}
                  max={0.99}
                  step={0.01}
                  value={confidence}
                  onChange={(e) =>
                    onConfidenceChange(Number.parseFloat(e.target.value))
                  }
                  className={cn(
                    "h-2 w-full flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary",
                    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm",
                    "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary"
                  )}
                  aria-valuemin={0.1}
                  aria-valuemax={0.99}
                  aria-valuenow={confidence}
                />
                <output
                  className="inline-flex min-w-[3.25rem] shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/60 px-2 py-1.5 text-center text-sm font-medium tabular-nums text-foreground shadow-sm"
                  aria-live="polite"
                >
                  {confidence.toFixed(2)}
                </output>
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Search
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
                placeholder="Enter text to find"
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

            <Button
              type="button"
              className="h-10 w-full"
              disabled={searchSubmitDisabled || searchTextLoading}
              onClick={onSearchTextSubmit}
            >
              {searchTextLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Searching…
                </>
              ) : (
                "Search"
              )}
            </Button>
          </section>
        )}
      </div>
    </aside>
  );
}
