export const SELECTED_BID_JOB_STORAGE_KEY = "autotender_selected_bid_job_v1";

export type SelectedBidJob = {
  job_id: string;
  job_name: string;
};

function normalizeSelectedBidJob(value: Partial<SelectedBidJob> | null | undefined): SelectedBidJob | null {
  const jobId = typeof value?.job_id === "string" ? value.job_id.trim() : "";
  const jobName = typeof value?.job_name === "string" ? value.job_name.trim() : "";
  if (!jobId && !jobName) return null;
  return {
    job_id: jobId,
    job_name: jobName || "Selected opportunity",
  };
}

export function loadSelectedBidJob(): SelectedBidJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SELECTED_BID_JOB_STORAGE_KEY);
    if (!raw) return null;
    return normalizeSelectedBidJob(JSON.parse(raw) as Partial<SelectedBidJob>);
  } catch {
    return null;
  }
}

export function saveSelectedBidJob(job: SelectedBidJob): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeSelectedBidJob(job);
  if (!normalized) return;
  try {
    localStorage.setItem(SELECTED_BID_JOB_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota / private-mode failures; URL params still carry the selection.
  }
}
