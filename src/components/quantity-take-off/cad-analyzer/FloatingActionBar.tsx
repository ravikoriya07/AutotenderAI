"use client";

import type { ReactNode } from "react";
import {
  Building2,
  CircleDot,
  DoorOpen,
  Hand,
  LayoutGrid,
  LayoutTemplate,
  MousePointer2,
  PanelsTopLeft,
  Type,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CadAnalyzerTool } from "@/contexts/CadAnalyzerToolContext";

type ToolDef = { id: CadAnalyzerTool; label: string; icon: LucideIcon };

/** Navigation tools — always visible, no ROI drawing. */
const NAV_TOOLS: ToolDef[] = [
  { id: "pointer", label: "Select", icon: MousePointer2 },
  { id: "hand",    label: "Pan",    icon: Hand },
];

/** AI analysis tools — draw a region (or click) to trigger detection. */
const ANALYSIS_TOOLS: ToolDef[] = [
  { id: "autoCount",  label: "Auto Count",  icon: CircleDot },
  { id: "textSearch", label: "Search Text", icon: Type },
  { id: "floorArea",  label: "Floor Area",  icon: LayoutGrid },
  { id: "facade",     label: "Facade",      icon: Building2 },
  { id: "doorFinder", label: "Doors",       icon: DoorOpen },
  { id: "wallFinder", label: "Walls",       icon: PanelsTopLeft },
  { id: "roomFinder", label: "Rooms",       icon: LayoutTemplate },
];

function ToolbarTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="group/tooltip relative flex shrink-0">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-200 -translate-x-1/2",
          "whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] font-medium text-popover-foreground",
          "shadow-[0_4px_16px_rgba(15,23,42,0.14)] opacity-0 transition-opacity duration-150",
          "group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function ToolButton({
  label,
  icon: Icon,
  active,
  onClick,
}: Omit<ToolDef, "id"> & { active: boolean; onClick: () => void }) {
  return (
    <ToolbarTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "group inline-flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-1.5 transition-all duration-150",
          "min-w-11 sm:min-w-13",
          active
            ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
            : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/80 hover:text-foreground"
        )}
      >
        <Icon
          className={cn(
            "shrink-0 transition-colors duration-150",
            "size-4",
            active ? "text-primary" : "text-current"
          )}
          aria-hidden
          strokeWidth={active ? 2.4 : 2}
          absoluteStrokeWidth
        />
        <span
          className={cn(
            "text-[10px] font-medium leading-none tracking-tight",
            "hidden sm:block",
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )}
        >
          {label}
        </span>
        {active && (
          <span className="mt-0.5 h-0.5 w-3 rounded-full bg-primary hidden sm:block" aria-hidden />
        )}
      </button>
    </ToolbarTooltip>
  );
}

export type FloatingActionBarProps = {
  activeTool: CadAnalyzerTool;
  onToolChange: (tool: CadAnalyzerTool) => void;
  className?: string;
  searchTextAreaSelectionActive?: boolean;
  searchTextAreaSelectionDisabled?: boolean;
  onSearchTextAreaSelectionToggle?: () => void;
};

/**
 * Toolbar pill — positioning handled by `CadAnalyzerCanvas` (absolute bottom slot, z-[100]).
 * Two groups: navigation (Select / Pan) and AI analysis tools, separated by a divider.
 */
export function FloatingActionBar({
  activeTool,
  onToolChange,
  className,
  searchTextAreaSelectionActive = false,
  searchTextAreaSelectionDisabled = false,
  onSearchTextAreaSelectionToggle,
}: FloatingActionBarProps) {
  return (
    <div
      className={cn(
        "pointer-events-none flex w-full max-w-[calc(100%-1rem)] justify-center px-1 sm:max-w-full sm:px-2",
        className
      )}
      role="toolbar"
      aria-label="Canvas tools"
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-full flex-nowrap items-center gap-0.5 rounded-2xl px-1.5 py-1.5 sm:gap-1 sm:px-2 sm:py-2",
          "border border-border bg-card/95 text-card-foreground",
          "shadow-[0_10px_40px_-8px_rgba(15,23,42,0.22),0_4px_14px_rgba(15,23,42,0.12)]",
          "ring-1 ring-primary/15",
          "backdrop-blur-sm"
        )}
      >
        {/* Navigation group */}
        <div className="flex items-center gap-0.5 sm:gap-1" role="group" aria-label="Navigation tools">
          {NAV_TOOLS.map((tool) => (
            <ToolButton
              key={tool.id}
              {...tool}
              active={activeTool === tool.id}
              onClick={() => onToolChange(tool.id)}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="mx-1 h-7 w-px shrink-0 rounded-full bg-border/60" aria-hidden />

        {/* AI analysis group */}
        <div className="flex items-center gap-0.5 sm:gap-1" role="group" aria-label="AI analysis tools">
          {ANALYSIS_TOOLS.map((tool) => (
            <ToolButton
              key={tool.id}
              {...tool}
              active={activeTool === tool.id}
              onClick={() => onToolChange(tool.id)}
            />
          ))}
        </div>

        {activeTool === "textSearch" ? (
          <>
            <div className="mx-1 h-7 w-px shrink-0 rounded-full bg-border/60" aria-hidden />
            <div className="flex items-center gap-1" role="group" aria-label="Search text area selection">
              <ToolbarTooltip
                label={
                  searchTextAreaSelectionActive
                    ? "Cancel manual highlight selection."
                    : "Draw a box on the PDF to add a missing text highlight."
                }
              >
                <button
                  type="button"
                  aria-label={
                    searchTextAreaSelectionActive
                      ? "Cancel manual highlight selection"
                      : "Add missing highlight manually"
                  }
                  disabled={searchTextAreaSelectionDisabled}
                  onClick={onSearchTextAreaSelectionToggle}
                  className={cn(
                    "inline-flex min-h-9 items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
                    searchTextAreaSelectionActive
                      ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                      : "border-border/70 bg-card/70 text-foreground hover:bg-muted/80",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  {searchTextAreaSelectionActive ? "Cancel" : "Add Missing Highlight"}
                </button>
              </ToolbarTooltip>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
