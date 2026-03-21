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
    <div className="space-y-4">
      {errorMessage ? (
        <div
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <p className="font-medium">Pipeline stopped</p>
          <p className="mt-1 text-destructive/90">{errorMessage}</p>
        </div>
      ) : null}

      {pipelineComplete ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-800 dark:text-green-400"
          role="status"
        >
          <Check className="h-5 w-5 shrink-0" aria-hidden />
          <p className="font-medium">
            All processing steps completed successfully.
          </p>
        </div>
      ) : null}

      {isProcessing ? (
        <div
          className="flex items-center gap-2 text-xs font-medium text-primary"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          Running pipeline…
        </div>
      ) : null}

      <StepList steps={steps} />
    </div>
  );
}
