"use client";

import { useCallback } from "react";
import { FloatingActionBar } from "./FloatingActionBar";
import { useCadAnalyzerTool } from "@/contexts/CadAnalyzerToolContext";

export type CadAnalyzerFloatingBridgeProps = {
  /** Fires when the user selects Auto Count (opens options panel + drawing mode). */
  onAutoCountActivate?: () => void;
};

/** Renders the bottom bar using tool context (must be inside `CadAnalyzerToolProvider`). */
export function CadAnalyzerFloatingBridge({
  onAutoCountActivate,
}: CadAnalyzerFloatingBridgeProps) {
  const { tool, setTool } = useCadAnalyzerTool();

  const handleToolChange = useCallback(
    (t: Parameters<typeof setTool>[0]) => {
      if (t === "autoCount" && tool === "autoCount") {
        onAutoCountActivate?.();
        return;
      }
      setTool(t);
      if (t === "autoCount") onAutoCountActivate?.();
    },
    [setTool, tool, onAutoCountActivate]
  );

  return <FloatingActionBar activeTool={tool} onToolChange={handleToolChange} />;
}
