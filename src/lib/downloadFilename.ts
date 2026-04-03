/**
 * Parse filename from Content-Disposition (RFC 5987 filename* and filename=).
 * Browsers may omit this header from JS when CORS does not expose it.
 */
export function parseContentDispositionFilename(
  header: string | undefined | null
): string | null {
  if (!header || typeof header !== "string") return null;

  const star =
    /filename\*=\s*[^\s;]+''\s*([^;\r\n]+)/i.exec(header);
  if (star?.[1]) {
    const raw = star[1].trim().replace(/^["']|["']$/g, "");
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  const quoted = /filename="((?:[^"\\]|\\.)*)"/i.exec(header);
  if (quoted?.[1]) {
    return quoted[1].replace(/\\"/g, '"');
  }

  const plain = /filename=([^;\r\n]+)/i.exec(header);
  if (plain?.[1]) {
    return plain[1].trim().replace(/^["']|["']$/g, "");
  }

  return null;
}

/** Last path segment for single-file download fallback (e.g. extract_zip_output/a.xlsx → a.xlsx). */
export function basenameFromStoragePath(path: string): string {
  const t = path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const i = t.lastIndexOf("/");
  return i >= 0 ? t.slice(i + 1) : t || "download";
}

/** Extensions we treat as intentional file names (not “folder → .zip” fallback). */
const KNOWN_DOWNLOAD_EXT =
  /\.(pdf|docx?|xlsx?|xls|csv|txt|pptx?|png|jpe?g|gif|webp|svg|zip|json|xml|html?|md|log|dwg|dxf)$/i;

/**
 * When Content-Disposition is missing (e.g. CORS), pick a save name.
 * Folder downloads are application/zip but basename has no file extension — use ".zip".
 * .docx/.xlsx are ZIP on disk but must keep their real extension.
 */
export function fallbackDownloadFilename(
  path: string,
  contentType: string | undefined,
  zipMagic: boolean
): string {
  const base = basenameFromStoragePath(path) || "download";
  const ct = (contentType ?? "").toLowerCase();
  const hasKnownExt = KNOWN_DOWNLOAD_EXT.test(base);
  if (hasKnownExt) return base;
  if (ct.includes("application/zip") || (zipMagic && !hasKnownExt)) {
    return base.toLowerCase().endsWith(".zip") ? base : `${base}.zip`;
  }
  return base;
}

/** ZIP / Office Open XML / many archives start with PK (0x50 0x4B). */
export async function blobLooksLikeZipFamily(blob: Blob): Promise<boolean> {
  if (blob.size < 4) return false;
  const buf = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  return buf[0] === 0x50 && buf[1] === 0x4b;
}
