/**
 * Read PNG width/height from a `data:image/png;base64,...` URL without Image decode.
 * Used to map `/analyze_facade` bbox pixels to PDF overlay space.
 */
export function readPngDimensionsFromDataUrl(
  dataUrl: string | null | undefined
): { w: number; h: number } | null {
  if (dataUrl == null || typeof dataUrl !== "string") return null;
  const trimmed = dataUrl.trim();
  const m = /^data:image\/png;base64,(.+)$/i.exec(trimmed);
  if (!m?.[1]) return null;
  if (typeof atob !== "function") return null;
  let binary: string;
  try {
    binary = atob(m[1]);
  } catch {
    return null;
  }
  if (binary.length < 24) return null;
  const u = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    u[i] = binary.charCodeAt(i);
  }
  if (u[0] !== 0x89 || u[1] !== 0x50 || u[2] !== 0x4e || u[3] !== 0x47) return null;
  const width =
    (u[16] << 24) | (u[17] << 16) | (u[18] << 8) | (u[19] ?? 0);
  const height =
    (u[20] << 24) | (u[21] << 16) | (u[22] << 8) | (u[23] ?? 0);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 100_000 ||
    height > 100_000
  ) {
    return null;
  }
  return { w: width, h: height };
}
