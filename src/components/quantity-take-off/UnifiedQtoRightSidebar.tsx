"use client";

import * as React from "react";
import { Loader2, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  ObjectMetadataPanelContent,
  type ObjectMetadataPanelContentProps,
} from "@/components/quantity-take-off/ObjectMetadataSidebar";
import {
  ToolOptionsControls,
  type ToolOptionsControlsProps,
  type ToolSidebarMode,
} from "@/components/quantity-take-off/ToolOptionsSidebar";

export const QTO_OBJECT_DATA_SECTION_ID = "qto-object-data-section";

export type UnifiedQtoRightSidebarProps = ToolOptionsControlsProps & {
  mode: ToolSidebarMode;
  open: boolean;
  onClose: () => void;
  className?: string;
  onTransitionEnd?: React.ComponentPropsWithoutRef<"aside">["onTransitionEnd"];
  /** Ref attached to the object-data section for scroll-into-view */
  objectDataSectionRef?: React.Ref<HTMLDivElement>;
  /** Props for {@link ObjectMetadataPanelContent} (section ref / id applied by this shell) */
  objectMetadata: Omit<
    ObjectMetadataPanelContentProps,
    "sectionRef" | "sectionId" | "showObjectDataForm"
  >;
  /** When false, only saved-objects list is shown below the actions row. */
  showObjectDataForm: boolean;
  /** ROI / symbol tools: Analyze + Clear in one row. Search mode: Clear only. */
  showRoiAnalyzeActions: boolean;
  primaryAnalyzeLabel: string;
  onPrimaryAnalyze: () => void;
  primaryAnalyzeDisabled: boolean;
  primaryAnalyzeLoading: boolean;
  onClear: () => void;
  clearDisabled: boolean;
};

function headerTitle(mode: ToolSidebarMode): string {
  switch (mode) {
    case "autoCount":
      return "Auto count options";
    case "doorFinder":
      return "Door finder options";
    case "wallFinder":
      return "Wall finder options";
    case "roomFinder":
      return "Room finder options";
    case "searchText":
      return "Search text options";
    default:
      return "Options";
  }
}

function ariaLabel(mode: ToolSidebarMode): string {
  switch (mode) {
    case "autoCount":
      return "Auto count options";
    case "doorFinder":
      return "Door finder options";
    case "wallFinder":
      return "Wall finder options";
    case "roomFinder":
      return "Room finder options";
    case "searchText":
      return "Search text options";
    default:
      return "Quantity take-off options";
  }
}

/**
 * Single right sidebar: tool controls, analyze/clear row, and object metadata.
 */
export function UnifiedQtoRightSidebar({
  mode,
  open,
  onClose,
  className,
  onTransitionEnd,
  objectDataSectionRef,
  objectMetadata,
  showObjectDataForm,
  showRoiAnalyzeActions,
  primaryAnalyzeLabel,
  onPrimaryAnalyze,
  primaryAnalyzeDisabled,
  primaryAnalyzeLoading,
  onClear,
  clearDisabled,
  ...controls
}: UnifiedQtoRightSidebarProps) {
  const title = headerTitle(mode);
  const label = ariaLabel(mode);

  return (
    <aside
      className={cn(
        "absolute bottom-0 right-0 top-0 z-50 flex max-h-full min-h-0 flex-col",
        "border-l border-border/70 bg-background/95 text-foreground shadow-md backdrop-blur-md",
        "rounded-l-lg",
        "w-full min-w-0 sm:max-w-[min(100vw,400px)] sm:w-[360px]",
        "transition-transform duration-300 ease-out motion-reduce:transition-none",
        open ? "translate-x-0" : "translate-x-full",
        className
      )}
      aria-modal="true"
      role="dialog"
      aria-label={label}
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
          aria-label={`Close ${title.toLowerCase()}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-4 pt-3 sm:px-3 sm:pb-5 sm:pt-3.5">
        <ToolOptionsControls mode={mode} {...controls} />

        {showRoiAnalyzeActions ? (
          <div className="mt-6 flex flex-row items-stretch gap-2 border-t border-border/60 pt-6">
            <Button
              type="button"
              variant="default"
              className={cn(
                "flex min-h-10 min-w-0 flex-1 basis-0 flex-row items-center justify-center gap-1 px-2.5 py-2",
                "text-primary-foreground"
              )}
              disabled={primaryAnalyzeDisabled}
              onClick={onPrimaryAnalyze}
            >
              {primaryAnalyzeLoading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Search className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 truncate text-[11px] font-medium leading-snug sm:text-xs">
                {primaryAnalyzeLabel}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex min-h-10 min-w-0 flex-1 basis-0 flex-row items-center justify-center gap-1 px-3"
              disabled={clearDisabled}
              onClick={onClear}
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate text-sm font-medium">Clear</span>
            </Button>
          </div>
        ) : (
          <div className="mt-6 flex flex-row justify-end border-t border-border/60 pt-6">
            <Button
              type="button"
              variant="outline"
              className="flex h-10 min-w-[7.5rem] flex-row items-center justify-center gap-1 px-4"
              disabled={clearDisabled}
              onClick={onClear}
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-sm font-medium">Clear</span>
            </Button>
          </div>
        )}

        <ObjectMetadataPanelContent
          {...objectMetadata}
          showObjectDataForm={showObjectDataForm}
          sectionRef={objectDataSectionRef}
          sectionId={QTO_OBJECT_DATA_SECTION_ID}
        />
      </div>
    </aside>
  );
}
