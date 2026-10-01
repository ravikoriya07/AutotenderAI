"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { SOW_BODY_HTML } from "@/components/schedule-of-works/sowBodyHtml";
import { SowCreateProjectModal } from "@/components/schedule-of-works/SowCreateProjectModal";
import { useResearchProject } from "@/contexts/ResearchProjectContext";
import {
  cancelLoadSavedSowSplit,
  loadScheduleOfWorksEngine,
  registerSowAllocationsPatch,
  registerSowDownloadExport,
  registerSowSplitLoad,
  registerSowSplitSubmit,
  registerSowWorkbookSubmit,
  registerSowWorkbookTemplateValidate,
  runLoadSavedSowSplit,
  runSowSplit,
  setSowFoundFiles,
  setSowFoundFilesLoading,
  setSowProjectContext,
} from "@/lib/schedule-of-works/loadScheduleOfWorksEngine";
import { assertSowWorkbookTemplateContent } from "@/lib/schedule-of-works/validateSowWorkbookTemplate";
import { requestProjectCatalogRefresh } from "@/lib/projectCatalogRefresh";
import type { ProjectFormValues } from "@/lib/validations/projectFormSchema";
import { createProject } from "@/services/projectService";
import type { CreateProjectResponse } from "@/types/project";
import {
  downloadSowExport,
  fetchSavedSowSplit,
  fetchSowByJobId,
  patchSowAllocations,
  submitSowSplit,
  submitSowWorkbook,
  type SowFoundFile,
} from "@/services/sowService";
import "./schedule-of-works.css";

export function ScheduleOfWorksView() {
  const sowHostRef = useRef<HTMLDivElement>(null);
  const sowHtmlMountedRef = useRef(false);
  const pendingSowFilesRef = useRef<{
    loading: boolean;
    files: SowFoundFile[];
    projectName?: string;
    clientName?: string;
  }>({
    loading: false,
    files: [],
  });
  const [engineError, setEngineError] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const engineReadyRef = useRef(false);
  const lastProjectJobIdRef = useRef("");
  /**
   * Job id adopted from the create-project popup. Stays set until the user
   * picks a different project, so a catalog refresh cannot clear the upload
   * or start GET /sow/find and saved GET /sow/split mid-run.
   */
  const skipProjectSwitchJobIdRef = useRef<string | null>(null);
  const creatingLockRef = useRef(false);
  const {
    selectedProjectJobId,
    completedStepProjects,
    setNeedsProjectHighlight,
    setSelectedProjectJobId,
    pinProject,
  } = useResearchProject();
  const completedStepProjectsRef = useRef(completedStepProjects);
  engineReadyRef.current = engineReady;
  completedStepProjectsRef.current = completedStepProjects;

  function applyPendingSowFindToEngine(jobId: string) {
    const pending = pendingSowFilesRef.current;
    const project = completedStepProjectsRef.current.find(
      (p) => p.job_id === jobId
    );
    setSowFoundFilesLoading(pending.loading);
    if (!pending.loading) {
      setSowFoundFiles(pending.files);
    }
    setSowProjectContext({
      jobId,
      projectName: pending.projectName ?? project?.project_name,
      clientName: pending.clientName,
    });
  }

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

  function shouldHoldCreatedProject(jobId: string): boolean {
    const held = skipProjectSwitchJobIdRef.current;
    if (!held) return false;
    if (held === jobId) return true;
    skipProjectSwitchJobIdRef.current = null;
    return false;
  }

  useEffect(() => {
    const onNeedsProject = () => setNeedsProjectHighlight(true);
    const onRequestCreateProject = () => setCreateModalOpen(true);
    window.addEventListener("sow-needs-project", onNeedsProject);
    window.addEventListener("sow-request-create-project", onRequestCreateProject);
    return () => {
      window.removeEventListener("sow-needs-project", onNeedsProject);
      window.removeEventListener(
        "sow-request-create-project",
        onRequestCreateProject
      );
    };
  }, [setNeedsProjectHighlight]);

  useEffect(() => {
    const jobId = selectedProjectJobId.trim();
    if (jobId === lastProjectJobIdRef.current) return;

    if (shouldHoldCreatedProject(jobId)) {
      lastProjectJobIdRef.current = jobId;
      return;
    }

    lastProjectJobIdRef.current = jobId;
    pendingSowFilesRef.current = { loading: Boolean(jobId), files: [] };

    if (engineReadyRef.current) {
      setSowFoundFilesLoading(Boolean(jobId));
      setSowFoundFiles([]);
      setSowProjectContext({
        jobId,
        projectName: completedStepProjectsRef.current.find((p) => p.job_id === jobId)
          ?.project_name,
      });
    }
  }, [selectedProjectJobId]);

  useEffect(() => {
    if (!engineReady) return;

    const jobId = selectedProjectJobId.trim();
    if (shouldHoldCreatedProject(jobId)) return;
    applyPendingSowFindToEngine(jobId);
  }, [engineReady, selectedProjectJobId, completedStepProjects]);

  useEffect(() => {
    return registerSowWorkbookTemplateValidate(async (file) => {
      await assertSowWorkbookTemplateContent(file);
    });
  }, []);

  useEffect(() => {
    if (!engineReady) return;
    return registerSowSplitSubmit((jobId, request, signal) =>
      submitSowSplit(jobId, request, signal)
    );
  }, [engineReady]);

  useEffect(() => {
    if (!engineReady) return;
    return registerSowWorkbookSubmit((jobId, request, signal) =>
      submitSowWorkbook(jobId, request, signal)
    );
  }, [engineReady]);

  useEffect(() => {
    if (!engineReady) return;
    return registerSowDownloadExport((jobId, request, signal) =>
      downloadSowExport(jobId, request, signal)
    );
  }, [engineReady]);

  useEffect(() => {
    if (!engineReady) return;
    return registerSowAllocationsPatch((jobId, request, signal) =>
      patchSowAllocations(jobId, request, signal)
    );
  }, [engineReady]);

  useEffect(() => {
    if (!engineReady) return;
    return registerSowSplitLoad((jobId, signal) =>
      fetchSavedSowSplit(jobId, signal)
    );
  }, [engineReady]);

  useEffect(() => {
    const jobId = selectedProjectJobId.trim();
    if (shouldHoldCreatedProject(jobId)) return;

    if (!jobId) {
      pendingSowFilesRef.current = { loading: false, files: [] };
      if (engineReadyRef.current) {
        applyPendingSowFindToEngine("");
      }
      return;
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
        const projectName = response.project_name?.trim() || undefined;
        const clientName = response.client?.trim() || undefined;
        pendingSowFilesRef.current = {
          loading: false,
          files,
          projectName,
          clientName,
        };
        if (engineReadyRef.current) {
          applyPendingSowFindToEngine(jobId);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[schedule-of-works] GET /sow/find failed", err);
        pendingSowFilesRef.current = { loading: false, files: [] };
        if (engineReadyRef.current) {
          setSowFoundFilesLoading(false);
          setSowFoundFiles([]);
        }
      }
    })();

    return () => controller.abort();
  }, [selectedProjectJobId]);

  async function handleCreateProject(values: ProjectFormValues) {
    if (creatingLockRef.current) return;
    creatingLockRef.current = true;
    setCreatingProject(true);
    try {
      const opportunity = values.opportunity.trim();
      const created = await createProject({
        opportunity,
        due_date: values.dueDate.trim() ? values.dueDate.trim() : "N/A",
        status: values.status,
      });
      const jobId = jobIdFromCreateResponse(created);
      if (!jobId) {
        throw new Error("Project was created but no job id was returned.");
      }

      pinProject({ job_id: jobId, project_name: opportunity });
      skipProjectSwitchJobIdRef.current = jobId;
      setSowProjectContext(
        { jobId, projectName: opportunity },
        { preserveWork: true }
      );
      setSelectedProjectJobId(jobId);
      requestProjectCatalogRefresh();
      runSowSplit();
      setCreateModalOpen(false);
    } finally {
      creatingLockRef.current = false;
      setCreatingProject(false);
    }
  }

  useEffect(() => {
    if (!engineReady) return;

    const jobId = selectedProjectJobId.trim();
    if (shouldHoldCreatedProject(jobId)) return;

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
      {creatingProject ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 p-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Creating project and starting trade split…
          </div>
        </div>
      ) : null}
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
      <SowCreateProjectModal
        open={createModalOpen}
        submitting={creatingProject}
        onClose={() => {
          if (!creatingProject) setCreateModalOpen(false);
        }}
        onSubmit={handleCreateProject}
      />
    </div>
  );
}

function jobIdFromCreateResponse(data: CreateProjectResponse): string {
  const record = data as CreateProjectResponse & { job_id?: unknown };
  const fromJob = record.job_id;
  const fromProject = record.project?.id;
  const raw =
    typeof fromJob === "string"
      ? fromJob
      : typeof fromJob === "number"
        ? String(fromJob)
        : typeof fromProject === "string"
          ? fromProject
          : "";
  return raw.trim();
}
