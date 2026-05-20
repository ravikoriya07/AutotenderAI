"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "react-toastify";
import {
  fetchClientUploadProgress,
  uploadClientProjectZip,
} from "@/lib/bid-writing/bidWritingApi";
import {
  clientZipBarPercent,
  clientZipProgressCaption,
  isClientZipFile,
  isTerminalUploadPhase,
} from "@/lib/bid-writing/clientZipUploadUtils";
import type { ClientZipUploadProgress } from "@/lib/bid-writing/types";

export type PendingClientProject = {
  id: string | null;
  name: string;
};

type ClientZipUploadContextValue = {
  isIngesting: boolean;
  progress: ClientZipUploadProgress | null;
  error: string | null;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  dragActive: boolean;
  setDragActive: (active: boolean) => void;
  submitUpload: () => Promise<void>;
  clearSelectedFile: () => void;
  barPercent: number;
  statusLine: string;
  uploadLocked: boolean;
  pendingProject: PendingClientProject | null;
  /** Bumps after a successful upload so consumers can refresh project lists. */
  uploadFinishedGeneration: number;
  /** Set when the latest upload finishes successfully (for auto-selection). */
  lastCompletedProject: { id: string; name: string } | null;
  /** True when listing row matches the in-flight upload and must not be selected. */
  isPendingProjectRow: (projectId: string | null, projectName: string) => boolean;
};

const ClientZipUploadContext = createContext<ClientZipUploadContextValue | null>(null);

const POLL_INTERVAL_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

type ActiveUpload = {
  jobId: string;
  file: File;
  projectId: string;
  projectName: string;
};

export function ClientZipUploadProvider({ children }: { children: ReactNode }) {
  const [isIngesting, setIsIngesting] = useState(false);
  const [progress, setProgress] = useState<ClientZipUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pendingProject, setPendingProject] = useState<PendingClientProject | null>(null);
  const [uploadFinishedGeneration, setUploadFinishedGeneration] = useState(0);
  const [lastCompletedProject, setLastCompletedProject] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const uploadAbortRef = useRef<AbortController | null>(null);
  const activeUploadRef = useRef<ActiveUpload | null>(null);
  const pollRunIdRef = useRef(0);

  const setSelectedFileSafe = useCallback((file: File | null) => {
    setSelectedFile(file);
    if (file) setError(null);
  }, []);

  const clearSelectedFile = useCallback(() => {
    if (isIngesting) return;
    setSelectedFile(null);
    setError(null);
  }, [isIngesting]);

  const runPollLoop = useCallback(async (upload: ActiveUpload, runId: number) => {
    let pollDelayMs = 0;

    for (;;) {
      if (pollRunIdRef.current !== runId) return;
      if (pollDelayMs > 0) await sleep(pollDelayMs);
      if (pollRunIdRef.current !== runId) return;

      let prog: ClientZipUploadProgress;
      try {
        prog = await fetchClientUploadProgress(upload.jobId);
      } catch (err) {
        if (pollRunIdRef.current !== runId) return;
        const msg = err instanceof Error ? err.message : "Failed to check upload progress";
        setError(msg);
        setIsIngesting(false);
        setPendingProject(null);
        activeUploadRef.current = null;
        toast.error(msg);
        return;
      }

      if (pollRunIdRef.current !== runId) return;

      setProgress(prog);

      const projectId =
        (typeof prog.project_id === "string" && prog.project_id) || upload.projectId || null;
      const projectName =
        (typeof prog.project_name === "string" && prog.project_name) ||
        upload.projectName ||
        upload.file.name.replace(/\.zip$/i, "");

      setPendingProject({ id: projectId, name: projectName });

      const phase = String(prog.phase ?? "").toLowerCase();

      if (phase === "error") {
        const errMsg =
          (typeof prog.error === "string" && prog.error) ||
          (typeof prog.ingest_error === "string" && prog.ingest_error) ||
          "Upload processing failed";
        setError(errMsg);
        setIsIngesting(false);
        setPendingProject(null);
        activeUploadRef.current = null;
        toast.error(errMsg);
        return;
      }

      if (isTerminalUploadPhase(phase) && phase === "done") {
        const completedId =
          (typeof prog.project_id === "string" && prog.project_id.trim()) ||
          upload.projectId.trim() ||
          "";
        setIsIngesting(false);
        setPendingProject(null);
        activeUploadRef.current = null;
        setSelectedFile(null);
        setProgress(null);
        if (completedId) {
          setLastCompletedProject({ id: completedId, name: projectName });
        } else {
          setLastCompletedProject(null);
        }
        setUploadFinishedGeneration((g) => g + 1);
        toast.success(`Uploaded: ${projectName}`);
        return;
      }

      pollDelayMs = POLL_INTERVAL_MS;
    }
  }, []);

  const submitUpload = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Please select a ZIP file before submitting.");
      return;
    }
    if (isIngesting) return;
    if (!isClientZipFile(selectedFile)) {
      toast.error("Please choose a ZIP file.");
      return;
    }

    const file = selectedFile;
    uploadAbortRef.current?.abort();
    const ac = new AbortController();
    uploadAbortRef.current = ac;

    pollRunIdRef.current += 1;
    const runId = pollRunIdRef.current;

    setError(null);
    setProgress(null);
    setIsIngesting(true);

    const initialName = file.name.replace(/\.zip$/i, "") || "New project";
    setPendingProject({ id: null, name: initialName });
    setLastCompletedProject(null);

    try {
      const uploadRes = await uploadClientProjectZip(file, { signal: ac.signal });
      if (pollRunIdRef.current !== runId) return;

      const projectId =
        (typeof uploadRes.project_id === "string" && uploadRes.project_id) || "";
      const projectName =
        (typeof uploadRes.project_name === "string" && uploadRes.project_name) || initialName;

      setPendingProject({
        id: projectId || null,
        name: projectName,
      });

      const active: ActiveUpload = {
        jobId: uploadRes.job_id,
        file,
        projectId,
        projectName,
      };
      activeUploadRef.current = active;

      void runPollLoop(active, runId);
    } catch (err) {
      if (pollRunIdRef.current !== runId) return;
      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        setIsIngesting(false);
        setPendingProject(null);
        return;
      }
      const msg = err instanceof Error ? err.message : "Upload failed";
      console.error("[ClientZipUpload] Upload failed:", err);
      setError(msg);
      setIsIngesting(false);
      setPendingProject(null);
      activeUploadRef.current = null;
      toast.error(msg);
    } finally {
      if (uploadAbortRef.current === ac) {
        uploadAbortRef.current = null;
      }
    }
  }, [isIngesting, runPollLoop, selectedFile]);

  const isPendingProjectRow = useCallback(
    (projectId: string | null, projectName: string) => {
      if (!isIngesting || !pendingProject) return false;
      const pid = pendingProject.id?.trim();
      const pname = pendingProject.name.trim().toLowerCase();
      if (pid && projectId && pid === projectId) return true;
      if (pname && projectName.trim().toLowerCase() === pname) return true;
      return false;
    },
    [isIngesting, pendingProject]
  );

  const barPercent = useMemo(() => clientZipBarPercent(progress), [progress]);

  const statusLine = useMemo(() => {
    if (!isIngesting) return "";
    if (!progress) return "Uploading archive…";
    return clientZipProgressCaption(progress);
  }, [isIngesting, progress]);

  const uploadLocked = isIngesting;

  const value = useMemo<ClientZipUploadContextValue>(
    () => ({
      isIngesting,
      progress,
      error,
      selectedFile,
      setSelectedFile: setSelectedFileSafe,
      dragActive,
      setDragActive,
      submitUpload,
      clearSelectedFile,
      barPercent,
      statusLine,
      uploadLocked,
      pendingProject,
      uploadFinishedGeneration,
      lastCompletedProject,
      isPendingProjectRow,
    }),
    [
      barPercent,
      clearSelectedFile,
      dragActive,
      error,
      isIngesting,
      isPendingProjectRow,
      lastCompletedProject,
      pendingProject,
      progress,
      selectedFile,
      setSelectedFileSafe,
      statusLine,
      submitUpload,
      uploadFinishedGeneration,
      uploadLocked,
    ]
  );

  useEffect(() => {
    return () => {
      pollRunIdRef.current += 1;
    };
  }, []);

  return (
    <ClientZipUploadContext.Provider value={value}>{children}</ClientZipUploadContext.Provider>
  );
}

export function useClientZipUpload(): ClientZipUploadContextValue {
  const ctx = useContext(ClientZipUploadContext);
  if (!ctx) {
    throw new Error("useClientZipUpload must be used within ClientZipUploadProvider");
  }
  return ctx;
}
