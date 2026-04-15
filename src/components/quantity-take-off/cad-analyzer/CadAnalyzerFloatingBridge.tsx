"use client";

import { useCallback } from "react";
import { FloatingActionBar } from "./FloatingActionBar";
import { useCadAnalyzerTool } from "@/contexts/CadAnalyzerToolContext";

export type CadAnalyzerFloatingBridgeProps = {
  /** Opens the Search Text panel immediately (no box drawing). */
  onSearchTextSelect?: () => void;
  /** User selected Auto Count from the bar (updates last action + sidebar mode when open). */
  onAutoCountToolSelect?: () => void;
  /** User selected Door Finder from the bar. */
  onDoorFinderToolSelect?: () => void;
  /** User selected Wall Finder from the bar. */
  onWallFinderToolSelect?: () => void;
};

/** Renders the bottom bar using tool context (must be inside `CadAnalyzerToolProvider`). */
export function CadAnalyzerFloatingBridge({
  onSearchTextSelect,
  onAutoCountToolSelect,
  onDoorFinderToolSelect,
  onWallFinderToolSelect,
}: CadAnalyzerFloatingBridgeProps) {
  const { tool, setTool } = useCadAnalyzerTool();

  const handleToolChange = useCallback(
    (t: Parameters<typeof setTool>[0]) => {
      if (t === "autoCount" && tool === "autoCount") {
        return;
      }
      if (t === "doorFinder" && tool === "doorFinder") {
        return;
      }
      if (t === "wallFinder" && tool === "wallFinder") {
        return;
      }
      setTool(t);
      if (t === "textSearch") {
        onSearchTextSelect?.();
      } else if (t === "autoCount") {
        onAutoCountToolSelect?.();
      } else if (t === "doorFinder") {
        onDoorFinderToolSelect?.();
      } else if (t === "wallFinder") {
        onWallFinderToolSelect?.();
      }
    },
    [
      setTool,
      tool,
      onSearchTextSelect,
      onAutoCountToolSelect,
      onDoorFinderToolSelect,
      onWallFinderToolSelect,
    ]
  );

  return <FloatingActionBar activeTool={tool} onToolChange={handleToolChange} />;
}
