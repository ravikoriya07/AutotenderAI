const JOB_KEY = "autotender_extract_job_id";
const SNAPSHOT_KEY = "autotender_extract_snapshot";

export type ExtractSnapshot = {
  extracted_dir?: string;
};

export function persistExtractSnapshot(
  jobId: string,
  snapshot: ExtractSnapshot
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(JOB_KEY, jobId);
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}
