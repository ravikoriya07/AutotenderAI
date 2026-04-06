"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { initialStepRuntimes } from "@/lib/processingPipelineConfig";
import { startPipeline } from "@/lib/runProcessingPipeline";
import { getResumeInfo } from "@/services/projectService";
import {
  buildStepsFromResumeInfo,
  getPipelineStartIndexFromTrigger,
  isPipelineFullyCompleteFromResume,
  isResumeCaseA,
  normalizeResumeOutputsToStepOutputs,
} from "@/lib/resumePipeline";
import { ProcessingStatus } from "./ProcessingStatus";

type ProcessingPipelineProps = {
  jobId: string;
  extractedDir: string | null;
  /** Increment after each successful extract to auto-run the pipeline from step 2 */
  autoRunToken: number;
  onProcessingChange?: (processing: boolean) => void;
  /** True when job is fully complete (server or local) — parent should disable extract/upload */
  onExtractLockChange?: (locked: boolean) => void;
};

export function ProcessingPipeline({
  jobId,
  extractedDir,
  autoRunToken,
  onProcessingChange,
  onExtractLockChange,
}: ProcessingPipelineProps) {
  const [steps, setSteps] = useState(() => initialStepRuntimes());
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Local run finished all steps successfully */
  const [pipelineComplete, setPipelineComplete] = useState(false);
  /** GET /resume-info reports final step done — no further processing */
  const [terminalFromServer, setTerminalFromServer] = useState(false);
  const [resumeInfoLoading, setResumeInfoLoading] = useState(false);
  const [resumeActionPending, setResumeActionPending] = useState(false);
  const [resumeHint, setResumeHint] = useState<string | null>(null);
  /** Case A: initialized + no next step — hide Resume (nothing to resume yet) */
  const [resumeCaseA, setResumeCaseA] = useState(false);
  /** True only when server provides a mappable next step + output paths (same as handleResume needs). */
  const [resumePathReady, setResumePathReady] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const extractedDirRef = useRef<string | null>(null);
  const runIdRef = useRef(0);
  const lastAutoStartedTokenRef = useRef<number | null>(null);
  const onProcessingChangeRef = useRef(onProcessingChange);
  const onExtractLockChangeRef = useRef(onExtractLockChange);
  onProcessingChangeRef.current = onProcessingChange;
  onExtractLockChangeRef.current = onExtractLockChange;

  const extractLocked = terminalFromServer || pipelineComplete;

  extractedDirRef.current = extractedDir;

  useEffect(() => {
    onExtractLockChangeRef.current?.(extractLocked);
  }, [extractLocked]);

  /**
   * Step 1 (Extract zip): keep in sync with local `extractedDir`, pipeline progress,
   * and resume data. Depends on `steps` so when step 2+ update, we mark step 1
   * complete (extract success implies step 1 done; resume fetch may omit step 1).
   */
  useEffect(() => {
    setSteps((prev) => {
      const step1 = prev.find((s) => s.id === 1);
      if (!step1) return prev;

      let nextStatus = step1.status;
      let nextMessage = step1.message;

      if (extractedDir) {
        nextStatus = "completed";
        nextMessage = "Completed";
      } else {
        const pipelineStarted = prev.some(
          (x) => x.id >= 2 && x.id <= 13 && x.status !== "pending"
        );
        if (pipelineStarted) {
          nextStatus = "completed";
          nextMessage = "Completed";
        }
      }

      if (nextStatus === step1.status && nextMessage === step1.message) return prev;
      return prev.map((s) =>
        s.id === 1
          ? { ...s, status: nextStatus, message: nextMessage }
          : s
      );
    });
  }, [extractedDir, steps]);

  const applyResumeInfoToState = useCallback((info: Awaited<ReturnType<typeof getResumeInfo>>) => {
    const done = isPipelineFullyCompleteFromResume(info);
    const caseA = isResumeCaseA(info);
    setTerminalFromServer(done);
    setPipelineComplete(done);
    let nextSteps = buildStepsFromResumeInfo(info);
    if (extractedDirRef.current) {
      nextSteps = nextSteps.map((s) =>
        s.id === 1
          ? { ...s, status: "completed" as const, message: "Completed" }
          : s
      );
    }
    setSteps(nextSteps);
    setResumeCaseA(caseA);
    const startIdx = getPipelineStartIndexFromTrigger(info.next_step_to_trigger);
    const outputs = normalizeResumeOutputsToStepOutputs(info.outputs ?? undefined);
    const canResume =
      !done &&
      !caseA &&
      startIdx !== null &&
      Object.keys(outputs).length > 0;
    setResumePathReady(canResume);
    setResumeHint(
      caseA
        ? "No processing started yet."
        : !done && !canResume
          ? "Resume is unavailable until the server reports a next step and output paths."
          : null
    );
  }, []);

  useEffect(() => {
    if (!jobId) {
      runIdRef.current += 1;
      setSteps(initialStepRuntimes());
      setErrorMessage(null);
      setPipelineComplete(false);
      setTerminalFromServer(false);
      setResumeHint(null);
      setResumeCaseA(false);
      setResumePathReady(false);
      setIsProcessing(false);
      onProcessingChangeRef.current?.(false);
      onExtractLockChangeRef.current?.(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setResumeInfoLoading(true);
    void getResumeInfo(jobId, controller.signal)
      .then((info) => {
        if (cancelled) return;
        applyResumeInfoToState(info);
      })
      .catch((e) => {
        if (cancelled || axios.isCancel(e)) return;
        setSteps(initialStepRuntimes());
        setTerminalFromServer(false);
        setPipelineComplete(false);
        setResumeHint(null);
        setResumeCaseA(false);
        setResumePathReady(false);
      })
      .finally(() => {
        if (!cancelled) setResumeInfoLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [jobId, applyResumeInfoToState]);

  const runPipelineWithOutputs = useCallback(
    async (
      startIdx: number,
      outputs: Record<string, string>,
      resetStepsBeforeRun: boolean
    ) => {
      if (!jobId) return;

      const runId = ++runIdRef.current;
      if (resetStepsBeforeRun) {
        setSteps(initialStepRuntimes());
      }
      setErrorMessage(null);
      setResumeHint(null);
      setResumeCaseA(false);
      setTerminalFromServer(false);
      setPipelineComplete(false);
      setIsProcessing(true);
      onProcessingChangeRef.current?.(true);

      requestAnimationFrame(() => {
        rootRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });

      try {
        await startPipeline(
          {
            jobId,
            initialOutputs: outputs,
            startIndex: startIdx,
          },
          {
            onStepProcessing: (stepId) => {
              if (runId !== runIdRef.current) return;
              setSteps((prev) =>
                prev.map((s) =>
                  s.id === stepId
                    ? { ...s, status: "processing", message: undefined }
                    : s
                )
              );
            },
            onStepCompleted: (stepId) => {
              if (runId !== runIdRef.current) return;
              setSteps((prev) =>
                prev.map((s) =>
                  s.id === stepId
                    ? { ...s, status: "completed", message: "Completed" }
                    : s
                )
              );
            },
            onPipelineComplete: () => {
              if (runId !== runIdRef.current) return;
              setPipelineComplete(true);
            },
            onPipelineError: (message, stepId) => {
              if (runId !== runIdRef.current) return;
              setErrorMessage(message);
              setSteps((prev) => {
                if (stepId != null) {
                  return prev.map((s) =>
                    s.id === stepId
                      ? { ...s, status: "error", message }
                      : s
                  );
                }
                const idx = prev.findIndex((s) => s.status === "processing");
                if (idx === -1) return prev;
                return prev.map((s, i) =>
                  i === idx ? { ...s, status: "error", message } : s
                );
              });
            },
          }
        );
      } finally {
        if (runId === runIdRef.current) {
          setIsProcessing(false);
          onProcessingChangeRef.current?.(false);
        }
      }
    },
    [jobId]
  );

  /** Full run from step 2 after successful ZIP extract (same session). */
  const executePipelineFromExtract = useCallback(async () => {
    if (!jobId || !extractedDir) return;
    await runPipelineWithOutputs(0, { extracted_dir: extractedDir }, true);
  }, [jobId, extractedDir, runPipelineWithOutputs]);

  useEffect(() => {
    if (autoRunToken === 0) {
      lastAutoStartedTokenRef.current = null;
      return;
    }
    if (!extractedDir || !jobId) return;
    if (lastAutoStartedTokenRef.current === autoRunToken) return;
    lastAutoStartedTokenRef.current = autoRunToken;
    void executePipelineFromExtract();
  }, [autoRunToken, extractedDir, jobId, executePipelineFromExtract]);

  const handleResume = useCallback(async () => {
    if (!jobId || extractLocked || isProcessing || resumeActionPending) return;
    setResumeActionPending(true);
    try {
      const info = await getResumeInfo(jobId);
      applyResumeInfoToState(info);

      if (isResumeCaseA(info)) {
        toast.info("No processing started yet.");
        return;
      }
      if (isPipelineFullyCompleteFromResume(info)) {
        toast.info("Processing is already complete for this job.");
        return;
      }

      const startIdx = getPipelineStartIndexFromTrigger(info.next_step_to_trigger);
      if (startIdx == null) {
        toast.error("Could not determine the next pipeline step from the server.");
        return;
      }

      const outputs = normalizeResumeOutputsToStepOutputs(info.outputs ?? undefined);
      if (Object.keys(outputs).length === 0) {
        toast.error("Resume response has no output paths. Cannot continue.");
        return;
      }

      await runPipelineWithOutputs(startIdx, outputs, false);
    } catch {
      toast.error("Failed to load resume information.");
    } finally {
      setResumeActionPending(false);
    }
  }, [
    jobId,
    extractLocked,
    isProcessing,
    resumeActionPending,
    applyResumeInfoToState,
    runPipelineWithOutputs,
  ]);

  const showAutoHint = autoRunToken > 0;
  const uploadBlockedHint =
    isProcessing && showAutoHint ? (
      <p className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground sm:px-4">
        Processing started automatically after upload. Upload controls are
        disabled until the pipeline finishes.
      </p>
    ) : null;

  const showCompleteBanner = terminalFromServer || pipelineComplete;
  const showResumeButton =
    Boolean(jobId) && !extractLocked && !resumeCaseA;
  /** No server/local extract yet — nothing to resume past step 1 */
  const isStep1ExtractPending = steps.some(
    (s) => s.id === 1 && s.status === "pending"
  );
  const resumeDisabled =
    !jobId ||
    extractLocked ||
    isProcessing ||
    resumeInfoLoading ||
    resumeActionPending ||
    isStep1ExtractPending ||
    !resumePathReady;

  const resumeInfoFetching = resumeInfoLoading || resumeActionPending;

  return (
    <div ref={rootRef} className="min-w-0 space-y-4">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Processing pipeline
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Step 1 is Extract zip (upload card). After a successful upload,
              steps 2–13 run automatically in this session. If you leave and
              return, use <span className="font-medium text-foreground/80">Resume</span>{" "}
              to continue from the server state.
            </p>
          </div>
          {showResumeButton ? (
            <div className="flex w-full shrink-0 sm:w-auto sm:pt-0.5">
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={resumeDisabled}
                className="h-10 w-full sm:h-9 sm:w-auto"
                onClick={() => void handleResume()}
              >
                {resumeInfoFetching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  "Resume processing"
                )}
              </Button>
            </div>
          ) : null}
        </div>
        {uploadBlockedHint}
        {resumeHint ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {resumeHint}
          </p>
        ) : null}
        {resumeInfoFetching && jobId ? (
          <div
            className="mt-3 flex items-center gap-2 text-xs font-medium text-primary"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            <span>Loading job status…</span>
          </div>
        ) : null}
      </div>

      {!jobId ? (
        <p className="text-sm text-muted-foreground">
          Open this page from a project with a job id to run the pipeline.
        </p>
      ) : !extractedDir && !terminalFromServer && !pipelineComplete ? (
        <p className="text-sm text-muted-foreground">
          Submit a ZIP on the left. After extraction succeeds, the pipeline runs
          once automatically in this session. Use Resume after refresh to
          continue from the server state.
        </p>
      ) : null}

      <ProcessingStatus
        steps={steps}
        errorMessage={errorMessage}
        pipelineComplete={showCompleteBanner}
        isProcessing={isProcessing}
      />

      {errorMessage && !isProcessing ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (extractedDir && jobId) {
              void runPipelineWithOutputs(0, { extracted_dir: extractedDir }, true);
            }
          }}
          disabled={!extractedDir || !jobId}
        >
          Retry pipeline
        </Button>
      ) : null}
    </div>
  );
}
