"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "autotender_research_selected_project_job_id";

type ResearchProjectContextValue = {
  selectedProjectJobId: string;
  setSelectedProjectJobId: (jobId: string) => void;
};

const ResearchProjectContext =
  createContext<ResearchProjectContextValue | null>(null);

export function ResearchProjectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedProjectJobId, setSelectedProjectJobIdState] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (typeof raw === "string" && raw.trim()) {
        setSelectedProjectJobIdState(raw.trim());
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setSelectedProjectJobId = useCallback((jobId: string) => {
    setSelectedProjectJobIdState(jobId);
    if (typeof window === "undefined") return;
    try {
      if (jobId.trim()) {
        localStorage.setItem(STORAGE_KEY, jobId.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ selectedProjectJobId, setSelectedProjectJobId }),
    [selectedProjectJobId, setSelectedProjectJobId]
  );

  return (
    <ResearchProjectContext.Provider value={value}>
      {children}
    </ResearchProjectContext.Provider>
  );
}

export function useResearchProject(): ResearchProjectContextValue {
  const ctx = useContext(ResearchProjectContext);
  if (!ctx) {
    throw new Error(
      "useResearchProject must be used within ResearchProjectProvider"
    );
  }
  return ctx;
}

export function useResearchProjectOptional(): ResearchProjectContextValue | null {
  return useContext(ResearchProjectContext);
}
