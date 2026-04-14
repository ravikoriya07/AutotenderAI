"use client";

import { useCallback } from "react";
import { FloatingActionBar } from "./FloatingActionBar";
import { useCadAnalyzerTool } from "@/contexts/CadAnalyzerToolContext";

/** Renders the bottom bar using tool context (must be inside `CadAnalyzerToolProvider`). */
export function CadAnalyzerFloatingBridge() {
  const { tool, setTool } = useCadAnalyzerTool();

  const handleToolChange = useCallback(
    (t: Parameters<typeof setTool>[0]) => {
      if (t === "autoCount" && tool === "autoCount") {
        return;
      }
      setTool(t);
    },
    [setTool, tool]
  );

  return <FloatingActionBar activeTool={tool} onToolChange={handleToolChange} />;
}
