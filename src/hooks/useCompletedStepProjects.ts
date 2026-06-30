"use client";

import { useEffect, useMemo, useState } from "react";
import { PROJECT_CATALOG_REFRESH_EVENT } from "@/lib/projectCatalogRefresh";
import {
  fetchCompletedSteps,
  flattenProjectsFromCompletedSteps,
  type CompletedStepStat,
} from "@/services/statsService";

export type UseCompletedStepProjectsOptions = {
  /** When false, skips fetch and clears the list (e.g. Library without project dropdown). */
  enabled?: boolean;
  /** When set, passes `step_name` to GET /stats/completed-steps (Research page). */
  stepName?: string;
};

/**
 * Project catalog from GET /stats/completed-steps → unique projects by job_id.
 */
export function useCompletedStepProjects(options?: UseCompletedStepProjectsOptions) {
  const enabled = options?.enabled !== false;
  const stepName = options?.stepName?.trim();
  const [completedSteps, setCompletedSteps] = useState<CompletedStepStat[]>([]);
  const [loading, setLoading] = useState(() => enabled);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    function onCatalogRefresh() {
      setRefreshToken((t) => t + 1);
    }
    // Re-fetch when the user returns to the tab — catches jobs processed in the
    // background (upload pipeline) that don't fire requestProjectCatalogRefresh.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        setRefreshToken((t) => t + 1);
      }
    }
    if (typeof window === "undefined") return;
    window.addEventListener(PROJECT_CATALOG_REFRESH_EVENT, onCatalogRefresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener(PROJECT_CATALOG_REFRESH_EVENT, onCatalogRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setCompletedSteps([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        /** No AbortSignal: shared in-flight + Strict Mode unmount was cancelling the only GET. */
        const rows = await fetchCompletedSteps({
          ...(stepName ? { stepName } : {}),
        });
        if (!cancelled) setCompletedSteps(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, stepName, refreshToken]);

  const projects = useMemo(
    () => flattenProjectsFromCompletedSteps(completedSteps),
    [completedSteps]
  );

  return { projects, loading };
}
