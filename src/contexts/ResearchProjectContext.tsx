"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useCompletedStepProjects } from "@/hooks/useCompletedStepProjects";
import type { CompletedStepProject } from "@/services/statsService";

const STORAGE_KEY = "autotender_research_selected_project_job_id";

type ResearchProjectContextValue = {
  selectedProjectJobId: string;
  setSelectedProjectJobId: (jobId: string) => void;
  /** Shared catalog for header + research/library/QTO (one GET /stats/completed-steps per route). */
  completedStepProjects: CompletedStepProject[];
  completedStepsLoading: boolean;
  /**
   * Keeps a just-created project in the Schedule of Works header list until
   * GET /stats/completed-steps?step_name=initialized includes it.
   */
  pinProject: (project: CompletedStepProject) => void;
  /** True when user tried to submit without a project — triggers shake + error ring on the select. */
  needsProjectHighlight: boolean;
  setNeedsProjectHighlight: (v: boolean) => void;
};

const ResearchProjectContext =
  createContext<ResearchProjectContextValue | null>(null);

export function ResearchProjectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedProjectJobId, setSelectedProjectJobIdState] = useState("");
  const [needsProjectHighlight, setNeedsProjectHighlight] = useState(false);
  const [pinnedProjects, setPinnedProjects] = useState<CompletedStepProject[]>([]);

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
    if (jobId.trim()) {
      setNeedsProjectHighlight(false);
    }
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

  const pathname = usePathname() ?? "";
  const onResearchRoute = pathname.startsWith("/research");
  const onOrganisationLibraryRoute = pathname === "/library";
  const onQuantityTakeOffRoute = pathname.startsWith("/quantity-take-off");
  const onScheduleOfWorksRoute = pathname.startsWith("/schedule-of-works");
  const needsCompletedStepsCatalog =
    onResearchRoute ||
    onOrganisationLibraryRoute ||
    onQuantityTakeOffRoute ||
    onScheduleOfWorksRoute;

  const catalogStepName = onScheduleOfWorksRoute
    ? "initialized"
    : onResearchRoute || onQuantityTakeOffRoute
      ? "upload_to_neo4j"
      : undefined;

  const { projects: fetchedProjects, loading: completedStepsLoading } =
    useCompletedStepProjects({
      enabled: needsCompletedStepsCatalog,
      ...(catalogStepName ? { stepName: catalogStepName } : {}),
    });

  const pinProject = useCallback((project: CompletedStepProject) => {
    const jobId = project.job_id.trim();
    const projectName = project.project_name.trim() || "Unnamed project";
    if (!jobId) return;
    setPinnedProjects((prev) => {
      if (prev.some((item) => item.job_id === jobId)) return prev;
      return [...prev, { job_id: jobId, project_name: projectName }];
    });
  }, []);

  const completedStepProjects = useMemo(() => {
    if (!onScheduleOfWorksRoute || pinnedProjects.length === 0) {
      return fetchedProjects;
    }
    const seen = new Set(fetchedProjects.map((project) => project.job_id));
    const extras = pinnedProjects.filter((project) => !seen.has(project.job_id));
    if (extras.length === 0) return fetchedProjects;
    return [...fetchedProjects, ...extras].sort((a, b) =>
      a.project_name.localeCompare(b.project_name, undefined, {
        sensitivity: "base",
      })
    );
  }, [onScheduleOfWorksRoute, fetchedProjects, pinnedProjects]);

  const value = useMemo(
    () => ({
      selectedProjectJobId,
      setSelectedProjectJobId,
      completedStepProjects,
      completedStepsLoading,
      pinProject,
      needsProjectHighlight,
      setNeedsProjectHighlight,
    }),
    [
      selectedProjectJobId,
      setSelectedProjectJobId,
      completedStepProjects,
      completedStepsLoading,
      pinProject,
      needsProjectHighlight,
    ]
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
