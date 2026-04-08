"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Canvas tools. Pan/zoom only when `hand` (see `CadPdfCanvasStack`).
 */
export type CadAnalyzerTool =
  | "pointer"
  | "hand"
  | "autoCount"
  | "textSearch"
  | "floorArea"
  | "facade"
  | "doorFinder"
  | "wallFinder"
  | "roomFinder";

type CadAnalyzerToolContextValue = {
  tool: CadAnalyzerTool;
  setTool: (t: CadAnalyzerTool) => void;
};

const CadAnalyzerToolContext =
  createContext<CadAnalyzerToolContextValue | null>(null);

export function CadAnalyzerToolProvider({ children }: { children: ReactNode }) {
  const [tool, setToolState] = useState<CadAnalyzerTool>("pointer");
  const setTool = useCallback((t: CadAnalyzerTool) => {
    setToolState(t);
  }, []);
  const value = useMemo(
    () => ({ tool, setTool }),
    [tool, setTool]
  );
  return (
    <CadAnalyzerToolContext.Provider value={value}>
      {children}
    </CadAnalyzerToolContext.Provider>
  );
}

export function useCadAnalyzerTool(): CadAnalyzerToolContextValue {
  const ctx = useContext(CadAnalyzerToolContext);
  if (!ctx) {
    throw new Error("useCadAnalyzerTool must be used within CadAnalyzerToolProvider");
  }
  return ctx;
}
