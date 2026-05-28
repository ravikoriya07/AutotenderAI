import type {
  ProjectDetailTabContent,
  ProjectDetailTabContentRaw,
} from "@/types/project-detail";

function isTypedTabContent(
  raw: ProjectDetailTabContentRaw | ProjectDetailTabContent
): raw is ProjectDetailTabContent {
  return (
    "type" in raw &&
    (raw.type === "fields" ||
      raw.type === "string_list" ||
      raw.type === "record_list" ||
      raw.type === "placeholder")
  );
}

function normalizeRecords(
  records: Record<string, unknown>[]
): Record<string, string>[] {
  return records.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, v == null ? "" : String(v)])
    )
  );
}

/**
 * Maps raw API content to a typed renderer model (`fields`, `string_list`, etc.).
 */
export function inferTabContent(
  raw: ProjectDetailTabContentRaw | ProjectDetailTabContent | undefined,
  tabLabel: string
): ProjectDetailTabContent {
  if (!raw || typeof raw !== "object") {
    return {
      type: "placeholder",
      message: `${tabLabel} — content coming soon.`,
    };
  }

  if (isTypedTabContent(raw)) {
    return raw;
  }

  const content: ProjectDetailTabContentRaw = raw;

  if (Array.isArray(content.records) && content.records.length > 0) {
    return {
      type: "record_list",
      title: content.title ?? tabLabel,
      records: normalizeRecords(content.records as Record<string, unknown>[]),
    };
  }

  if (Array.isArray(content.items)) {
    if (content.items.length === 0) {
      return {
        type: "placeholder",
        message: `No ${tabLabel.toLowerCase()} recorded for this project.`,
      };
    }
    return {
      type: "string_list",
      title: content.title ?? tabLabel,
      items: content.items,
    };
  }

  const fields = content.fields;
  const sections = content.sections;
  if (
    (Array.isArray(fields) && fields.length > 0) ||
    (Array.isArray(sections) && sections.length > 0)
  ) {
    return {
      type: "fields",
      title: content.title,
      fields,
      sections,
    };
  }

  if (typeof content.message === "string" && content.message.trim() !== "") {
    return { type: "placeholder", message: content.message };
  }

  return {
    type: "placeholder",
    message: `${tabLabel} — content coming soon.`,
  };
}
