import type { ProjectDetailField } from "@/types/project-detail";

/** Converts a flat key-value record (API / legacy) into label-value fields. */
export function recordToFields(
  record: Record<string, string | null | undefined>
): ProjectDetailField[] {
  return Object.entries(record)
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([label, value]) => ({
      label,
      value: String(value),
    }));
}
