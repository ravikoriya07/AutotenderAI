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
    if (typeof window === "undefined") return;
    window.addEventListener(PROJECT_CATALOG_REFRESH_EVENT, onCatalogRefresh);
    return () =>
      window.removeEventListener(PROJECT_CATALOG_REFRESH_EVENT, onCatalogRefresh);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setCompletedSteps([]);
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = await fetchCompletedSteps({
          signal: ac.signal,
          ...(stepName ? { stepName } : {}),
        });
        if (!cancelled) setCompletedSteps(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [enabled, stepName, refreshToken]);

  const projects = useMemo(
    () => flattenProjectsFromCompletedSteps(completedSteps),
    [completedSteps]
  );

  return { projects, loading };
}
