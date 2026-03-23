"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  type StepRuntime,
  initialStepRuntimes,
} from "@/lib/processingPipelineConfig";
import { startPipeline } from "@/lib/runProcessingPipeline";
import { ProcessingStatus } from "./ProcessingStatus";

type ProcessingPipelineProps = {
  /** Effective job id (from page or `/extract-zip` response) */
  jobId: string;
  extractedDir: string | null;
  /** Increment after each successful extract to auto-run the pipeline */
  autoRunToken: number;
  onProcessingChange?: (processing: boolean) => void;
};

export function ProcessingPipeline({
  jobId,
  extractedDir,
  autoRunToken,
  onProcessingChange,
}: ProcessingPipelineProps) {
  const [steps, setSteps] = useState<StepRuntime[]>(initialStepRuntimes);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pipelineComplete, setPipelineComplete] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const runIdRef = useRef(0);
  /** Prevents duplicate auto-starts for the same token (e.g. React Strict Mode). */
  const lastAutoStartedTokenRef = useRef<number | null>(null);
  const onProcessingChangeRef = useRef(onProcessingChange);
  onProcessingChangeRef.current = onProcessingChange;

  useEffect(() => {
    if (extractedDir && jobId) return;
    runIdRef.current += 1;
    setSteps(initialStepRuntimes());
    setErrorMessage(null);
    setPipelineComplete(false);
    setIsProcessing(false);
    onProcessingChangeRef.current?.(false);
  }, [extractedDir, jobId]);

  const executePipeline = useCallback(async () => {
    if (!jobId || !extractedDir) return;

    const runId = ++runIdRef.current;
    setSteps(initialStepRuntimes());
    setErrorMessage(null);
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
          initialOutputs: { extracted_dir: extractedDir },
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
  }, [jobId, extractedDir]);

  useEffect(() => {
    if (autoRunToken === 0) {
      lastAutoStartedTokenRef.current = null;
      return;
    }
    if (!extractedDir || !jobId) return;
    if (lastAutoStartedTokenRef.current === autoRunToken) return;
    lastAutoStartedTokenRef.current = autoRunToken;
    void executePipeline();
  }, [autoRunToken, extractedDir, jobId, executePipeline]);

  const showAutoHint = autoRunToken > 0;
  const uploadBlockedHint =
    isProcessing && showAutoHint ? (
      <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        Processing started automatically after upload. Upload controls are
        disabled until the pipeline finishes.
      </p>
    ) : null;

  return (
    <div ref={rootRef} className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Processing pipeline</h3>
        <p className="text-xs text-muted-foreground">
          Steps 2–12 run in order after ZIP extraction. Each step waits for the
          previous one to complete.
        </p>
        {uploadBlockedHint}
      </div>

      {!jobId || !extractedDir ? (
        <p className="text-sm text-muted-foreground">
          Submit a ZIP on the left. When extraction succeeds, the pipeline will
          start automatically.
        </p>
      ) : null}

      <ProcessingStatus
        steps={steps}
        errorMessage={errorMessage}
        pipelineComplete={pipelineComplete}
        isProcessing={isProcessing}
      />

      {errorMessage && !isProcessing ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void executePipeline()}
        >
          Retry pipeline
        </Button>
      ) : null}
    </div>
  );
}
