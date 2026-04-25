"use client";

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
import { useCadAnalyzerTool, type CadAnalyzerTool } from "@/contexts/CadAnalyzerToolContext";

type HintDef = {
  icon: LucideIcon;
  label: string;
  instruction: string;
};

const TOOL_HINTS: Record<CadAnalyzerTool, HintDef> = {
  pointer: {
    icon: MousePointer2,
    label: "Select",
    instruction: "Click a detected symbol on the drawing to remove it.",
  },
  hand: {
    icon: Hand,
    label: "Pan",
    instruction: "Drag to pan the drawing. Use scroll wheel to zoom in and out.",
  },
  autoCount: {
    icon: CircleDot,
    label: "Auto Count",
    instruction: "Draw a rectangle around the symbols you want to count, then click Analyze.",
  },
  textSearch: {
    icon: Type,
    label: "Search Text",
    instruction: "Enter the text label to find in the drawing, then click Search.",
  },
  floorArea: {
    icon: LayoutGrid,
    label: "Floor Area",
    instruction: "Click anywhere inside a room to automatically extract its floor area.",
  },
  facade: {
    icon: Building2,
    label: "Facade",
    instruction: "Draw a rectangle around a facade section to detect and count windows.",
  },
  doorFinder: {
    icon: DoorOpen,
    label: "Door Finder",
    instruction: "Draw a rectangle around the area where you want to detect doors.",
  },
  wallFinder: {
    icon: PanelsTopLeft,
    label: "Wall Finder",
    instruction: "Draw a rectangle around walls to detect and measure their total length.",
  },
  roomFinder: {
    icon: LayoutTemplate,
    label: "Room Finder",
    instruction: "Draw a rectangle around rooms to detect boundaries and calculate areas.",
  },
};

/**
 * Context-aware workflow hint bar — replaces the old permanently-disabled Analyze/Clear buttons.
 * Shows the active tool name and a one-line instruction so users always know what to do next.
 */
export function CadAnalyzerSubHeader() {
  const { tool } = useCadAnalyzerTool();
  const { icon: Icon, label, instruction } = TOOL_HINTS[tool];

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2.5 border-b border-border/80 bg-muted/30 px-3 py-2 sm:px-4 sm:py-2.5">
      <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary/10 p-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">
          <span className="mr-1.5 font-semibold text-foreground">{label}:</span>
          {instruction}
        </p>
      </div>
    </div>
  );
}
