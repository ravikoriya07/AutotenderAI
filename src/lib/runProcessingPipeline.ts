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
  if (step.input === "main_output_dir") {
    const has =
      (outputs.main_output_dir && outputs.main_output_dir.length > 0) ||
      (outputs.all_class_classifier_dir &&
        outputs.all_class_classifier_dir.length > 0);
    if (!has) {
      return `Missing path for main_output_dir (need all_class_classifier_dir from step 12 or main_output_dir in outputs).`;
    }
    return null;
  }
  const key = STEP_INPUT_MAPPING[step.input];
  if (!key) return null;
  if (!outputs[key]) {
    return `Missing path for “${key}” (required by ${step.input}). Run earlier steps or verify extract-zip output.`;
  }
  return null;
}

export type StartPipelineInput = {
  jobId: string;
  /** Initial paths after `/extract-zip` or normalized resume `outputs` */
  initialOutputs: StepOutputs;
  /** Index into `PROCESSING_STEPS` (0 = first pipeline step). Default 0. */
  startIndex?: number;
};

export type StartPipelineHandlers = {
  onStepProcessing: (stepId: number) => void;
  onStepCompleted: (stepId: number) => void;
  onApiLog?: (log: PipelineApiLog) => void;
  onPipelineComplete: () => void;
  /** `stepId` when a specific step failed; `null` for unexpected errors */
  onPipelineError: (message: string, stepId: number | null) => void;
};

/**
 * Runs processing steps 2–13 sequentially. Mutates a local copy of outputs from API responses.
 */
export async function startPipeline(
  { jobId, initialOutputs, startIndex = 0 }: StartPipelineInput,
  handlers: StartPipelineHandlers
): Promise<{ ok: boolean }> {
  const outputs: StepOutputs = { ...initialOutputs };

  try {
    const safeStart = Math.max(
      0,
      Math.min(startIndex, PROCESSING_STEPS.length)
    );

    for (let i = 0; i < safeStart; i++) {
      handlers.onStepCompleted(PROCESSING_STEPS[i].id);
    }

    const stepsToRun = PROCESSING_STEPS.slice(safeStart);
    if (stepsToRun.length === 0) {
      handlers.onPipelineComplete();
      return { ok: true };
    }

    for (const step of stepsToRun) {
      const missing = formatDetailForPayload(step, outputs);
      if (missing) {
        handlers.onPipelineError(missing, step.id);
        return { ok: false };
      }

      handlers.onStepProcessing(step.id);

      const payload = getPayloadForStep(step, jobId, outputs);
      const result = await postPipelineStep(step, payload);

      handlers.onApiLog?.(result.log);

      if (!result.ok) {
        handlers.onPipelineError(result.errorMessage, step.id);
        return { ok: false };
      }

      const responseData =
        typeof result.data === "object" &&
        result.data !== null &&
        !Array.isArray(result.data)
          ? result.data
          : {};
      const outVal = responseData[step.output_key];
      if (typeof outVal === "string" && outVal.length > 0) {
        outputs[step.output_key] = outVal;
      } else if (
        step.id === 13 &&
        outputs.all_class_classifier_dir &&
        !outputs.main_output_dir
      ) {
        outputs.main_output_dir = outputs.all_class_classifier_dir;
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
