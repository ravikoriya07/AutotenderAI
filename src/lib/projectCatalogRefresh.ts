import { invalidateCompletedStepsCache } from "@/services/statsService";

/**
 * Dispatched when the project list changes (create / edit / delete) so consumers
 * like the header `useCompletedStepProjects` hook can refetch GET /stats/completed-steps.
 * Also clears the in-memory stats cache so the dropdown is not stuck on a 2‑minute TTL.
 */
export const PROJECT_CATALOG_REFRESH_EVENT = "autotender:project-catalog-refresh";

export function requestProjectCatalogRefresh(): void {
  invalidateCompletedStepsCache();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROJECT_CATALOG_REFRESH_EVENT));
}
