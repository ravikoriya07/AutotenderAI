"use client";

import { FloatingActionBar } from "./FloatingActionBar";
import { useCadAnalyzerTool } from "@/contexts/CadAnalyzerToolContext";

/** Renders the bottom bar using tool context (must be inside `CadAnalyzerToolProvider`). */
export function CadAnalyzerFloatingBridge() {
  const { tool, setTool } = useCadAnalyzerTool();
  return <FloatingActionBar activeTool={tool} onToolChange={setTool} />;
}
