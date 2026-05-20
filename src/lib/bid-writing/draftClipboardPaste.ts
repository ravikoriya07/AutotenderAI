import {
  editableDomToMarkdown,
  normalizeAppliedMarkdown,
  sanitizeCitationMarkdown,
} from "@/lib/bid-writing/draftEditableMarkdown";

function stripClipboardCitationUi(root: HTMLElement): void {
  root.querySelectorAll(".atai-citation-tooltip").forEach((el) => el.remove());
  root.querySelectorAll(".atai-citation-ref").forEach((ref) => {
    const badge = ref.querySelector(".atai-citation-badge");
    const display = badge?.textContent?.trim() ?? "";
    ref.replaceWith(document.createTextNode(display));
  });
}

function looksLikeMarkdown(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /^#{1,6}\s/m.test(t) ||
    /^\s*[-*+]\s/m.test(t) ||
    /^\s*\d+\.\s/m.test(t) ||
    /\*\*[^*]+\*\*/.test(t) ||
    /\[[^\]]+\]\([^)]+\)/.test(t) ||
    /^>\s/m.test(t)
  );
}

function prepareClipboardHtmlRoot(html: string): HTMLElement {
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(\/?)(o|w|v|m):[^>]*>/gi, "");
  const root = document.createElement("div");
  root.innerHTML = cleaned;
  root
    .querySelectorAll(
      "script,style,noscript,meta,link,head,title,svg,canvas,iframe,object,embed"
    )
    .forEach((n) => n.remove());
  root.querySelectorAll("[style],[class],[id]").forEach((el) => {
    el.removeAttribute("style");
    el.removeAttribute("class");
    el.removeAttribute("id");
  });
  stripClipboardCitationUi(root);
  root.querySelectorAll("b").forEach((b) => {
    const strong = document.createElement("strong");
    strong.innerHTML = b.innerHTML;
    b.replaceWith(strong);
  });
  root.querySelectorAll("i").forEach((i) => {
    const em = document.createElement("em");
    em.innerHTML = i.innerHTML;
    i.replaceWith(em);
  });
  return root;
}

/** Convert clipboard HTML to draft markdown (headings, lists, emphasis, links). */
export function clipboardHtmlToMarkdown(html: string): string {
  if (typeof document === "undefined") return "";
  const root = prepareClipboardHtmlRoot(html);
  return normalizeAppliedMarkdown(editableDomToMarkdown(root));
}

/** Normalize plain clipboard text (often markdown from other sites). */
export function clipboardPlainToMarkdown(text: string): string {
  const s = text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\u2028/g, "\n");
  return normalizeAppliedMarkdown(s);
}

/**
 * Read clipboard and return clean markdown (no styles, tooltips, or leaked source labels).
 */
export function parseClipboardToMarkdown(
  data: DataTransfer,
  sourceLabelBySeq?: ReadonlyMap<number, string>
): string {
  const html = data.getData("text/html")?.trim() ?? "";
  const plain = data.getData("text/plain")?.trim() ?? "";

  let md = "";
  const htmlHasStructure =
    html.length > 0 &&
    /<(?:h[1-6]|p|ul|ol|li|div|table|blockquote|br)\b/i.test(html);

  if (plain && looksLikeMarkdown(plain) && (!htmlHasStructure || html.length < 40)) {
    md = clipboardPlainToMarkdown(plain);
  } else if (html && /<[a-z][\s\S]*>/i.test(html)) {
    md = clipboardHtmlToMarkdown(html);
  } else if (plain) {
    md = clipboardPlainToMarkdown(plain);
  }

  return sanitizeCitationMarkdown(md, sourceLabelBySeq);
}

/** Insert pasted markdown at a selection/caret with sensible block spacing. */
export function mergePastedMarkdown(
  before: string,
  insert: string,
  after: string
): string {
  const ins = insert.trim();
  if (!ins) return before + after;

  let b = before;
  let a = after;
  const blockInsert = /^(#{1,6}\s|[-*+]\s|\d+\.\s|>)/m.test(ins);

  if (b.length > 0) {
    if (blockInsert && !b.endsWith("\n\n")) {
      b = b.replace(/\n?$/, "\n\n");
    } else if (!b.endsWith("\n") && !b.endsWith(" ")) {
      b += ins.includes("\n") ? "\n\n" : " ";
    }
  }

  if (a.length > 0) {
    if (blockInsert && !ins.endsWith("\n\n") && !a.startsWith("\n")) {
      a = `\n\n${a.replace(/^\n+/, "")}`;
    } else if (!ins.endsWith("\n") && !a.startsWith("\n") && !/^\s/.test(a)) {
      a = (ins.includes("\n") ? "\n\n" : " ") + a;
    }
  }

  return b + ins + a;
}
