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

/** Select + Pan first; then detection tools (titles match product UI). */
const TOOLS: {
  id: CadAnalyzerTool;
  tooltip: string;
  icon: LucideIcon;
}[] = [
  { id: "pointer", tooltip: "Select", icon: MousePointer2 },
  { id: "hand", tooltip: "Pan", icon: Hand },
  { id: "autoCount", tooltip: "Auto Count", icon: CircleDot },
  { id: "textSearch", tooltip: "Search Text", icon: Type },
  { id: "floorArea", tooltip: "Floor Area", icon: LayoutGrid },
  { id: "facade", tooltip: "Facade", icon: Building2 },
  { id: "doorFinder", tooltip: "Door Finder", icon: DoorOpen },
  { id: "wallFinder", tooltip: "Wall Finder", icon: PanelsTopLeft },
  { id: "roomFinder", tooltip: "Room Finder", icon: LayoutTemplate },
];

function ToolbarTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="group/tooltip relative flex shrink-0">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[200] -translate-x-1/2",
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

function ToolIcon({
  Icon,
  className,
}: {
  Icon: LucideIcon;
  className?: string;
}) {
  return (
    <Icon
      className={cn("shrink-0", className)}
      aria-hidden
      strokeWidth={2}
      absoluteStrokeWidth
    />
  );
}

export type FloatingActionBarProps = {
  activeTool: CadAnalyzerTool;
  onToolChange: (tool: CadAnalyzerTool) => void;
  className?: string;
};

/**
 * Toolbar pill — positioning is handled by `CadAnalyzerCanvas` (absolute bottom slot, z-[100]).
 */
export function FloatingActionBar({
  activeTool,
  onToolChange,
  className,
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
          "pointer-events-auto flex max-w-full flex-nowrap items-center justify-center gap-1 rounded-[16px] px-1.5 py-1.5 sm:gap-1.5 sm:px-2.5 sm:py-2",
          "border border-border bg-card text-card-foreground",
          "shadow-[0_10px_40px_-8px_rgba(15,23,42,0.18),0_4px_14px_rgba(15,23,42,0.1)]",
          "ring-1 ring-primary/15",
          "backdrop-blur-sm"
        )}
      >
        {TOOLS.map(({ id, tooltip, icon: Icon }) => {
          const active = activeTool === id;
          return (
            <ToolbarTooltip key={id} label={tooltip}>
              <button
                type="button"
                aria-label={tooltip}
                aria-pressed={active}
                onClick={() => onToolChange(id)}
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors duration-150 sm:size-8 md:size-9",
                  "hover:border-border/60 hover:bg-muted/80 hover:text-foreground",
                  active &&
                    "border-primary/30 bg-primary/10 text-primary shadow-sm hover:border-primary/35 hover:bg-primary/12 hover:text-primary"
                )}
              >
                <ToolIcon Icon={Icon} className="size-3 sm:size-3.5 md:size-4" />
              </button>
            </ToolbarTooltip>
          );
        })}
      </div>
    </div>
  );
}
