/** Max upload size for optional DCK workbook template (.xlsx). */
export const SOW_WORKBOOK_TEMPLATE_MAX_BYTES = 25 * 1024 * 1024;

const WORKBOOK_TEMPLATE_EXTENSION = ".xlsx";

const ALLOWED_WORKBOOK_TEMPLATE_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "application/zip",
  "",
]);

function formatMaxTemplateSizeMb(): string {
  return String(Math.round(SOW_WORKBOOK_TEMPLATE_MAX_BYTES / (1024 * 1024)));
}

/**
 * Validates an optional DCK workbook template before upload.
 * Returns an error message, or null when the file is acceptable.
 */
export function validateSowWorkbookTemplate(file: File): string | null {
  if (!(file instanceof File)) {
    return "Template file is required.";
  }

  const name = file.name.trim();
  if (!name) {
    return "Template file name is missing.";
  }

  const dotIndex = name.lastIndexOf(".");
  const extension =
    dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
  if (extension !== WORKBOOK_TEMPLATE_EXTENSION) {
    return "Template must be an Excel workbook (.xlsx).";
  }

  if (file.size <= 0) {
    return "Template file is empty.";
  }

  if (file.size > SOW_WORKBOOK_TEMPLATE_MAX_BYTES) {
    return `Template file is too large (max ${formatMaxTemplateSizeMb()} MB).`;
  }

  const mime = (file.type || "").toLowerCase();
  if (mime && !ALLOWED_WORKBOOK_TEMPLATE_MIME_TYPES.has(mime)) {
    return "Template must be a valid .xlsx Excel file.";
  }

  return null;
}

/** Confirms the file header matches an Office Open XML workbook (ZIP / PK). */
export async function validateSowWorkbookTemplateContent(
  file: File
): Promise<string | null> {
  const basicError = validateSowWorkbookTemplate(file);
  if (basicError) return basicError;

  if (file.size < 4) {
    return "Template file is not a valid .xlsx workbook.";
  }

  try {
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (header[0] !== 0x50 || header[1] !== 0x4b) {
      return "Template file does not appear to be a valid .xlsx workbook.";
    }
  } catch {
    return "Could not read the template file. Please try again.";
  }

  return null;
}

export function assertSowWorkbookTemplate(file: File): void {
  const message = validateSowWorkbookTemplate(file);
  if (message) {
    throw new Error(message);
  }
}

export async function assertSowWorkbookTemplateContent(file: File): Promise<void> {
  const message = await validateSowWorkbookTemplateContent(file);
  if (message) {
    throw new Error(message);
  }
}
