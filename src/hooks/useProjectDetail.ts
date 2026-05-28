"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { getApiErrorDetailMessage } from "@/lib/apiErrorMessage";
import { fetchProjectDetail } from "@/services/projectDetailService";
import type { ProjectDetailData } from "@/types/project-detail";

const LOAD_ERROR_FALLBACK =
  "Could not load project details. Please try again.";

export function useProjectDetail(projectId: string) {
  const [detail, setDetail] = useState<ProjectDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const trimmed = projectId.trim();
    if (!trimmed) {
      setDetail(null);
      setLoading(false);
      setError("Invalid project.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchProjectDetail(trimmed, signal);
      if (signal?.aborted) return;
      if (!data.tabs.length) {
        setDetail(null);
        setError("No project detail data available.");
        return;
      }
      setDetail(data);
    } catch (err) {
      if (axios.isCancel(err) || signal?.aborted) return;
      setDetail(null);
      setError(getApiErrorDetailMessage(err, LOAD_ERROR_FALLBACK));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = useCallback(() => load(), [load]);

  return { detail, loading, error, reload };
}
