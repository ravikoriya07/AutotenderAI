/**
 * Normalize tool-runner markdown so headings align with draft context
 * (parity with legacy drafts.js `renderMarkdownWithLevelOffset`).
 */

/** Smallest `#` heading level (1–3) in markdown, or 0 if none. */
export function detectMinHeadingLevel(rawText: string): number {
  let min = 0;
  for (const line of rawText.split("\n")) {
    const m = line.match(/^(#{1,3})\s+/);
    if (m) {
      const lvl = m[1].length;
      if (min === 0 || lvl < min) min = lvl;
    }
  }
  return min;
}

/** Shift h1–h3 levels so output's shallowest heading matches `targetLevel`. */
export function shiftToolOutputMarkdown(
  text: string,
  outputMinLevel: number,
  targetLevel: number
): string {
  if (!text.trim()) return text;
  const delta =
    outputMinLevel > 0 && targetLevel > 0 ? targetLevel - outputMinLevel : 0;
  if (delta === 0) return text;

  return text
    .split("\n")
    .map((line) => {
      const m = line.match(/^(#{1,3})(\s+.+)/);
      if (!m) return line;
      const newLevel = Math.min(3, Math.max(1, m[1].length + delta));
      return "#".repeat(newLevel) + m[2];
    })
    .join("\n");
}

/** Some models wrap the whole answer in a single fenced block. */
export function stripOuterMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return m ? m[1].trim() : text;
}

export function normalizeToolOutputMarkdown(
  raw: string,
  targetHeadingLevel: number
): string {
  const unfenced = stripOuterMarkdownFence(raw);
  const outputMin = detectMinHeadingLevel(unfenced);
  return shiftToolOutputMarkdown(unfenced, outputMin, targetHeadingLevel);
}
