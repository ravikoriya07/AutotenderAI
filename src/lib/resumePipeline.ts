import type { ResumeInfoResponse } from "@/types/project";
import {
  EXTRACT_ZIP_STEP,
  PROCESSING_STEPS,
  type StepOutputs,
  type StepRuntime,
} from "@/lib/processingPipelineConfig";

/** Backend `next_step_to_trigger` / step names → index in PROCESSING_STEPS (0 = step id 2). */
export const BACKEND_PIPELINE_STEP_TRIGGER: Record<string, number> = {
  process_word_documents: 0,
  classify_pdfs: 1,
  convert_excel_to_csv: 2,
  extract_text: 3,
  extract_competitors: 4,
  extract_suppliers: 5,
  generate_direct_text_json: 6,
  generate_direct_csv_json: 7,
  generate_direct_drawing_json: 8,
  run_index_classifier: 9,
  run_all_class_classifier: 10,
};

export function getPipelineStartIndexFromTrigger(
  trigger: string | null | undefined
): number | null {
  if (trigger == null || trigger === "") return null;
  const idx = BACKEND_PIPELINE_STEP_TRIGGER[trigger];
  return typeof idx === "number" ? idx : null;
}

export function isPipelineFullyCompleteFromResume(info: ResumeInfoResponse): boolean {
  return (
    info.last_recorded_step === "run_all_class_classifier" &&
    (info.next_step_to_trigger == null || info.next_step_to_trigger === "")
  );
}

export function isResumeCaseA(info: ResumeInfoResponse): boolean {
  return (
    info.last_recorded_step === "initialized" &&
    (info.next_step_to_trigger == null || info.next_step_to_trigger === "")
  );
}

/** Paths the pipeline may read from resume `outputs` (strings only). */
const RESUME_OUTPUT_KEYS = [
  "extracted_dir",
  "text_pdfs_dir",
  "extracted_texts_dir",
  "csvs_dir",
  "json_dir",
  "competitor_output_dir",
  "supplier_output_dir",
  "csvs_json_dir",
  "summaries_json_dir",
  "index_classifier_dir",
  "all_class_classifier_dir",
  "main_output_dir",
  "zip_path",
  "zip_output_dir",
  "drawing_pdfs_dir",
] as const;

export function normalizeResumeOutputsToStepOutputs(
  apiOutputs: Record<string, unknown> | null | undefined
): StepOutputs {
  const out: StepOutputs = {};
  if (!apiOutputs || typeof apiOutputs !== "object") return out;
  for (const key of RESUME_OUTPUT_KEYS) {
    const v = apiOutputs[key];
    if (typeof v === "string" && v.length > 0) {
      out[key] = v;
    }
  }
  return out;
}

function buildStep1FromResume(info: ResumeInfoResponse | null): StepRuntime {
  if (!info) {
    return { ...EXTRACT_ZIP_STEP, status: "pending" };
  }
  if (isPipelineFullyCompleteFromResume(info)) {
    return { ...EXTRACT_ZIP_STEP, status: "completed", message: "Completed" };
  }
  if (isResumeCaseA(info)) {
    return { ...EXTRACT_ZIP_STEP, status: "pending" };
  }
  const out = info.outputs;
  const extracted =
    out &&
    typeof out.extracted_dir === "string" &&
    out.extracted_dir.length > 0;
  const zip =
    out && typeof out.zip_path === "string" && out.zip_path.length > 0;
  if (extracted || zip) {
    return { ...EXTRACT_ZIP_STEP, status: "completed", message: "Completed" };
  }
  return { ...EXTRACT_ZIP_STEP, status: "pending" };
}

function tailStepsAllPending(): StepRuntime[] {
  return PROCESSING_STEPS.map((s) => ({ ...s, status: "pending" as const }));
}

export function buildStepsFromResumeInfo(
  info: ResumeInfoResponse | null
): StepRuntime[] {
  const step1 = buildStep1FromResume(info);
  if (!info) {
    return [step1, ...tailStepsAllPending()];
  }
  if (isPipelineFullyCompleteFromResume(info)) {
    return [
      step1,
      ...PROCESSING_STEPS.map((s) => ({
        ...s,
        status: "completed" as const,
        message: "Completed",
      })),
    ];
  }
  const startIdx = getPipelineStartIndexFromTrigger(info.next_step_to_trigger);
  if (startIdx == null) {
    return [step1, ...tailStepsAllPending()];
  }
  return [
    step1,
    ...PROCESSING_STEPS.map((s, i) => {
      if (i < startIdx) {
        return { ...s, status: "completed" as const, message: "Completed" };
      }
      return { ...s, status: "pending" as const };
    }),
  ];
}
