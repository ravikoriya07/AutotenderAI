"use client";

import { useEffect, useRef, useState } from "react";
import { SOW_BODY_HTML } from "@/components/schedule-of-works/sowBodyHtml";
import { useResearchProject } from "@/contexts/ResearchProjectContext";
import {
  cancelLoadSavedSowSplit,
  loadScheduleOfWorksEngine,
  registerSowSplitLoad,
  registerSowSplitSubmit,
  runLoadSavedSowSplit,
  setSowFoundFiles,
  setSowFoundFilesLoading,
  setSowProjectContext,
} from "@/lib/schedule-of-works/loadScheduleOfWorksEngine";
import {
  fetchSavedSowSplit,
  fetchSowByJobId,
  submitSowSplit,
  type SowFoundFile,
} from "@/services/sowService";
import "./schedule-of-works.css";

export function ScheduleOfWorksView() {
  const sowHostRef = useRef<HTMLDivElement>(null);
  const sowHtmlMountedRef = useRef(false);
  const pendingSowFilesRef = useRef<{ loading: boolean; files: SowFoundFile[] }>({
    loading: false,
    files: [],
  });
  const [engineError, setEngineError] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const {
    selectedProjectJobId,
    completedStepProjects,
    setNeedsProjectHighlight,
  } = useResearchProject();

  useEffect(() => {
    const host = sowHostRef.current;
    if (host && !sowHtmlMountedRef.current) {
      host.innerHTML = SOW_BODY_HTML;
      sowHtmlMountedRef.current = true;
    }

    let cancelled = false;

    loadScheduleOfWorksEngine()
      .then(() => {
        if (cancelled) return;
        (
          window as Window & { refreshSowEngineDom?: () => void }
        ).refreshSowEngineDom?.();
        setEngineReady(true);
        setEngineError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEngineError(
          err instanceof Error ? err.message : "Failed to initialize module"
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!engineReady) return;

    const onNeedsProject = () => setNeedsProjectHighlight(true);
    window.addEventListener("sow-needs-project", onNeedsProject);
    return () => window.removeEventListener("sow-needs-project", onNeedsProject);
  }, [engineReady, setNeedsProjectHighlight]);

  useEffect(() => {
    if (!engineReady) return;

    const jobId = selectedProjectJobId.trim();
    const project = completedStepProjects.find((p) => p.job_id === jobId);
    setSowProjectContext({
      jobId,
      projectName: project?.project_name,
    });
  }, [engineReady, selectedProjectJobId, completedStepProjects]);

  useEffect(() => {
    if (!engineReady) return;
    return registerSowSplitSubmit((jobId, request, signal) =>
      submitSowSplit(jobId, request, signal)
    );
  }, [engineReady]);

  useEffect(() => {
    if (!engineReady) return;
    return registerSowSplitLoad((jobId, signal) =>
      fetchSavedSowSplit(jobId, signal)
    );
  }, [engineReady]);

  useEffect(() => {
    if (!engineReady) return;

    const pending = pendingSowFilesRef.current;
    setSowFoundFilesLoading(pending.loading);
    if (!pending.loading) {
      setSowFoundFiles(pending.files);
    }
  }, [engineReady]);

  useEffect(() => {
    const jobId = selectedProjectJobId.trim();
    if (!jobId) {
      pendingSowFilesRef.current = { loading: false, files: [] };
      if (engineReady) {
        setSowFoundFilesLoading(false);
        setSowFoundFiles([]);
      }
      return;
    }

    pendingSowFilesRef.current = { loading: true, files: [] };
    if (engineReady) {
      setSowFoundFilesLoading(true);
    }

    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetchSowByJobId(jobId, controller.signal);
        if (controller.signal.aborted) return;
        console.log(response);
        const files =
          response.status === "success" && Array.isArray(response.found_files)
            ? response.found_files
            : [];
        pendingSowFilesRef.current = { loading: false, files };
        if (engineReady) {
          setSowFoundFilesLoading(false);
          setSowFoundFiles(files);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[schedule-of-works] GET /sow/find failed", err);
        pendingSowFilesRef.current = { loading: false, files: [] };
        if (engineReady) {
          setSowFoundFilesLoading(false);
          setSowFoundFiles([]);
        }
      }
    })();

    return () => controller.abort();
  }, [selectedProjectJobId, engineReady]);

  useEffect(() => {
    if (!engineReady) return;

    const jobId = selectedProjectJobId.trim();
    cancelLoadSavedSowSplit();

    if (!jobId) {
      runLoadSavedSowSplit("");
      return;
    }

    const controller = new AbortController();
    runLoadSavedSowSplit(jobId, controller.signal);

    return () => {
      controller.abort();
      cancelLoadSavedSowSplit();
    };
  }, [engineReady, selectedProjectJobId]);

  return (
    <div className="sow-module relative h-full min-h-0 w-full">
      <div
        ref={sowHostRef}
        className="flex h-full min-h-0 w-full flex-1"
        suppressHydrationWarning
      />
      {engineError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 p-6 text-sm text-destructive">
          {engineError}
        </div>
      ) : null}
      {!engineReady && !engineError ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 text-sm text-muted-foreground"
          aria-live="polite"
        >
          Loading Schedule of Works…
        </div>
      ) : null}
    </div>
  );
}
