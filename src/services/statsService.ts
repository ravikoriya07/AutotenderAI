import type { AxiosRequestConfig } from "axios";
import { apiClient } from "@/lib/apiClient";

type StatsRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

export type CompletedStepProject = {
  job_id: string;
  project_name: string;
};

export type CompletedStepStat = {
  step_name: string;
  completed_count: number;
  projects?: CompletedStepProject[];
};

const CACHE_TTL_MS = 30 * 1000; // 30s — short enough that background-processed jobs appear quickly

type StepsCacheEntry = {
  data: CompletedStepStat[];
  expiresAt: number;
};

/** Separate TTL cache per query variant (default vs `step_name`). */
const completedStepsCacheByKey = new Map<string, StepsCacheEntry>();

/** Coalesce concurrent fetches (e.g. Header + Research page both use the same `stepName`). */
const inFlightCompletedSteps = new Map<string, Promise<CompletedStepStat[]>>();

function completedStepsCacheKey(stepName?: string): string {
  const s = stepName?.trim();
  return s ? `step:${s}` : "default";
}

function isStepRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function normalizeProjectItem(raw: unknown): CompletedStepProject | null {
  if (!isStepRecord(raw)) return null;
  const job_id = typeof raw.job_id === "string" ? raw.job_id.trim() : "";
  if (!job_id) return null;
  const name =
    typeof raw.project_name === "string" ? raw.project_name.trim() : "";
  return {
    job_id,
    project_name: name || "Unnamed project",
  };
}

function normalizeProjectsArray(raw: unknown): CompletedStepProject[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeProjectItem).filter(Boolean) as CompletedStepProject[];
}

function normalizeStepItem(raw: unknown): CompletedStepStat | null {
  if (!isStepRecord(raw)) return null;
  const stepName = raw.step_name;
  if (typeof stepName !== "string" || !stepName.trim()) return null;
  const count =
    typeof raw.completed_count === "number" && Number.isFinite(raw.completed_count)
      ? raw.completed_count
      : 0;
  const projects = normalizeProjectsArray(raw.projects);
  return {
    step_name: stepName.trim(),
    completed_count: count,
    projects: projects.length > 0 ? projects : undefined,
  };
}

/** Unique projects from all step rows (by `job_id`), sorted by name. */
export function flattenProjectsFromCompletedSteps(
  steps: CompletedStepStat[]
): CompletedStepProject[] {
  const map = new Map<string, CompletedStepProject>();
  for (const s of steps) {
    for (const p of s.projects ?? []) {
      if (p.job_id && !map.has(p.job_id)) {
        map.set(p.job_id, p);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.project_name.localeCompare(b.project_name, undefined, {
      sensitivity: "base",
    })
  );
}

/** Normalizes GET /stats/completed-steps payloads (single object, array, or `{ steps: [...] }`). */
export function normalizeCompletedStepsPayload(data: unknown): CompletedStepStat[] {
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data.map(normalizeStepItem).filter(Boolean) as CompletedStepStat[];
  }
  if (!isStepRecord(data)) return [];
  if (Array.isArray(data.steps)) {
    return data.steps.map(normalizeStepItem).filter(Boolean) as CompletedStepStat[];
  }
  if (typeof data.step_name === "string") {
    const one = normalizeStepItem(data);
    return one ? [one] : [];
  }
  /** Response with only `projects` array (no `step_name`). */
  if (Array.isArray(data.projects)) {
    const projects = normalizeProjectsArray(data.projects);
    if (projects.length > 0) {
      return [
        {
          step_name: "projects",
          completed_count: projects.length,
          projects,
        },
      ];
    }
  }
  return [];
}

export type FetchCompletedStepsOptions = {
  force?: boolean;
  signal?: AbortSignal;
  /** When set, requests `GET /stats/completed-steps?step_name=…`. */
  stepName?: string;
};

/**
 * GET /stats/completed-steps — cached in-memory (TTL) per query variant.
 * On failure: logs to console and returns [] (cache not updated).
 */
export async function fetchCompletedSteps(
  options?: FetchCompletedStepsOptions
): Promise<CompletedStepStat[]> {
  const force = Boolean(options?.force);
  const stepName = options?.stepName?.trim();
  const cacheKey = completedStepsCacheKey(stepName);
  const now = Date.now();
  if (!force) {
    const hit = completedStepsCacheByKey.get(cacheKey);
    if (hit && now < hit.expiresAt) {
      return hit.data;
    }
  }

  const inflightKey = `${cacheKey}|${force ? "1" : "0"}`;
  const existing = inFlightCompletedSteps.get(inflightKey);
  if (existing) return existing;

  const pending = (async () => {
    try {
      const config: StatsRequestConfig = {
        skipGlobalLoader: true,
        ...(options?.signal ? { signal: options.signal } : {}),
        ...(stepName ? { params: { step_name: stepName } } : {}),
      };
      const { data } = await apiClient.get<unknown>(
        "/stats/completed-steps",
        config
      );
      const normalized = normalizeCompletedStepsPayload(data);
      const ts = Date.now();
      completedStepsCacheByKey.set(cacheKey, {
        data: normalized,
        expiresAt: ts + CACHE_TTL_MS,
      });
      return normalized;
    } catch (e) {
      console.log("fetchCompletedSteps failed", e);
      return [];
    } finally {
      inFlightCompletedSteps.delete(inflightKey);
    }
  })();

  inFlightCompletedSteps.set(inflightKey, pending);
  return pending;
}

export function invalidateCompletedStepsCache(): void {
  completedStepsCacheByKey.clear();
  inFlightCompletedSteps.clear();
}
