export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://91.199.227.82:31655";

export type StepStatus = "pending" | "processing" | "completed" | "error";

export type ProcessingStepDef = {
  id: number;
  name: string;
  endpoint: string;
  input: string;
  output_key: string;
};

export type StepRuntime = ProcessingStepDef & {
  status: StepStatus;
  message?: string;
};

/**
 * Step 1 is `/extract-zip` (shown in UI only). Steps 2–12 are run by `startPipeline`.
 */
export const EXTRACT_ZIP_STEP: ProcessingStepDef = {
  id: 1,
  name: "Extract zip",
  endpoint: "/extract-zip",
  input: "input_folder",
  output_key: "extracted_dir",
};

/** Steps 2–12 after `/extract-zip` (step 1) */
export const PROCESSING_STEPS: ProcessingStepDef[] = [
  {
    id: 2,
    name: "Process Word Docs",
    endpoint: "/process-word-documents",
    input: "input_folder",
    output_key: "extracted_texts_dir",
  },
  {
    id: 3,
    name: "Classify PDFs",
    endpoint: "/classify-pdfs",
    input: "input_pdfs_dir",
    output_key: "text_pdfs_dir",
  },
  {
    id: 4,
    name: "Convert Excel to CSV",
    endpoint: "/convert-excel-to-csv",
    input: "extracted_root_folder",
    output_key: "csvs_dir",
  },
  {
    id: 5,
    name: "Extract Text",
    endpoint: "/extract-text",
    input: "text_pdfs_dir",
    output_key: "extracted_texts_dir",
  },
  {
    id: 6,
    name: "Extract Competitors",
    endpoint: "/extract-competitors",
    input: "extracted_texts_dir",
    output_key: "competitor_output_dir",
  },
  {
    id: 7,
    name: "Extract Suppliers",
    endpoint: "/extract-suppliers",
    input: "extracted_texts_dir",
    output_key: "supplier_output_dir",
  },
  {
    id: 8,
    name: "Generate Text JSON",
    endpoint: "/generate-direct-text-json",
    input: "extracted_texts_dir",
    output_key: "json_dir",
  },
  {
    id: 9,
    name: "Generate CSV JSON",
    endpoint: "/generate-direct-csv-json",
    input: "csvs_dir",
    output_key: "csvs_json_dir",
  },
  {
    id: 10,
    name: "Process Drawings & JSON",
    endpoint: "/generate-direct-drawing-json",
    input: "drawing_pdfs_dir",
    output_key: "summaries_json_dir",
  },
  {
    id: 11,
    name: "Run Index Classifier",
    endpoint: "/run-index-classifier",
    input: "text_dir",
    output_key: "index_classifier_dir",
  },
  {
    id: 12,
    name: "Run All-Class Classifier",
    endpoint: "/run-all-class-classifier",
    input: "text_dir",
    output_key: "all_class_classifier_dir",
  },
];

export const STEP_INPUT_MAPPING: Record<string, string> = {
  input_folder: "extracted_dir",
  input_pdfs_dir: "extracted_dir",
  text_pdfs_dir: "text_pdfs_dir",
  extracted_texts_dir: "extracted_texts_dir",
  extracted_root_folder: "extracted_dir",
  csvs_dir: "csvs_dir",
  drawing_pdfs_dir: "extracted_dir",
  text_dir: "extracted_texts_dir",
};

export type StepOutputs = Record<string, string>;

export function getPayloadForStep(
  step: ProcessingStepDef,
  jobId: string,
  outputs: StepOutputs
): Record<string, string> {
  const payload: Record<string, string> = { job_id: jobId };

  if (step.input) {
    const outputKey = STEP_INPUT_MAPPING[step.input];
    if (outputKey) {
      const pathValue = outputs[outputKey];
      if (pathValue) {
        payload[step.input] = pathValue;
      }
    }
  }

  return payload;
}

export function initialStepRuntimes(): StepRuntime[] {
  return [
    { ...EXTRACT_ZIP_STEP, status: "pending" as StepStatus },
    ...PROCESSING_STEPS.map((s) => ({ ...s, status: "pending" as StepStatus })),
  ];
}
