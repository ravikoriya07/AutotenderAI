"use client";

import { useCallback } from "react";
import { FloatingActionBar } from "./FloatingActionBar";
import { useCadAnalyzerTool } from "@/contexts/CadAnalyzerToolContext";

export type CadAnalyzerFloatingBridgeProps = {
  /** Opens the Search Text panel immediately (no box drawing). */
  onSearchTextSelect?: () => void;
  /** User selected Auto Count from the bar (updates last action + sidebar mode when open). */
  onAutoCountToolSelect?: () => void;
};

/** Renders the bottom bar using tool context (must be inside `CadAnalyzerToolProvider`). */
export function CadAnalyzerFloatingBridge({
  onSearchTextSelect,
  onAutoCountToolSelect,
}: CadAnalyzerFloatingBridgeProps) {
  const { tool, setTool } = useCadAnalyzerTool();

  const handleToolChange = useCallback(
    (t: Parameters<typeof setTool>[0]) => {
      if (t === "autoCount" && tool === "autoCount") {
        return;
      }
      setTool(t);
      if (t === "textSearch") {
        onSearchTextSelect?.();
      } else if (t === "autoCount") {
        onAutoCountToolSelect?.();
      }
    },
    [setTool, tool, onSearchTextSelect, onAutoCountToolSelect]
  );

  return <FloatingActionBar activeTool={tool} onToolChange={handleToolChange} />;
}
