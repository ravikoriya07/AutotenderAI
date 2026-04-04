"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchCompletedSteps,
  flattenProjectsFromCompletedSteps,
  type CompletedStepStat,
} from "@/services/statsService";

export type UseCompletedStepProjectsOptions = {
  /** When false, skips fetch and clears the list (e.g. Library without project dropdown). */
  enabled?: boolean;
};

/**
 * Same project catalog as Library: GET /stats/completed-steps → unique projects by job_id.
 */
export function useCompletedStepProjects(options?: UseCompletedStepProjectsOptions) {
  const enabled = options?.enabled !== false;
  const [completedSteps, setCompletedSteps] = useState<CompletedStepStat[]>([]);
  const [loading, setLoading] = useState(() => enabled);

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
        const rows = await fetchCompletedSteps({ signal: ac.signal });
        if (!cancelled) setCompletedSteps(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [enabled]);

  const projects = useMemo(
    () => flattenProjectsFromCompletedSteps(completedSteps),
    [completedSteps]
  );

  return { projects, loading };
}
