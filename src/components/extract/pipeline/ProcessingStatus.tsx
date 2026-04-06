import { Check, Loader2 } from "lucide-react";
import type { StepRuntime } from "@/lib/processingPipelineConfig";
import { StepList } from "./StepList";

type ProcessingStatusProps = {
  steps: StepRuntime[];
  errorMessage: string | null;
  pipelineComplete: boolean;
  isProcessing: boolean;
};

export function ProcessingStatus({
  steps,
  errorMessage,
  pipelineComplete,
  isProcessing,
}: ProcessingStatusProps) {
  return (
    <div className="space-y-4 min-w-0">
      {errorMessage ? (
        <div
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive shadow-sm sm:px-4"
          role="alert"
        >
          <p className="font-semibold">Pipeline stopped</p>
          <p className="mt-1.5 break-words text-destructive/90">{errorMessage}</p>
        </div>
      ) : null}

      {pipelineComplete ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-green-600/35 bg-green-600/10 px-3 py-3 text-sm text-green-800 shadow-sm dark:text-green-400 sm:items-center sm:px-4"
          role="status"
        >
          <Check className="mt-0.5 h-5 w-5 shrink-0 sm:mt-0" aria-hidden />
          <p className="min-w-0 font-semibold leading-snug">
            All processing steps completed successfully.
          </p>
        </div>
      ) : null}

      {isProcessing ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          Running pipeline…
        </div>
      ) : null}

      <StepList steps={steps} />
    </div>
  );
}
