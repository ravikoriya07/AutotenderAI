import {
  detectMinHeadingLevel,
  shiftToolOutputMarkdown,
  stripOuterMarkdownFence,
} from "@/lib/bid-writing/markdownToolOutput";
import {
  parseSourceReferenceSeqs,
  resolveSourceLabels,
} from "@/lib/bid-writing/sourceReferences";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function citationBadgeHtml(
  displayText: string,
  labels: string[],
  contentEditable = false
): string {
  const tooltipBody =
    labels.length === 1
      ? escapeHtml(labels[0])
      : labels.map((l) => escapeHtml(l)).join("<br>");
  const titleLabel = labels.length > 1 ? "Sources" : "Source";
  const ce = contentEditable ? "" : ' contenteditable="false"';
  return (
    `<span class="atai-citation-ref"${ce}>` +
    `<span class="atai-citation-badge" tabindex="0">${escapeHtml(displayText)}</span>` +
    `<span class="atai-citation-tooltip" role="tooltip" aria-hidden="true">` +
    `<span class="atai-citation-tooltip-label">${titleLabel}</span>${tooltipBody}` +
    `</span></span>`
  );
}

/** Inline markdown → HTML for the contenteditable draft body (citations as hover badges). */
function inlineMarkdownToHtml(
  text: string,
  sourceLabelBySeq?: ReadonlyMap<number, string>
): string {
  let s = escapeHtml(text);
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong class=\"font-semibold text-foreground\">$1</strong>");
  s = s.replace(/\*(\S[^*]*?\S|\S)\*/g, "<em class=\"italic text-foreground\">$1</em>");
  s = s.replace(/`([^`]+)`/g, "<code class=\"rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em]\">$1</code>");

  s = s.replace(/\[\s*SOURCE\s+ID\s*:\s*([^\]]+?)\s*\]/gi, (_, ids: string) => {
    const display = `[SOURCE ID: ${ids.trim()}]`;
    return citationBadgeHtml(display, [display]);
  });
  s = s.replace(/\[\s*WEB\s*\]/gi, () => citationBadgeHtml("[WEB]", ["Web source"]));
  s = s.replace(/\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]/g, (match, inner: string) => {
    const seqs = parseSourceReferenceSeqs(inner);
    const labels = resolveSourceLabels(seqs, sourceLabelBySeq);
    return citationBadgeHtml(match, labels);
  });

  return s;
}
const HEADING_CLASS: Record<number, string> = {
  1: "mt-4 mb-2 scroll-mt-20 border-b border-border pb-1.5 text-lg font-bold tracking-tight text-foreground first:mt-0",
  2: "mt-4 mb-2 scroll-mt-20 text-base font-semibold tracking-tight text-foreground first:mt-0",
  3: "mt-3 mb-1.5 scroll-mt-20 text-sm font-semibold text-foreground first:mt-0",
  4: "mt-3 mb-1 text-sm font-semibold text-foreground first:mt-0",
  5: "mt-2 mb-1 text-sm font-medium text-foreground first:mt-0",
  6: "mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-0",
};

const PARA_CLASS =
  "mb-3 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere] last:mb-0";

/** Ensure headings/lists in applied tool output sit on their own block lines. */
export function normalizeAppliedMarkdown(text: string): string {
  let s = text.replace(/\r\n/g, "\n").trim();
  s = s.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2");
  s = s.replace(/([^\n])\n([-*]\s)/g, "$1\n\n$2");
  return s;
}

/** Normalize, align heading levels, and prepare tool output for draft insertion. */
export function prepareAppliedToolOutput(
  output: string,
  headingTarget: number,
  sourceLabelBySeq?: ReadonlyMap<number, string>
): string {
  const normalized = stripOuterMarkdownFence(output).trim();
  const shifted = shiftToolOutputMarkdown(
    normalized,
    detectMinHeadingLevel(normalized),
    headingTarget
  );
  return sanitizeCitationMarkdown(normalizeAppliedMarkdown(shifted), sourceLabelBySeq);
}

function replacementHasBlockMarkdown(rep: string): boolean {
  return rep.split("\n").some((line) => {
    const t = line.trim();
    return /^(#{1,6})\s+/.test(t) || /^[-*+]\s+/.test(t) || /^\d+\.\s+/.test(t);
  });
}

/** Expand [start, end) to full lines when replacing with block-level markdown. */
function expandRangeToLineBoundaries(
  markdown: string,
  start: number,
  end: number
): [number, number] {
  let s = start;
  let e = end;
  while (s > 0 && markdown[s - 1] !== "\n") s -= 1;
  while (e < markdown.length && markdown[e] !== "\n") e += 1;
  if (e < markdown.length && markdown[e] === "\n") e += 1;
  return [s, e];
}

/**
 * Replace a selection range with tool output, padding newlines so block markdown
 * (e.g. `###` headings) renders correctly instead of appearing inline as raw text.
 */
export function spliceMarkdownWithSelection(
  markdown: string,
  start: number,
  end: number,
  replacement: string
): string {
  const rep = replacement.trim();
  let spliceStart = start;
  let spliceEnd = end;

  if (replacementHasBlockMarkdown(rep)) {
    [spliceStart, spliceEnd] = expandRangeToLineBoundaries(markdown, start, end);
  }

  let before = markdown.slice(0, spliceStart);
  let after = markdown.slice(spliceEnd);

  if (replacementHasBlockMarkdown(rep)) {
    if (before.length > 0 && !/\n\n\s*$/.test(before)) {
      before = before.replace(/\n?$/, "\n\n");
    }
    if (after.length > 0 && !/^\n/.test(after)) {
      after = `\n\n${after.replace(/^\n+/, "")}`;
    }
  } else if (rep.includes("\n")) {
    if (before.length > 0 && !before.endsWith("\n")) before += "\n";
    if (after.length > 0 && !after.startsWith("\n")) after = `\n${after}`;
  }

  return before + rep + after;
}

/** Render draft markdown as HTML for direct editing (subset aligned with MarkdownRenderer). */
export function renderEditableDraftHtml(
  text: string,
  sourceLabelBySeq?: ReadonlyMap<number, string>
): string {
  const cleaned = sanitizeCitationMarkdown(text, sourceLabelBySeq);
  if (!cleaned.trim()) {
    return `<p class="${PARA_CLASS}"><br></p>`;
  }

  const lines = cleaned.split("\n");
  let html = "";
  let inUl = false;
  let paraLines: string[] = [];

  function flushPara() {
    if (paraLines.length) {
      html += `<p class="${PARA_CLASS}">${inlineMarkdownToHtml(paraLines.join(" "), sourceLabelBySeq)}</p>`;
      paraLines = [];
    }
  }
  function closeUl() {
    if (inUl) {
      html += "</ul>";
      inUl = false;
    }
  }

  for (const line of lines) {
    const t = line.trim();
    if (/^[-*_]{3,}$/.test(t)) {
      flushPara();
      closeUl();
      html += '<hr class="my-5 border-border">';
      continue;
    }
    const hm = t.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      flushPara();
      closeUl();
      const level = Math.min(6, hm[1].length);
      html += `<h${level} class="${HEADING_CLASS[level] ?? HEADING_CLASS[6]}">${inlineMarkdownToHtml(hm[2], sourceLabelBySeq)}</h${level}>`;
      continue;
    }
    const ul = t.match(/^[-*]\s+(.+)/);
    if (ul) {
      flushPara();
      if (!inUl) {
        html +=
          '<ul class="mb-3 ml-4 list-disc space-y-1 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere] marker:text-muted-foreground">';
        inUl = true;
      }
      html += `<li class="pl-1">${inlineMarkdownToHtml(ul[1], sourceLabelBySeq)}</li>`;
      continue;
    }
    if (t === "") {
      flushPara();
      closeUl();
      continue;
    }
    closeUl();
    paraLines.push(t);
  }
  flushPara();
  closeUl();
  return html;
}

/** Extract display text from a citation-ref HTML widget (badge only, never tooltip body). */
function citationRefHtmlToMarkdown(citationRefHtml: string): string {
  const badgeMatch = citationRefHtml.match(
    /\batai-citation-badge\b[^>]*>([\s\S]*?)<\/span>/i
  );
  if (badgeMatch) {
    return badgeMatch[1].replace(/<[^>]+>/g, "").trim();
  }
  return citationRefHtml.replace(/<[^>]+>/g, "").trim();
}

/**
 * Remove duplicate source labels after citations in markdown.
 * e.g. `[39] 39. LB HARINGEY...` → `[39]` (tooltip text leaked or returned by API).
 */
export function sanitizeCitationMarkdown(
  markdown: string,
  sourceLabelBySeq?: ReadonlyMap<number, string>
): string {
  let s = markdown;

  if (sourceLabelBySeq?.size) {
    for (const [key, label] of sourceLabelBySeq) {
      const trimmedLabel = label?.trim();
      if (!trimmedLabel) continue;
      const seq = typeof key === "number" ? key : parseInt(String(key), 10);
      if (!Number.isFinite(seq)) continue;
      const esc = trimmedLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      s = s.replace(new RegExp(`\\[${seq}\\]\\s*${esc}`, "gi"), `[${seq}]`);
      s = s.replace(
        new RegExp(`\\[${seq}\\]\\s*${seq}\\.\\s*${esc}`, "gi"),
        `[${seq}]`
      );
    }
  }

  // `[39] 39. TITLE...` when label starts with "seq."
  s = s.replace(/\[(\d+)\]\s+\1\.\s+[^\[\n]+/g, "[$1]");

  return s;
}

/** Restore `[N]` / citation badges and strip inline formatting tags from an HTML fragment. */
export function badgeHtmlToMarkdown(html: string): string {
  let out = html;
  out = out.replace(
    /<span[^>]*\batai-citation-ref\b[^>]*>([\s\S]*?)<\/span>/gi,
    (_, inner: string) => citationRefHtmlToMarkdown(inner)
  );
  out = out.replace(
    /<span[^>]*\batai-citation-badge\b[^>]*>([\s\S]*?)<\/span>/gi,
    (_, badge: string) => badge.replace(/<[^>]+>/g, "").trim()
  );
  out = out.replace(
    /<span[^>]*class="[^"]*atai-citation[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, inner: string) => citationRefHtmlToMarkdown(inner)
  );
  out = out.replace(/<span[^>]*class="source-badge"[^>]*>([^<]+)<\/span>/gi, (_, n: string) => `[${n.trim()}]`);
  out = out.replace(/<span[^>]*class="web-badge"[^>]*>[^<]*<\/span>/gi, "[WEB]");
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<\/p>/gi, "\n");
  out = out.replace(/<\/div>/gi, "\n");
  out = out.replace(/<\/li>/gi, "\n");
  out = out.replace(/<[^>]+>/g, "");
  out = out
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return out.replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").trim();
}

function nodeToMarkdownText(node: Element): string {
  return badgeHtmlToMarkdown(node.innerHTML || "");
}

/** Convert the contenteditable draft body DOM back to raw markdown. */
export function editableDomToMarkdown(root: HTMLElement): string {
  const parts: string[] = [];

  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent ?? "").trim();
      if (t) parts.push(t);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();

    const hm = tag.match(/^H([1-6])$/);
    if (hm) {
      parts.push(`${"#".repeat(Number(hm[1]))} ${nodeToMarkdownText(el)}`);
      continue;
    }
    if (tag === "HR") {
      parts.push("---");
      continue;
    }
    if (tag === "UL" || tag === "OL") {
      for (const li of el.querySelectorAll(":scope > li")) {
        parts.push(`- ${nodeToMarkdownText(li)}`);
      }
      continue;
    }
    if (tag === "BLOCKQUOTE") {
      const t = nodeToMarkdownText(el);
      if (t) parts.push(t.split("\n").map((line) => `> ${line}`).join("\n"));
      continue;
    }
    if (tag === "TABLE") {
      const rows: string[] = [];
      for (const tr of el.querySelectorAll("tr")) {
        const cells = Array.from(tr.querySelectorAll("th, td")).map((c) =>
          nodeToMarkdownText(c).replace(/\|/g, "\\|")
        );
        if (cells.length) rows.push(`| ${cells.join(" | ")} |`);
      }
      if (rows.length) parts.push(rows.join("\n"));
      continue;
    }
    if (tag === "P" || tag === "DIV" || tag === "SPAN") {
      const t = nodeToMarkdownText(el);
      if (t) parts.push(t);
      continue;
    }
    const t = nodeToMarkdownText(el);
    if (t) parts.push(t);
  }

  return parts.join("\n\n");
}

/** Selection fragment → markdown-friendly text (for tool input / range mapping). */
export function selectionFragmentToMarkdown(fragment: DocumentFragment): string {
  const tmp = document.createElement("div");
  tmp.appendChild(fragment.cloneNode(true));
  return badgeHtmlToMarkdown(tmp.innerHTML);
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Strip common markdown syntax so DOM plain-text selections can match source markdown. */
function stripMarkdownSyntax(s: string): string {
  return s
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(?:\d+(?:\s*,\s*\d+)*)\]/g, (m) => m);
}

/**
 * Map a DOM plain-text selection to [start, end) in `markdown` by scanning markdown
 * while skipping formatting tokens (# headings, **bold**, list markers, etc.).
 */
export function findPlainTextInMarkdown(markdown: string, plainSel: string): [number, number] | null {
  const target = collapseWhitespace(stripMarkdownSyntax(plainSel));
  if (!target) return null;

  let built = "";
  const map: number[] = [];
  let i = 0;

  while (i < markdown.length) {
    if (i === 0 || markdown[i - 1] === "\n") {
      const heading = markdown.slice(i).match(/^(#{1,6})\s+/);
      if (heading) {
        i += heading[0].length;
        continue;
      }
      const list = markdown.slice(i).match(/^[-*+]\s+/);
      if (list) {
        i += list[0].length;
        continue;
      }
    }

    if (markdown.startsWith("***", i)) {
      i += 3;
      continue;
    }
    if (markdown.startsWith("**", i)) {
      i += 2;
      continue;
    }
    if (markdown[i] === "*" || markdown[i] === "_") {
      i += 1;
      continue;
    }
    if (markdown[i] === "`") {
      i += 1;
      while (i < markdown.length && markdown[i] !== "`") i += 1;
      if (i < markdown.length) i += 1;
      continue;
    }

    const ch = markdown[i];
    if (/\s/.test(ch)) {
      if (built.length > 0 && built[built.length - 1] !== " ") {
        built += " ";
        map.push(i);
      }
    } else {
      built += ch;
      map.push(i);
    }
    i += 1;
  }

  const normBuilt = built;
  const idx = normBuilt.indexOf(target);
  if (idx === -1) return null;

  const start = map[idx] ?? 0;
  const endIdx = idx + target.length - 1;
  const end =
    endIdx < map.length ? map[endIdx] + 1 : markdown.length;
  return [start, end];
}

function pickRangeFromNormMatch(
  map: number[],
  normStart: number,
  normSelLen: number,
  markdownLength: number,
  hintStart?: number
): [number, number] {
  const origStart = map[normStart] ?? 0;
  const normEnd = normStart + normSelLen;
  const origEnd = normEnd < map.length ? map[normEnd] : markdownLength;
  if (hintStart == null || hintStart < 0) return [origStart, origEnd];
  const dist = Math.abs(origStart - hintStart);
  return [origStart, origEnd];
}

function findAllNormMatches(
  markdown: string,
  normSel: string
): Array<{ normStart: number; map: number[]; normMd: string }> {
  const norm: string[] = [];
  const map: number[] = [];
  let prevWs = false;
  for (let i = 0; i < markdown.length; i++) {
    if (/\s/.test(markdown[i])) {
      if (!prevWs) {
        norm.push(" ");
        map.push(i);
        prevWs = true;
      }
    } else {
      norm.push(markdown[i]);
      map.push(i);
      prevWs = false;
    }
  }
  const normMd = norm.join("");
  const hits: Array<{ normStart: number; map: number[]; normMd: string }> = [];
  let pos = 0;
  while (pos < normMd.length) {
    const idx = normMd.indexOf(normSel, pos);
    if (idx === -1) break;
    hits.push({ normStart: idx, map, normMd });
    pos = idx + 1;
  }
  return hits;
}

/** Find all exact substring positions (for disambiguation with a stored offset). */
export function findAllExactRanges(
  markdown: string,
  selectedText: string
): [number, number][] {
  const trimmed = selectedText.trim();
  if (!trimmed) return [];
  const ranges: [number, number][] = [];
  let pos = 0;
  while (pos < markdown.length) {
    const idx = markdown.indexOf(trimmed, pos);
    if (idx === -1) break;
    ranges.push([idx, idx + trimmed.length]);
    pos = idx + 1;
  }
  return ranges;
}

function pickRangeClosestToHint(
  ranges: [number, number][],
  hintStart?: number
): [number, number] | null {
  if (ranges.length === 0) return null;
  if (ranges.length === 1 || hintStart == null || hintStart < 0) return ranges[0];
  let best = ranges[0];
  let bestDist = Math.abs(best[0] - hintStart);
  for (const r of ranges.slice(1)) {
    const d = Math.abs(r[0] - hintStart);
    if (d < bestDist) {
      best = r;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Find character range in `markdown` for `selectedText` from the rendered editor.
 * Tries exact match, whitespace-normalized match, then plain-text scan.
 */
export function findSelectionInMarkdown(
  markdown: string,
  selectedText: string,
  hintStart?: number
): [number, number] | null {
  const trimmed = selectedText.trim();
  if (!trimmed) return null;

  const exactRanges = findAllExactRanges(markdown, trimmed);
  const exactPick = pickRangeClosestToHint(exactRanges, hintStart);
  if (exactPick) return exactPick;

  const normSel = trimmed.replace(/\s+/g, " ");
  const normHits = findAllNormMatches(markdown, normSel);
  if (normHits.length > 0) {
    let best: [number, number] | null = null;
    let bestDist = Infinity;
    for (const hit of normHits) {
      const range = pickRangeFromNormMatch(
        hit.map,
        hit.normStart,
        normSel.length,
        markdown.length,
        hintStart
      );
      const dist =
        hintStart != null && hintStart >= 0
          ? Math.abs(range[0] - hintStart)
          : 0;
      if (dist < bestDist) {
        best = range;
        bestDist = dist;
      }
    }
    if (best) return best;
  }

  const anchor = findSelectionByAnchors(markdown, trimmed, hintStart);
  if (anchor) return anchor;

  return findPlainTextInMarkdown(markdown, trimmed);
}

/** Match using leading + trailing anchors when full-string search fails. */
export function findSelectionByAnchors(
  markdown: string,
  selectedText: string,
  hintStart?: number
): [number, number] | null {
  const sel = selectedText.trim();
  if (sel.length < 24) return null;

  const leadLen = Math.min(32, Math.floor(sel.length / 3));
  const trailLen = Math.min(32, Math.floor(sel.length / 3));
  const lead = sel.slice(0, leadLen);
  const trail = sel.slice(-trailLen);

  const leadRanges = findAllExactRanges(markdown, lead);
  if (leadRanges.length === 0) {
    const leadNorm = findSelectionInMarkdown(markdown, lead, hintStart);
    if (!leadNorm) return null;
    leadRanges.push(leadNorm);
  }

  let best: [number, number] | null = null;
  let bestScore = Infinity;

  for (const [start] of leadRanges) {
    const searchFrom = start + lead.length;
    const trailIdx = markdown.indexOf(trail, searchFrom);
    if (trailIdx === -1) continue;
    const end = trailIdx + trail.length;
    const slice = markdown.slice(start, end);
    const a = collapseWhitespace(stripMarkdownSyntax(slice));
    const b = collapseWhitespace(stripMarkdownSyntax(sel));
    if (a !== b && !a.includes(b) && !b.includes(a)) continue;
    const score =
      Math.abs(start - (hintStart ?? start)) + Math.abs(slice.length - sel.length);
    if (score < bestScore) {
      best = [start, end];
      bestScore = score;
    }
  }

  return best;
}

/** Stable fingerprint of draft markdown for validating stored selection offsets. */
export function hashDraftContent(content: string): string {
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h + content.charCodeAt(i)) >>> 0;
  }
  return `${content.length.toString(36)}-${h.toString(36)}`;
}

export type ToolSelectionSnapshot = {
  selectedText: string;
  start: number;
  end: number;
  baseContent: string;
  contentHash: string;
};

export function sliceMatchesSelectionLoose(slice: string, selectedText: string): boolean {
  const sel = selectedText.trim();
  if (!sel) return false;
  if (slice === sel) return true;
  const a = collapseWhitespace(stripMarkdownSyntax(slice));
  const b = collapseWhitespace(stripMarkdownSyntax(sel));
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return findSelectionInMarkdown(slice, sel) !== null;
}

function getTextNodeCharOffsets(root: HTMLElement, range: Range): [number, number] | null {
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as Text);

    let pos = 0;
    let start = -1;
    let end = -1;
    const startNode = range.startContainer;
    const startOff = range.startOffset;
    const endNode = range.endContainer;
    const endOff = range.endOffset;

    for (const node of nodes) {
      const len = node.textContent?.length ?? 0;
      if (node === startNode && start < 0) start = pos + startOff;
      if (node === endNode) {
        end = pos + endOff;
        break;
      }
      pos += len;
    }
    if (start < 0 || end < 0 || end <= start) return null;
    return [start, end];
  } catch {
    return null;
  }
}

function buildVisiblePlainIndex(root: HTMLElement): { text: string; map: number[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const map: number[] = [];
  const chars: string[] = [];
  let n: Node | null;
  let prevWs = false;
  while ((n = walker.nextNode())) {
    const raw = n.textContent ?? "";
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (/\s/.test(ch)) {
        if (!prevWs && chars.length > 0) {
          chars.push(" ");
          map.push(i > 0 ? i - 1 : 0);
          prevWs = true;
        }
      } else {
        chars.push(ch);
        map.push(i);
        prevWs = false;
      }
    }
  }
  return { text: chars.join(""), map };
}

/** Map a DOM Range in the editor to [start, end) in `markdown` via visible plain text. */
export function findRangeFromDomSelection(
  root: HTMLElement,
  markdown: string,
  selectedText: string,
  range: Range | null
): [number, number] | null {
  if (!range || !root.contains(range.commonAncestorContainer)) return null;

  const offsets = getTextNodeCharOffsets(root, range);
  if (!offsets) return null;

  const [visStart, visEnd] = offsets;
  const visibleFull = root.textContent ?? "";
  const visSlice = visibleFull.slice(visStart, visEnd);
  const sel = selectedText.trim();
  if (
    collapseWhitespace(visSlice) !== collapseWhitespace(sel) &&
    !collapseWhitespace(visSlice).includes(collapseWhitespace(sel))
  ) {
    return null;
  }

  const { text: visPlain, map: visMap } = buildVisiblePlainIndex(root);
  const selPlain = collapseWhitespace(stripMarkdownSyntax(sel));
  const visTarget = collapseWhitespace(visSlice);

  let vStart = visPlain.indexOf(visTarget);
  if (vStart === -1) {
    vStart = visPlain.indexOf(selPlain);
    if (vStart === -1) return null;
  }
  const vEnd = vStart + (vStart === visPlain.indexOf(visTarget) ? visTarget.length : selPlain.length);

  const mdPlain = findPlainTextInMarkdown(markdown, sel);
  if (mdPlain) return mdPlain;

  // Align visible plain stream to markdown plain stream
  let built = "";
  const mdMap: number[] = [];
  let i = 0;
  let prevWs = false;
  while (i < markdown.length) {
    if (i === 0 || markdown[i - 1] === "\n") {
      const heading = markdown.slice(i).match(/^(#{1,6})\s+/);
      if (heading) {
        i += heading[0].length;
        continue;
      }
      const list = markdown.slice(i).match(/^[-*+]\s+/);
      if (list) {
        i += list[0].length;
        continue;
      }
    }
    if (markdown.startsWith("***", i)) {
      i += 3;
      continue;
    }
    if (markdown.startsWith("**", i)) {
      i += 2;
      continue;
    }
    if (markdown[i] === "*" || markdown[i] === "_") {
      i += 1;
      continue;
    }
    if (markdown[i] === "`") {
      i += 1;
      while (i < markdown.length && markdown[i] !== "`") i += 1;
      if (i < markdown.length) i += 1;
      continue;
    }
    const ch = markdown[i];
    if (/\s/.test(ch)) {
      if (!prevWs && built.length > 0) {
        built += " ";
        mdMap.push(i);
        prevWs = true;
      }
    } else {
      built += ch;
      mdMap.push(i);
      prevWs = false;
    }
    i += 1;
  }

  const anchor = visPlain.slice(Math.max(0, vStart - 40), vStart);
  const searchFrom = anchor.length > 0 ? built.indexOf(anchor) : 0;
  const idx =
    searchFrom >= 0 ? built.indexOf(selPlain, searchFrom) : built.indexOf(selPlain);
  if (idx === -1) return null;

  const start = mdMap[idx] ?? 0;
  const endIdx = idx + selPlain.length - 1;
  const end = endIdx < mdMap.length ? mdMap[endIdx] + 1 : markdown.length;
  return [start, end];
}

/** Capture stable selection offsets when a tool starts (independent of live DOM selection). */
export function computeToolSelectionSnapshot(
  baseContent: string,
  selectedText: string,
  editorEl?: HTMLElement | null,
  domRange?: Range | null
): ToolSelectionSnapshot | null {
  const sel = selectedText.trim();
  if (!sel) return null;

  let start = -1;
  let end = -1;

  const attempts: Array<() => [number, number] | null> = [
    () => findSelectionByAnchors(baseContent, sel),
    () => findSelectionInMarkdown(baseContent, sel),
    () =>
      editorEl && domRange
        ? findRangeFromDomSelection(editorEl, baseContent, sel, domRange)
        : null,
    () => findPlainTextInMarkdown(baseContent, sel),
  ];

  for (const attempt of attempts) {
    const found = attempt();
    if (found) {
      [start, end] = found;
      break;
    }
  }

  if (start < 0 && sel.length >= 12) {
    const prefix = sel.slice(0, Math.min(48, sel.length));
    const idx = baseContent.indexOf(prefix);
    if (idx !== -1) {
      start = idx;
      end = Math.min(baseContent.length, idx + sel.length);
    }
  }

  return {
    selectedText: sel,
    start,
    end,
    baseContent,
    contentHash: hashDraftContent(baseContent),
  };
}

/**
 * Resolve [start, end) for Apply: stored indexes first, then text search fallbacks.
 * Returns null only when no match exists in `currentContent`.
 */
export function resolveApplyRange(
  currentContent: string,
  snapshot: ToolSelectionSnapshot | null,
  selectedText: string
): [number, number] | null {
  const sel = (snapshot?.selectedText ?? selectedText).trim();
  if (!sel) return null;

  const hint = snapshot?.start ?? -1;

  if (snapshot && snapshot.start >= 0 && snapshot.end > snapshot.start) {
    const { start, end } = snapshot;

    if (start < end && end <= currentContent.length) {
      if (hashDraftContent(currentContent) === snapshot.contentHash) {
        return [start, end];
      }
      if (sliceMatchesSelectionLoose(currentContent.slice(start, end), sel)) {
        return [start, end];
      }
    }

    if (
      start < end &&
      end <= snapshot.baseContent.length &&
      sliceMatchesSelectionLoose(snapshot.baseContent.slice(start, end), sel)
    ) {
      if (snapshot.baseContent === currentContent) {
        return [start, end];
      }
      const mapped = findSelectionInMarkdown(currentContent, sel, start);
      if (mapped) return mapped;
    }
  }

  const inCurrent = findSelectionInMarkdown(currentContent, sel, hint);
  if (inCurrent) return inCurrent;

  if (snapshot?.baseContent && snapshot.baseContent !== currentContent) {
    const inBase = findSelectionInMarkdown(snapshot.baseContent, sel, snapshot.start);
    if (inBase) {
      if (snapshot.baseContent === currentContent) return inBase;
      const mapped = findSelectionInMarkdown(currentContent, sel, inBase[0]);
      if (mapped) return mapped;
    }
  }

  const anchor = findSelectionByAnchors(currentContent, sel, hint);
  if (anchor) return anchor;

  return findPlainTextInMarkdown(currentContent, sel);
}

type TextNodeOffset = { node: Text; nodeStart: number };

/** Find a DOM Range by matching plain text inside `root` (whitespace-tolerant). */
export function findRangeFromPlainTextInElement(
  root: HTMLElement,
  searchText: string
): Range | null {
  const target = collapseWhitespace(searchText);
  if (!target) return null;

  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as Text);

    const norm: string[] = [];
    const map: TextNodeOffset[] = [];
    let prevWs = false;

    for (const node of nodes) {
      const raw = node.textContent ?? "";
      for (let i = 0; i < raw.length; i++) {
        if (/\s/.test(raw[i])) {
          if (!prevWs && norm.length > 0) {
            norm.push(" ");
            map.push({ node, nodeStart: i });
            prevWs = true;
          }
        } else {
          norm.push(raw[i]);
          map.push({ node, nodeStart: i });
          prevWs = false;
        }
      }
    }

    const normFull = norm.join("");
    const idx = normFull.indexOf(target);
    if (idx === -1) return null;

    const startEntry = map[idx];
    const endExclusive = idx + target.length;
    const endEntry = endExclusive < map.length ? map[endExclusive] : null;
    const lastEntry = map[endExclusive - 1];
    if (!startEntry || !lastEntry) return null;

    const range = document.createRange();
    range.setStart(startEntry.node, startEntry.nodeStart);
    if (endEntry) {
      range.setEnd(endEntry.node, endEntry.nodeStart);
    } else {
      range.setEnd(lastEntry.node, lastEntry.nodeStart + 1);
    }
    return range;
  } catch {
    return null;
  }
}

/** Insert rendered tool-output HTML at a live DOM range (legacy drafts.js parity). */
export function insertToolOutputHtmlAtRange(range: Range, outputHtml: string): void {
  range.deleteContents();
  const wrapper = document.createElement("div");
  wrapper.innerHTML = outputHtml;
  const frag = document.createDocumentFragment();
  while (wrapper.firstChild) {
    frag.appendChild(wrapper.firstChild);
  }
  range.insertNode(frag);
}
