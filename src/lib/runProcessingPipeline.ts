import {
  PROCESSING_STEPS,
  getPayloadForStep,
  STEP_INPUT_MAPPING,
  type ProcessingStepDef,
  type StepOutputs,
} from "@/lib/processingPipelineConfig";
import { postPipelineStep, type PipelineApiLog } from "@/components/extract/pipeline/pipelineApi";

const STEP_DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatDetailForPayload(
  step: ProcessingStepDef,
  outputs: StepOutputs
): string | null {
  const key = STEP_INPUT_MAPPING[step.input];
  if (!key) return null;
  if (!outputs[key]) {
    return `Missing path for “${key}” (required by ${step.input}). Run earlier steps or verify extract-zip output.`;
  }
  return null;
}

export type StartPipelineInput = {
  jobId: string;
  /** Initial paths after `/extract-zip`, e.g. `{ extracted_dir }` */
  initialOutputs: StepOutputs;
};

export type StartPipelineHandlers = {
  onStepProcessing: (stepId: number) => void;
  onStepCompleted: (stepId: number) => void;
  onApiLog: (log: PipelineApiLog) => void;
  onPipelineComplete: () => void;
  /** `stepId` when a specific step failed; `null` for unexpected errors */
  onPipelineError: (message: string, stepId: number | null) => void;
};

/**
 * Runs processing steps 2–12 sequentially. Mutates a local copy of outputs from API responses.
 */
export async function startPipeline(
  { jobId, initialOutputs }: StartPipelineInput,
  handlers: StartPipelineHandlers
): Promise<{ ok: boolean }> {
  const outputs: StepOutputs = { ...initialOutputs };

  try {
    for (const step of PROCESSING_STEPS) {
      const missing = formatDetailForPayload(step, outputs);
      if (missing) {
        handlers.onPipelineError(missing, step.id);
        return { ok: false };
      }

      handlers.onStepProcessing(step.id);

      const payload = getPayloadForStep(step, jobId, outputs);
      const result = await postPipelineStep(step, payload);

      handlers.onApiLog(result.log);

      if (!result.ok) {
        handlers.onPipelineError(result.errorMessage, step.id);
        return { ok: false };
      }

      const outVal = result.data[step.output_key];
      if (typeof outVal === "string" && outVal.length > 0) {
        outputs[step.output_key] = outVal;
      }

      handlers.onStepCompleted(step.id);
      await sleep(STEP_DELAY_MS);
    }

    handlers.onPipelineComplete();
    return { ok: true };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "An unexpected error occurred.";
    handlers.onPipelineError(msg, null);
    return { ok: false };
  }
}
