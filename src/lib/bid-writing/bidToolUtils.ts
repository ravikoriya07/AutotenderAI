import type { BidToolApiId } from "@/lib/bid-writing/types";

const TOOL_DISPLAY_LABELS: Record<string, string> = {
  askAi: "Ask AI",
  spellCheck: "Spell Check",
  expand: "Expand",
  summarize: "Summarize",
  rephrase: "Rephrase",
  shorten: "Shorten",
  makeFormal: "Make Formal",
};

const UI_TOOL_TO_API: Record<string, BidToolApiId> = {
  spellCheck: "spell_check",
  expand: "expand",
  summarize: "summarize",
  rephrase: "rephrase",
  shorten: "shorten",
  makeFormal: "formal",
};

export function uiToolIdToApiTool(toolId: string): BidToolApiId | null {
  return UI_TOOL_TO_API[toolId] ?? null;
}

export function toolDisplayLabel(toolId: string | null | undefined): string | null {
  if (!toolId) return null;
  return TOOL_DISPLAY_LABELS[toolId] ?? null;
}

/** Header label in Tool Output panel (e.g. "SPELL CHECK"). */
export function toolHeaderLabel(toolId: string | null | undefined): string | null {
  const label = toolDisplayLabel(toolId);
  return label ? label.toUpperCase() : null;
}

/** Loader line while waiting for first SSE token (e.g. "Running Spell Check..."). */
export function toolRunningMessage(toolId: string | null | undefined): string {
  const label = toolDisplayLabel(toolId);
  return label ? `Running ${label}...` : "Running...";
}

/** Server-backed draft ids only (skip client-only upload placeholders). */
export function isPersistedDraftId(draftId: string | null | undefined): boolean {
  if (!draftId?.trim()) return false;
  return !draftId.startsWith("upload-");
}
