"use client";

import * as React from "react";
import {
  Building2,
  CircleDot,
  DoorOpen,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  PanelsTopLeft,
  ScanSearch,
  Trash2,
  Type,
  X,
} from "lucide-react";
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
import { useCadAnalyzerTool } from "@/contexts/CadAnalyzerToolContext";
import type { LucideIcon } from "lucide-react";

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
  primaryAnalyzeLabel: string;
  onPrimaryAnalyze: () => void;
  primaryAnalyzeDisabled: boolean;
  primaryAnalyzeLoading: boolean;
  onClear: () => void;
  clearDisabled: boolean;
};

type ModeMeta = { title: string; icon: LucideIcon; step: string };

const MODE_META: Record<ToolSidebarMode, ModeMeta> = {
  autoCount:  { title: "Auto Count",  icon: CircleDot,     step: "Configure options then click Analyze." },
  facade:     { title: "Facade",      icon: Building2,     step: "Set confidence, then click Analyze Facade." },
  doorFinder: { title: "Door Finder", icon: DoorOpen,      step: "Configure options, then click Find Doors." },
  wallFinder: { title: "Wall Finder", icon: PanelsTopLeft, step: "Configure options, then click Find Walls." },
  roomFinder: { title: "Room Finder", icon: LayoutTemplate, step: "Configure options, then click Find Rooms." },
  searchText: { title: "Search Text", icon: Type,          step: "Enter text and click Search." },
  floorArea:  { title: "Floor Area",  icon: LayoutGrid,    step: "Click inside a room on the drawing." },
};

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
  primaryAnalyzeLabel,
  onPrimaryAnalyze,
  primaryAnalyzeDisabled,
  primaryAnalyzeLoading,
  onClear,
  clearDisabled,
  ...controls
}: UnifiedQtoRightSidebarProps) {
  const { tool } = useCadAnalyzerTool();
  const isNavigationTool = tool === "pointer" || tool === "hand";

  const title = isNavigationTool ? "Saved items" : MODE_META[mode].title;
  const ariaLabelText = isNavigationTool
    ? "Saved items panel"
    : `${MODE_META[mode].title} options`;

  const showObjectForm = !isNavigationTool && showObjectDataForm;
  const ModeIcon = isNavigationTool ? null : MODE_META[mode].icon;
  const modeStep = isNavigationTool ? null : MODE_META[mode].step;

  return (
    <aside
      className={cn(
        "absolute bottom-0 right-0 top-0 z-50 flex max-h-full min-h-0 flex-col",
        "border-l border-border/70 bg-background/95 text-foreground shadow-md backdrop-blur-md",
        "rounded-l-lg",
        "w-full min-w-0 sm:max-w-[min(100vw,320px)] sm:w-75 md:w-70 lg:w-75",
        "transition-transform duration-300 ease-out motion-reduce:transition-none",
        open ? "translate-x-0" : "translate-x-full",
        className
      )}
      aria-modal="true"
      role="dialog"
      aria-label={ariaLabelText}
      aria-hidden={!open}
      onTransitionEnd={onTransitionEnd}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border/70 px-3 py-2.5">
        {ModeIcon && (
          <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary/10 p-1.5">
            <ModeIcon className="h-3.5 w-3.5 text-primary" aria-hidden strokeWidth={2} />
          </span>
        )}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent",
            "text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted/80 hover:text-foreground"
          )}
          aria-label={isNavigationTool ? "Close panel" : `Close ${title.toLowerCase()} panel`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Workflow step hint */}
      {modeStep && (
        <div className="shrink-0 border-b border-border/60 bg-muted/30 px-3 py-2">
          <p className="text-[11px] leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">Next: </span>
            {modeStep}
          </p>
        </div>
      )}

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5 pt-4">
        {!isNavigationTool ? (
          <>
            <ToolOptionsControls mode={mode} {...controls} />

            {/* Analyze / Clear row */}
            <div
              className={cn(
                "flex flex-row items-stretch gap-2 border-t border-border/60",
                mode === "floorArea" ? "mt-3 pt-4" : "mt-5 pt-5"
              )}
            >
              <button
                type="button"
                disabled={primaryAnalyzeDisabled}
                onClick={onPrimaryAnalyze}
                className={cn(
                  "inline-flex min-h-10 min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5",
                  "bg-primary text-primary-foreground shadow-sm transition-all",
                  "text-xs font-semibold tracking-tight",
                  "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                {primaryAnalyzeLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <ScanSearch className="h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 truncate">{primaryAnalyzeLabel}</span>
              </button>

              <Button
                type="button"
                variant="outline"
                className="flex min-h-10 min-w-0 shrink-0 flex-row items-center justify-center gap-1.5 px-3"
                disabled={clearDisabled}
                onClick={onClear}
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-sm font-medium">Clear</span>
              </Button>
            </div>
          </>
        ) : (
          /* Navigation tool: only Clear */
          <div className="mb-5 flex flex-row border-b border-border/60 pb-5">
            <Button
              type="button"
              variant="outline"
              className="flex min-h-10 w-full flex-row items-center justify-center gap-1.5 px-4"
              disabled={clearDisabled}
              onClick={onClear}
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-sm font-medium">Clear all</span>
            </Button>
          </div>
        )}

        <ObjectMetadataPanelContent
          {...objectMetadata}
          showObjectDataForm={showObjectForm}
          sectionRef={objectDataSectionRef}
          sectionId={QTO_OBJECT_DATA_SECTION_ID}
          className={cn(isNavigationTool && "mt-0 border-0 pt-0")}
        />
      </div>
    </aside>
  );
}
