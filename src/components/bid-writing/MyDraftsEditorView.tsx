"use client";

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import {
  FileText,
  ChevronLeft,
  ChevronDown,
  Undo2,
  Redo2,
  Save,
  Download,
  Copy,
  PenLine,
  Maximize2,
  AlignLeft,
  RefreshCcw,
  Minimize2,
  Feather,
  Menu,
  Upload,
  Check,
  ArrowDownToLine,
  HelpCircle,
  Loader2,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import type { BidExportFormat, DraftRecord } from "@/lib/bid-writing/types";
import {
  exportBidDraft,
  messageFromBidExportError,
  streamBidDraftAsk,
  streamBidToolRun,
  triggerBidExportDownload,
  updateBidDraft,
} from "@/lib/bid-writing/bidWritingApi";
import { isPersistedDraftId, uiToolIdToApiTool } from "@/lib/bid-writing/bidToolUtils";
import { draftListDateLabel } from "@/lib/bid-writing/draftUtils";
import { detectMinHeadingLevel } from "@/lib/bid-writing/markdownToolOutput";
import {
  sourceLabelMapFromRecord,
  sourcesRecordFromUnknown,
} from "@/lib/bid-writing/sourceReferences";
import { EditorToolbarTooltip } from "@/components/bid-writing/EditorToolbarTooltip";
import {
  computeToolSelectionSnapshot,
  editableDomToMarkdown,
  findRangeFromPlainTextInElement,
  findSelectionInMarkdown,
  hashDraftContent,
  insertToolOutputHtmlAtRange,
  normalizeAppliedMarkdown,
  prepareAppliedToolOutput,
  renderEditableDraftHtml,
  sanitizeCitationMarkdown,
  resolveApplyRange,
  selectionFragmentToMarkdown,
  spliceMarkdownWithSelection,
  type ToolSelectionSnapshot,
} from "@/lib/bid-writing/draftEditableMarkdown";
import {
  ToolOutputBody,
  ToolOutputHeader,
} from "@/components/bid-writing/ToolOutputPanel";

const TOOLS = [
  { id: "spellCheck", label: "Spell Check", icon: PenLine },
  { id: "expand", label: "Expand", icon: Maximize2 },
  { id: "summarize", label: "Summarize", icon: AlignLeft },
  { id: "rephrase", label: "Rephrase", icon: RefreshCcw },
  { id: "shorten", label: "Shorten", icon: Minimize2 },
  { id: "makeFormal", label: "Make Formal", icon: Feather },
] as const;

function buildExpandPresets(base: number): number[] {
  return [base + 50, base + 100, base + 150];
}

function buildShortenPresets(base: number): number[] {
  if (base <= 0) return [];
  const raw = [
    Math.max(10, Math.round(base * 5 / 6)),
    Math.max(10, Math.round(base * 2 / 3)),
    Math.max(10, Math.round(base / 3)),
  ];
  const unique = [...new Set(raw)];
  return unique.filter(v => v < base);
}

function sortDraftSourceKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function formatWebSourceLine(item: unknown): { label: string; href: string | null } {
  if (typeof item === "string") {
    const t = item.trim();
    if (/^https?:\/\//i.test(t)) return { label: t, href: t };
    return { label: t, href: null };
  }
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    const url =
      typeof o.url === "string"
        ? o.url
        : typeof o.href === "string"
          ? o.href
          : typeof o.link === "string"
            ? o.link
            : null;
    const title =
      typeof o.title === "string"
        ? o.title
        : typeof o.name === "string"
          ? o.name
          : url;
    const label = title ?? url ?? JSON.stringify(o);
    return { label: String(label), href: url };
  }
  try {
    const s = JSON.stringify(item);
    return { label: s, href: null };
  } catch {
    return { label: String(item), href: null };
  }
}

// ---------------------------------------------------------------------------
// Undo/Redo history entry
// ---------------------------------------------------------------------------

type HistoryEntry = {
  content: string;
  /** Textarea cursor positions (edit mode only) for best-effort restoration. */
  cursorStart?: number;
  cursorEnd?: number;
};

// ---------------------------------------------------------------------------
// sessionStorage helpers — persist completed tool output across page refreshes
// ---------------------------------------------------------------------------

type PersistedToolState = {
  toolOutput: string;
  activeTool: string | null;
  toolOutputHeadingTarget: number;
  toolInputSelectedText: string;
  /** Edit-mode only: character offsets within the textarea value. */
  toolInputSelectionRange: [number, number] | null;
  /** Character offsets within markdown at tool-run time. */
  toolInputMarkdownRange: [number, number] | null;
  toolInputContentHash: string | null;
  toolOutputSources?: Record<string, string> | null;
};

function loadToolState(draftId: string): PersistedToolState | null {
  try {
    const raw = sessionStorage.getItem(`atai-tool-state-${draftId}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedToolState;
    return data.toolOutput?.trim() ? data : null;
  } catch {
    return null;
  }
}

function saveToolState(draftId: string, state: PersistedToolState): void {
  try {
    sessionStorage.setItem(`atai-tool-state-${draftId}`, JSON.stringify(state));
  } catch { /* quota / private-mode — ignore */ }
}

function clearToolState(draftId: string): void {
  try {
    sessionStorage.removeItem(`atai-tool-state-${draftId}`);
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// CSS Custom Highlight API — paints a persistent highlight over DOM text that
// survives focus loss, unlike the browser's native selection.
// Falls back silently on browsers that don't support the API yet.
// ---------------------------------------------------------------------------

function applyLockedHighlight(range: Range): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.Highlight || !("highlights" in CSS)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (CSS as any).highlights.set("atai-locked-selection", new w.Highlight(range));
  } catch { /* unsupported / SSR */ }
}

function clearLockedHighlight(): void {
  try {
    if (!("highlights" in CSS)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (CSS as any).highlights.delete("atai-locked-selection");
  } catch { /* ignore */ }
}

// Walk all text nodes inside `el` and find the first occurrence of `searchText`,
// returning a live Range that covers it (for use with the CSS Highlight API).
// Returns null if the text is not found or the API is unavailable.
function findTextRangeInElement(el: Element, searchText: string): Range | null {
  if (!searchText.trim()) return null;
  try {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as Text);

    // Build a flat string from all text nodes so indexOf gives us a char offset.
    const chunks = nodes.map((t) => t.textContent ?? "");
    const full = chunks.join("");
    const start = full.indexOf(searchText);
    if (start === -1) return null;

    const end = start + searchText.length;
    let startNode: Text | null = null, startOff = 0;
    let endNode: Text | null = null, endOff = 0;
    let pos = 0;

    for (const node of nodes) {
      const len = node.textContent?.length ?? 0;
      if (!startNode && pos + len > start) {
        startNode = node;
        startOff = start - pos;
      }
      if (!endNode && pos + len >= end) {
        endNode = node;
        endOff = end - pos;
        break;
      }
      pos += len;
    }

    if (!startNode || !endNode) return null;
    const range = document.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);
    return range;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------

interface MyDraftsEditorViewProps {
  drafts: DraftRecord[];
  setDrafts: React.Dispatch<React.SetStateAction<DraftRecord[]>>;
  draftsLoading?: boolean;
  draftsError?: boolean;
  draftsTotal?: number;
  activeDraftId: string | null;
  activeDraftLoading?: boolean;
  activeDraftLoadError?: string | null;
  sourceLabelBySeq?: ReadonlyMap<number, string>;
  onSelectDraft: (draftId: string) => void;
  onClearDraftSelection?: () => void;
  onRetryDraftLoad?: () => void;
  deletingDraftId?: string | null;
  onDeleteDraft?: (draft: { id: string; title: string }) => void;
  draftUploading?: boolean;
  onUploadDraft?: (file: File) => void;
}

export function MyDraftsEditorView({
  drafts,
  setDrafts,
  draftsLoading = false,
  draftsError = false,
  draftsTotal = 0,
  activeDraftId,
  activeDraftLoading = false,
  activeDraftLoadError = null,
  sourceLabelBySeq,
  onSelectDraft,
  onClearDraftSelection,
  onRetryDraftLoad,
  deletingDraftId = null,
  onDeleteDraft,
  draftUploading = false,
  onUploadDraft,
}: MyDraftsEditorViewProps) {
  const [editorSidebarOpen, setEditorSidebarOpen] = useState(false);
  const [toolOutput, setToolOutput] = useState<string | null>(null);
  const [toolStreaming, setToolStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolOutputHeadingTarget, setToolOutputHeadingTarget] = useState(0);
  const [toolOutputSources, setToolOutputSources] = useState<Record<string, string> | null>(null);
  const toolStreamAbortRef = useRef<AbortController | null>(null);
  // Mirrors toolStreaming state as a ref so event-handler closures (registered once)
  // can read the current value without being re-registered on every state change.
  const toolStreamingRef = useRef(false);
  // Locked-selection system: active from tool-run until Apply/cancel/new-selection.
  // The ref is readable inside stale closures; the state drives React re-renders.
  const lockedRangeRef = useRef<Range | null>(null);
  const selectionLockedRef = useRef(false);
  const [selectionLocked, setSelectionLocked] = useState(false);
  // True while we need to (re-)apply the CSS highlight after draft content loads.
  // Set when restoring from sessionStorage; cleared by the restore effect below.
  const [pendingHighlightRestore, setPendingHighlightRestore] = useState(false);
  const [copied, setCopied] = useState(false);
  const [askAiOpen, setAskAiOpen] = useState(false);
  const [askAiInput, setAskAiInput] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<BidExportFormat | null>(null);
  const downloadRef = useRef<HTMLDivElement>(null);

  const [wcExpandOpen, setWcExpandOpen] = useState(false);
  const [wcShortenOpen, setWcShortenOpen] = useState(false);
  const [wcExpandCustom, setWcExpandCustom] = useState("");
  const [wcShortenCustom, setWcShortenCustom] = useState("");
  const [wcExpandPreset, setWcExpandPreset] = useState<number | null>(null);
  const [wcShortenPreset, setWcShortenPreset] = useState<number | null>(null);
  const [wcExpandError, setWcExpandError] = useState<string | null>(null);
  const [wcShortenError, setWcShortenError] = useState<string | null>(null);
  const [draftMenuOpenId, setDraftMenuOpenId] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState("");
  // DOM-sourced word count — kept in sync via useEffect; see comment on that effect.
  const [renderedWordCount, setRenderedWordCount] = useState(0);

  // Snapshot of the selection captured when a tool is run, so Apply uses
  // the original selection even if the user changes it while streaming.
  const [toolInputSelectedText, setToolInputSelectedText] = useState<string>("");
  // Edit mode: character offsets within the textarea value.
  const [toolInputSelectionRange, setToolInputSelectionRange] = useState<[number, number] | null>(null);
  // Preview mode: character offsets within the raw markdown string (computed at tool-run time).
  const [toolInputMarkdownRange, setToolInputMarkdownRange] = useState<[number, number] | null>(null);

  // Undo/Redo history — stored in refs so pushes don't cause re-renders.
  // canUndo/canRedo are state so the buttons re-render when they change.
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIdxRef = useRef(-1);
  const historyDraftIdRef = useRef<string | null>(null);
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentSyncSkipRef = useRef<string | null>(null);
  const toolSelectionSnapshotRef = useRef<ToolSelectionSnapshot | null>(null);
  const [toolInputContentHash, setToolInputContentHash] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Stable refs so the keyboard-shortcut effect (registered once) always calls
  // the current render's undo/redo/save without needing to re-register on every change.
  const undoFnRef = useRef<() => void>(() => {});
  const redoFnRef = useRef<() => void>(() => {});
  const saveDraftFnRef = useRef<() => void>(() => {});

  const uploadDraftRef = useRef<HTMLInputElement>(null);
  const contentEditorRef = useRef<HTMLDivElement>(null);
  const activeDraft = drafts.find((d) => d.id === activeDraftId) ?? null;
  const activeDraftContent = activeDraft?.content;
  const selectionWordCount = countWords(selectedText);
  const baseWordCount = selectionWordCount > 0 ? selectionWordCount : renderedWordCount;
  const expandPresets = buildExpandPresets(baseWordCount);
  const shortenPresets = buildShortenPresets(baseWordCount);

  const toolOutputSourceLabelBySeq = useMemo(
    () => sourceLabelMapFromRecord(toolOutputSources, sourceLabelBySeq),
    [toolOutputSources, sourceLabelBySeq]
  );

  const draftSourceLabelBySeq = useMemo(
    () => sourceLabelMapFromRecord(activeDraft?.sources, sourceLabelBySeq),
    [activeDraft?.sources, sourceLabelBySeq]
  );

  /** Draft + latest tool-output sources for citation badges in the editor. */
  const editorSourceLabelBySeq = useMemo(
    () => sourceLabelMapFromRecord(toolOutputSources, draftSourceLabelBySeq),
    [toolOutputSources, draftSourceLabelBySeq]
  );

  useEffect(() => {
    // Reset undo/redo history whenever the active draft changes.
    if (historyDebounceRef.current !== null) {
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
    }
    historyRef.current = [];
    historyIdxRef.current = -1;
    historyDraftIdRef.current = activeDraftId;
    setCanUndo(false);
    setCanRedo(false);
    setIsSaving(false);

    // Abort any in-flight stream for the previous draft
    toolStreamAbortRef.current?.abort();
    toolStreamAbortRef.current = null;

    // Reset all transient tool state first (React 18 batches these with the
    // restore calls below so the final render uses the correct values).
    setToolStreaming(false);
    setToolOutput(null);
    setActiveTool(null);
    setToolOutputHeadingTarget(0);
    setToolOutputSources(null);
    setSelectedText("");
    setRenderedWordCount(0);
    setToolInputSelectedText("");
    setToolInputSelectionRange(null);
    setToolInputMarkdownRange(null);
    setToolInputContentHash(null);
    toolSelectionSnapshotRef.current = null;
    clearLockedHighlight();
    lockedRangeRef.current = null;
    selectionLockedRef.current = false;
    setSelectionLocked(false);
    setPendingHighlightRestore(false);
    window.getSelection()?.removeAllRanges();

    // Restore the last completed tool output for this draft if one was persisted.
    if (activeDraftId) {
      const saved = loadToolState(activeDraftId);
      if (saved) {
        setToolOutput(saved.toolOutput);
        setActiveTool(saved.activeTool);
        setToolOutputHeadingTarget(saved.toolOutputHeadingTarget);
        setToolInputSelectedText(saved.toolInputSelectedText);
        setToolInputSelectionRange(saved.toolInputSelectionRange);
        setToolInputMarkdownRange(saved.toolInputMarkdownRange ?? null);
        setToolInputContentHash(saved.toolInputContentHash ?? null);
        setToolOutputSources(saved.toolOutputSources ?? null);
        if (
          saved.toolInputSelectedText &&
          saved.toolInputMarkdownRange &&
          saved.toolInputContentHash
        ) {
          toolSelectionSnapshotRef.current = {
            selectedText: saved.toolInputSelectedText,
            start: saved.toolInputMarkdownRange[0],
            end: saved.toolInputMarkdownRange[1],
            baseContent: "",
            contentHash: saved.toolInputContentHash,
          };
        }
        if (saved.toolInputSelectedText) {
          // The CSS highlight requires a live DOM Range and cannot survive a page
          // refresh. Signal the restore effect to re-apply it once the draft DOM
          // is ready. selectionLockedRef is set here too so event handlers that
          // fire before the next render see the correct lock state.
          selectionLockedRef.current = true;
          setSelectionLocked(true);
          setPendingHighlightRestore(true);
        }
      }
    }
  }, [activeDraftId]);

  // Keep the ref in sync. useLayoutEffect runs synchronously after DOM mutations,
  // before the browser can fire events — eliminates the gap that useEffect leaves.
  useLayoutEffect(() => { toolStreamingRef.current = toolStreaming; }, [toolStreaming]);

  // Persist completed tool output to sessionStorage so it survives a page refresh.
  // Only writes when streaming is finished to avoid saving partial/incomplete output.
  useEffect(() => {
    if (!activeDraftId || toolStreaming) return;
    if (toolOutput) {
      saveToolState(activeDraftId, {
        toolOutput,
        activeTool,
        toolOutputHeadingTarget,
        toolInputSelectedText,
        toolInputSelectionRange,
        toolInputMarkdownRange,
        toolInputContentHash,
        toolOutputSources,
      });
    } else {
      clearToolState(activeDraftId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolOutput, toolStreaming, activeDraftId]);

  // Sync rendered HTML when draft content changes externally (load, undo, apply, append).
  useEffect(() => {
    const el = contentEditorRef.current;
    if (!el || activeDraftLoading) return;
    const content = activeDraftContent ?? "";
    if (contentSyncSkipRef.current === content) {
      contentSyncSkipRef.current = null;
      return;
    }
    el.innerHTML = renderEditableDraftHtml(content, editorSourceLabelBySeq);
    setRenderedWordCount(countWords(el.textContent ?? ""));

    const snap = toolSelectionSnapshotRef.current;
    if (snap && !snap.baseContent && content) {
      toolSelectionSnapshotRef.current = { ...snap, baseContent: content };
    }
  }, [activeDraftId, activeDraftContent, activeDraftLoading, editorSourceLabelBySeq]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadOpen(false);
      }
      const target = e.target as HTMLElement;
      if (!target.closest("[data-draft-menu-root]")) setDraftMenuOpenId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Track browser text selection within the editable draft content area.
  // While streaming OR while a selection is locked, accidental click-away events
  // are suppressed so the selection indicator and CSS highlight stay visible.
  useEffect(() => {
    function handleSelChange() {
      const sel = window.getSelection();
      const isLocked = selectionLockedRef.current;

      if (!sel || sel.isCollapsed || !contentEditorRef.current) {
        // Collapsed/empty selection: only clear state if nothing is locked
        if (!isLocked) setSelectedText("");
        return;
      }
      try {
        const range = sel.getRangeAt(0);
        if (contentEditorRef.current.contains(range.commonAncestorContainer)) {
          // Deliberate new selection inside the content area — always accept it.
          // If a locked selection existed, this new one replaces it.
          if (selectionLockedRef.current) {
            clearLockedHighlight();
            lockedRangeRef.current = null;
            selectionLockedRef.current = false;
            setSelectionLocked(false);
          }
          setSelectedText(selectionFragmentToMarkdown(range.cloneContents()));
        } else if (!isLocked) {
          setSelectedText("");
        }
      } catch {
        if (!isLocked) setSelectedText("");
      }
    }
    document.addEventListener("selectionchange", handleSelChange);
    return () => document.removeEventListener("selectionchange", handleSelChange);
  }, []);

  // Keyboard shortcuts scoped to the editable draft content area
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // During streaming Escape is a no-op; outside streaming it intentionally clears
        if (toolStreamingRef.current) return;
        clearLockedHighlight();
        lockedRangeRef.current = null;
        selectionLockedRef.current = false;
        setSelectionLocked(false);
        window.getSelection()?.removeAllRanges();
        setSelectedText("");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        const el = contentEditorRef.current;
        if (!el) return;
        const sel = window.getSelection();
        const hasSelectionInContent =
          sel && !sel.isCollapsed &&
          el.contains(sel.getRangeAt(0).commonAncestorContainer);
        const hasFocusInContent = el.contains(document.activeElement);
        if (hasSelectionInContent || hasFocusInContent) {
          e.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(el);
          sel?.removeAllRanges();
          sel?.addRange(range);
          setSelectedText(el.textContent ?? "");
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedText]);

  // Auto-select default expand preset when popover opens or base word count changes
  useEffect(() => {
    if (!wcExpandOpen) return;
    setWcExpandPreset(baseWordCount + 100);
    setWcExpandCustom("");
    setWcExpandError(null);
  }, [wcExpandOpen, baseWordCount]);

  // Auto-select default shorten preset when popover opens or base word count changes
  useEffect(() => {
    if (!wcShortenOpen) return;
    const defaultPreset = shortenPresets[0] ?? null;
    setWcShortenPreset(defaultPreset);
    setWcShortenCustom("");
    setWcShortenError(null);
  }, [wcShortenOpen, baseWordCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply the CSS locked-selection highlight after a page refresh.
  //
  // Sequence: activeDraftId effect restores state from sessionStorage and sets
  // pendingHighlightRestore=true. This effect re-applies the highlight + lock once
  // the draft DOM is ready after a page refresh.
  useEffect(() => {
    if (!pendingHighlightRestore || activeDraftLoading) return;

    if (!toolInputSelectedText) {
      setPendingHighlightRestore(false);
      return;
    }

    const el = contentEditorRef.current;
    if (!el) return; // DOM not rendered yet — re-fires when activeDraft?.content arrives

    const range = findTextRangeInElement(el, toolInputSelectedText);
    if (range) {
      lockedRangeRef.current = range;
      applyLockedHighlight(range);
      selectionLockedRef.current = true;
      setSelectionLocked(true);
    } else {
      // Draft content changed since the tool ran — the range is no longer valid.
      lockedRangeRef.current = null;
      selectionLockedRef.current = false;
      setSelectionLocked(false);
      setToolInputSelectedText("");
      setToolInputSelectionRange(null);
      setToolInputMarkdownRange(null);
    }

    setPendingHighlightRestore(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHighlightRestore, activeDraftLoading, activeDraft?.content]);

  // Initialize the undo history with the first entry once the draft content is available.
  // Runs when the draft finishes loading (or immediately if content is already present).
  // The guard on historyRef length ensures we only seed it once per draft switch.
  useEffect(() => {
    if (!activeDraftId || activeDraftLoading) return;
    if (historyDraftIdRef.current !== activeDraftId) return;
    if (historyRef.current.length > 0) return; // already seeded
    historyRef.current = [{ content: activeDraftContent ?? "" }];
    historyIdxRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  // activeDraftContent triggers a retry when the draft DOM becomes available.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDraftId, activeDraftLoading, activeDraftContent]);

  // Global keyboard shortcuts for Undo/Redo/Save.
  // Registered once with [] deps; reads live state via stable refs.
  // Skip when focus is in other form controls (Ask AI, word-count inputs).
  useEffect(() => {
    function handleUndoRedoKey(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "z" || e.key === "Z") {
        if (e.shiftKey) {
          e.preventDefault();
          redoFnRef.current();
        } else {
          e.preventDefault();
          undoFnRef.current();
        }
        return;
      }
      if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redoFnRef.current();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        saveDraftFnRef.current();
      }
    }
    document.addEventListener("keydown", handleUndoRedoKey);
    return () => document.removeEventListener("keydown", handleUndoRedoKey);
  }, []);

  // Removes the CSS highlight, clears the locked-selection refs, and resets state.
  // Call this whenever the locked selection should no longer be active.
  function unlockSelection() {
    clearLockedHighlight();
    lockedRangeRef.current = null;
    selectionLockedRef.current = false;
    setSelectionLocked(false);
  }

  // Aborts any running tool stream and resets all tool state without touching draft content.
  function clearAllToolState() {
    toolStreamAbortRef.current?.abort();
    toolStreamAbortRef.current = null;
    setToolStreaming(false);
    clearOutputState();
  }

  function syncHistoryButtons() {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }

  function pushHistory(entry: HistoryEntry) {
    // Truncate any redo stack above the current position.
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    // Skip duplicate consecutive entries (e.g., rapid re-renders with the same content).
    const last = historyRef.current[historyRef.current.length - 1];
    if (last && last.content === entry.content) return;
    historyRef.current.push(entry);
    historyIdxRef.current = historyRef.current.length - 1;
    syncHistoryButtons();
  }

  function flushHistoryDebounce() {
    if (historyDebounceRef.current !== null) {
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
    }
  }

  /** Read the latest markdown from the contenteditable DOM (source of truth while editing). */
  function getCurrentEditorMarkdown(): string {
    const el = contentEditorRef.current;
    return el ? editableDomToMarkdown(el) : (activeDraft?.content ?? "");
  }

  /** Sync editor DOM → draft state so Apply uses the same markdown string as the visible editor. */
  function syncEditorMarkdownToDraftState(): string {
    const md = getCurrentEditorMarkdown();
    if (activeDraftId) {
      contentSyncSkipRef.current = md;
      setDrafts((prev) =>
        prev.map((d) => (d.id === activeDraftId ? { ...d, content: md } : d))
      );
    }
    return md;
  }

  function captureSelectionAtToolRun(selAtRun: string) {
    const editor = contentEditorRef.current;
    const domRange = lockedRangeRef.current;
    // Keep original API markdown before DOM round-trip overwrites it.
    const originalState = activeDraft?.content ?? "";
    const fromDom = getCurrentEditorMarkdown();

    const bases = [originalState, fromDom].filter(
      (s, i, arr) => s.length > 0 && arr.indexOf(s) === i
    );

    let snap: ToolSelectionSnapshot | null = null;
    for (const base of bases) {
      const attempt = computeToolSelectionSnapshot(base, selAtRun, editor, domRange);
      if (attempt && attempt.start >= 0 && attempt.end > attempt.start) {
        snap = attempt;
        break;
      }
      if (!snap) snap = attempt;
    }

    toolSelectionSnapshotRef.current = snap;
    if (snap && snap.start >= 0 && snap.end > snap.start) {
      setToolInputMarkdownRange([snap.start, snap.end]);
      setToolInputContentHash(snap.contentHash);
    } else {
      setToolInputMarkdownRange(null);
      setToolInputContentHash(snap?.contentHash ?? hashDraftContent(fromDom));
    }
  }

  /** Last-resort Apply: replace locked/visible text directly in the editor DOM. */
  function applyOutputViaDomRange(preparedOutput: string): boolean {
    const el = contentEditorRef.current;
    const sel = toolInputSelectedText.trim();
    if (!el || !sel) return false;

    let range: Range | null = null;
    try {
      if (
        lockedRangeRef.current &&
        el.contains(lockedRangeRef.current.commonAncestorContainer)
      ) {
        range = lockedRangeRef.current.cloneRange();
      }
    } catch {
      range = null;
    }

    if (!range) {
      range = findTextRangeInElement(el, sel);
    }
    if (!range) {
      range = findRangeFromPlainTextInElement(el, sel);
    }
    if (!range) return false;

    try {
      const html = renderEditableDraftHtml(
        sanitizeCitationMarkdown(preparedOutput, editorSourceLabelBySeq),
        editorSourceLabelBySeq
      );
      insertToolOutputHtmlAtRange(range, html);
      commitDraftContent(getCurrentEditorMarkdown(), true);
      return true;
    } catch {
      return false;
    }
  }

  /** Push draft state + refresh the visible editor immediately (Apply/Append/undo). */
  function commitDraftContent(newContent: string, pushNow = false) {
    if (!activeDraftId) return;
    contentSyncSkipRef.current = null;

    if (pushNow) {
      flushHistoryDebounce();
      const currentFromDom = getCurrentEditorMarkdown();
      const top = historyRef.current[historyIdxRef.current];
      if (!top || top.content !== currentFromDom) {
        pushHistory({ content: currentFromDom });
      }
      const last = historyRef.current[historyRef.current.length - 1];
      if (!last || last.content !== newContent) {
        pushHistory({ content: newContent });
      }
      syncHistoryButtons();
    }

    setDrafts((prev) =>
      prev.map((d) => (d.id === activeDraftId ? { ...d, content: newContent } : d))
    );

    const el = contentEditorRef.current;
    if (el) {
      el.innerHTML = renderEditableDraftHtml(newContent, editorSourceLabelBySeq);
      setRenderedWordCount(countWords(el.textContent ?? ""));
    }
  }

  // Cancel any pending debounce and push the current draft content to history
  // if it differs from the top entry. Call this before any navigation (undo/redo)
  // or before an explicit content replacement (Apply/Append) so no typing is lost.
  function snapshotCurrentContent() {
    flushHistoryDebounce();
    const currentContent = getCurrentEditorMarkdown();
    const top = historyRef.current[historyIdxRef.current];
    if (!top || top.content === currentContent) return;
    pushHistory({ content: currentContent });
  }

  function handleEditorInput() {
    const el = contentEditorRef.current;
    if (!el || !activeDraftId) return;
    const markdown = editableDomToMarkdown(el);
    contentSyncSkipRef.current = markdown;
    handleDraftContentChange(markdown);
    if (!selectionLockedRef.current) setSelectedText("");
    setRenderedWordCount(countWords(el.textContent ?? ""));
    const val = markdown;
    flushHistoryDebounce();
    historyDebounceRef.current = setTimeout(() => {
      historyDebounceRef.current = null;
      pushHistory({ content: val });
    }, 500);
  }

  function handleEditorBlur() {
    if (historyDebounceRef.current !== null) {
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
      const el = contentEditorRef.current;
      if (el) {
        pushHistory({ content: editableDomToMarkdown(el) });
      }
    }
  }

  function handleDraftContentChange(content: string, pushNow = false) {
    if (!activeDraftId) return;
    if (pushNow) {
      commitDraftContent(content, true);
      return;
    }
    setDrafts((prev) =>
      prev.map((d) => (d.id === activeDraftId ? { ...d, content } : d))
    );
  }

  function undo() {
    if (!activeDraftId) return;
    // Flush the debounce and capture any in-progress typing as a history entry so
    // the user can redo back to this exact state after undoing.
    snapshotCurrentContent();
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const entry = historyRef.current[historyIdxRef.current];
    if (!entry) return;
    setDrafts((prev) =>
      prev.map((d) => (d.id === activeDraftId ? { ...d, content: entry.content } : d))
    );
    syncHistoryButtons();
  }

  function redo() {
    if (!activeDraftId) return;
    // Cancel any pending debounce without snapshotting — we're going forward,
    // so in-progress edits since the last checkpoint are intentionally discarded.
    flushHistoryDebounce();
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    const entry = historyRef.current[historyIdxRef.current];
    if (!entry) return;
    setDrafts((prev) =>
      prev.map((d) => (d.id === activeDraftId ? { ...d, content: entry.content } : d))
    );
    syncHistoryButtons();
  }

  function getToolInputText(): string {
    const selection = selectedText.trim();
    if (selection) return selection;
    return activeDraft?.content?.trim() ?? "";
  }

  async function handleRunTool(toolId: string, targetWords?: number) {
    if (!activeDraft || !activeDraftId) {
      toast.error("Select a draft first.");
      return;
    }
    if (!isPersistedDraftId(activeDraftId)) {
      toast.error("This draft is not saved on the server yet. Upload or save from chat first.");
      return;
    }

    const apiTool = uiToolIdToApiTool(toolId);
    if (!apiTool) return;

    const text = getToolInputText();
    if (!text) {
      toast.info("Add draft content or select text to run a tool.");
      return;
    }

    const selAtRun = selectedText.trim();
    setToolInputSelectedText(selAtRun);

    // Lock selection visually first, then capture stable markdown offsets (not live DOM).
    if (selAtRun) {
      clearLockedHighlight();
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && contentEditorRef.current) {
        try {
          const range = sel.getRangeAt(0);
          if (contentEditorRef.current.contains(range.commonAncestorContainer)) {
            lockedRangeRef.current = range.cloneRange();
            applyLockedHighlight(lockedRangeRef.current);
          }
        } catch { /* ignore */ }
      }
      if (!lockedRangeRef.current && contentEditorRef.current) {
        const domRange = findTextRangeInElement(contentEditorRef.current, selAtRun);
        if (domRange) {
          lockedRangeRef.current = domRange;
          applyLockedHighlight(domRange);
        }
      }
      selectionLockedRef.current = true;
      setSelectionLocked(true);
      captureSelectionAtToolRun(selAtRun);
    } else {
      setToolInputSelectionRange(null);
      setToolInputMarkdownRange(null);
      setToolInputContentHash(null);
      toolSelectionSnapshotRef.current = null;
    }

    toolStreamAbortRef.current?.abort();
    const ac = new AbortController();
    toolStreamAbortRef.current = ac;

    setActiveTool(toolId);
    setToolStreaming(true);
    setToolOutput("");
    setToolOutputSources(null);
    setToolOutputHeadingTarget(
      detectMinHeadingLevel(
        selectedText.trim() ? selectedText : activeDraft.content
      )
    );
    setWcExpandOpen(false);
    setWcShortenOpen(false);

    try {
      await streamBidToolRun(
        {
          tool: apiTool,
          text,
          draft_id: activeDraftId,
          ...((apiTool === "expand" || apiTool === "shorten") &&
          typeof targetWords === "number" &&
          Number.isFinite(targetWords)
            ? { target_words: targetWords }
            : {}),
        },
        {
          onToken: (token) => {
            setToolOutput((prev) => `${prev ?? ""}${token}`);
          },
          onDone: (payload) => {
            if (payload?.content?.trim()) {
              setToolOutput(payload.content);
            }
            setToolStreaming(false);
          },
          onError: (message) => {
            throw new Error(message);
          },
        },
        { signal: ac.signal }
      );
      setToolStreaming(false);
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        return;
      }
      console.error("[MyDraftsEditor] Tool stream failed:", err);
      setToolOutput(null);
      setToolStreaming(false);
      const msg = err instanceof Error && err.message.trim() ? err.message.trim() : "Tool failed";
      toast.error(msg);
    } finally {
      if (toolStreamAbortRef.current === ac) {
        toolStreamAbortRef.current = null;
      }
    }
  }

  function handleToolClick(toolId: string) {
    if (!activeDraft || toolStreaming) return;
    if (toolId === "expand") {
      setWcExpandOpen((o) => !o);
      setWcShortenOpen(false);
      return;
    }
    if (toolId === "shorten") {
      setWcShortenOpen((o) => !o);
      setWcExpandOpen(false);
      return;
    }
    handleRunTool(toolId);
  }

  function runExpandWithWc() {
    const n = wcExpandCustom.trim() !== "" ? parseInt(wcExpandCustom, 10) : wcExpandPreset;
    if (!n || Number.isNaN(n)) {
      setWcExpandError("Pick a target word count.");
      return;
    }
    if (n <= baseWordCount) {
      setWcExpandError(`Must be greater than ${baseWordCount} (current word count).`);
      return;
    }
    setWcExpandError(null);
    void handleRunTool("expand", n);
  }

  function runShortenWithWc() {
    const n = wcShortenCustom.trim() !== "" ? parseInt(wcShortenCustom, 10) : wcShortenPreset;
    if (!n || Number.isNaN(n)) {
      setWcShortenError("Pick a target word count.");
      return;
    }
    if (n >= baseWordCount) {
      setWcShortenError(`Must be less than ${baseWordCount} (current word count).`);
      return;
    }
    setWcShortenError(null);
    void handleRunTool("shorten", n);
  }

  async function handleCopy() {
    if (!activeDraft?.content) return;
    try {
      await navigator.clipboard.writeText(activeDraft.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  async function copyOutput() {
    if (!toolOutput) return;
    try {
      await navigator.clipboard.writeText(toolOutput);
      toast.success("Output copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  function clearOutputState() {
    unlockSelection();
    setPendingHighlightRestore(false);
    setToolOutput(null);
    setActiveTool(null);
    setToolOutputSources(null);
    setToolInputSelectedText("");
    setToolInputSelectionRange(null);
    setToolInputMarkdownRange(null);
    setToolInputContentHash(null);
    toolSelectionSnapshotRef.current = null;
    setSelectedText("");
    window.getSelection()?.removeAllRanges();
  }

  function applyOutput() {
    if (!toolOutput || !activeDraftId || !activeDraft) return;
    flushHistoryDebounce();

    const preparedOutput = prepareAppliedToolOutput(
      toolOutput,
      toolOutputHeadingTarget,
      editorSourceLabelBySeq
    );
    const sel = toolInputSelectedText.trim();

    if (sel) {
      const snap = toolSelectionSnapshotRef.current;
      const fromDom = getCurrentEditorMarkdown();
      const bases = [
        snap?.baseContent,
        fromDom,
        activeDraft.content,
      ].filter((s): s is string => Boolean(s && s.length > 0));
      const uniqueBases = bases.filter((s, i, arr) => arr.indexOf(s) === i);

      let range: [number, number] | null = null;
      let markdownForSplice = fromDom;

      for (const base of uniqueBases) {
        const found = resolveApplyRange(base, snap, sel);
        if (found) {
          range = found;
          markdownForSplice =
            base === fromDom || hashDraftContent(base) === hashDraftContent(fromDom)
              ? fromDom
              : base;
          break;
        }
      }

      if (
        !range &&
        snap &&
        snap.start >= 0 &&
        snap.end > snap.start &&
        snap.end <= snap.baseContent.length
      ) {
        range = [snap.start, snap.end];
        markdownForSplice = snap.baseContent;
        if (markdownForSplice !== fromDom) {
          const mapped = findSelectionInMarkdown(fromDom, sel, snap.start);
          if (mapped) {
            range = mapped;
            markdownForSplice = fromDom;
          }
        }
      }

      if (range && range[0] >= 0 && range[1] > range[0]) {
        const contentToSplice =
          markdownForSplice === fromDom ? fromDom : getCurrentEditorMarkdown();
        const end = Math.min(range[1], contentToSplice.length);
        const start = Math.min(range[0], end);
        commitDraftContent(
          spliceMarkdownWithSelection(contentToSplice, start, end, preparedOutput),
          true
        );
        clearOutputState();
        toast.success("Applied to selection");
        return;
      }

      if (applyOutputViaDomRange(preparedOutput)) {
        clearOutputState();
        toast.success("Applied to selection");
        return;
      }

      toast.error(
        "Could not locate the selected range in the draft. Re-select the text and run the tool again."
      );
      return;
    }

    commitDraftContent(preparedOutput, true);
    clearOutputState();
    toast.success("Applied to draft");
  }

  function appendOutput() {
    if (!toolOutput || !activeDraftId || !activeDraft) return;
    flushHistoryDebounce();

    const labelMap = editorSourceLabelBySeq;
    const base = sanitizeCitationMarkdown(getCurrentEditorMarkdown(), labelMap).trimEnd();
    const appended = prepareAppliedToolOutput(
      toolOutput,
      toolOutputHeadingTarget,
      labelMap
    );
    const newContent = normalizeAppliedMarkdown(
      sanitizeCitationMarkdown(
        base ? `${base}\n\n${appended}` : appended,
        labelMap
      )
    );

    commitDraftContent(newContent, true);

    if (toolOutputSources && Object.keys(toolOutputSources).length > 0) {
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === activeDraftId
            ? { ...d, sources: { ...(d.sources ?? {}), ...toolOutputSources } }
            : d
        )
      );
    }

    clearOutputState();
    toast.success("Appended to draft");

    requestAnimationFrame(() => {
      const el = contentEditorRef.current;
      if (!el) return;
      el.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  async function sendAskAi() {
    const question = askAiInput.trim();
    if (!question || toolStreaming) return;
    if (!activeDraft || !activeDraftId) {
      toast.error("Select a draft first.");
      return;
    }
    if (!isPersistedDraftId(activeDraftId)) {
      toast.error("This draft is not saved on the server yet. Upload or save from chat first.");
      return;
    }

    const selAtRun = selectedText.trim();
    setToolInputSelectedText(selAtRun);
    if (selAtRun) {
      clearLockedHighlight();
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && contentEditorRef.current) {
        try {
          const range = sel.getRangeAt(0);
          if (contentEditorRef.current.contains(range.commonAncestorContainer)) {
            lockedRangeRef.current = range.cloneRange();
            applyLockedHighlight(lockedRangeRef.current);
          }
        } catch { /* ignore */ }
      }
      if (!lockedRangeRef.current && contentEditorRef.current) {
        const domRange = findTextRangeInElement(contentEditorRef.current, selAtRun);
        if (domRange) {
          lockedRangeRef.current = domRange;
          applyLockedHighlight(domRange);
        }
      }
      selectionLockedRef.current = true;
      setSelectionLocked(true);
      captureSelectionAtToolRun(selAtRun);
    } else {
      setToolInputSelectionRange(null);
      setToolInputMarkdownRange(null);
      setToolInputContentHash(null);
      toolSelectionSnapshotRef.current = null;
    }

    toolStreamAbortRef.current?.abort();
    const ac = new AbortController();
    toolStreamAbortRef.current = ac;

    setActiveTool("askAi");
    setToolStreaming(true);
    setToolOutput("");
    setToolOutputSources(null);
    setToolOutputHeadingTarget(
      detectMinHeadingLevel(selAtRun ? selectedText : activeDraft.content)
    );
    setAskAiInput("");
    setAskAiOpen(false);
    setWcExpandOpen(false);
    setWcShortenOpen(false);

    try {
      await streamBidDraftAsk(
        {
          question,
          draft_id: activeDraftId,
          ...(selAtRun ? { selected_text: selAtRun } : {}),
        },
        {
          onAnswerToken: (token) => {
            setToolOutput((prev) => `${prev ?? ""}${token}`);
          },
          onDone: ({ sources }) => {
            const rec = sourcesRecordFromUnknown(sources);
            if (rec) setToolOutputSources(rec);
            setToolStreaming(false);
          },
          onError: (message) => {
            throw new Error(message);
          },
        },
        { signal: ac.signal }
      );
      setToolStreaming(false);
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        return;
      }
      console.error("[MyDraftsEditor] Ask AI stream failed:", err);
      setToolOutput(null);
      setToolOutputSources(null);
      setToolStreaming(false);
      const msg =
        err instanceof Error && err.message.trim() ? err.message.trim() : "Ask AI failed";
      toast.error(msg);
    } finally {
      if (toolStreamAbortRef.current === ac) {
        toolStreamAbortRef.current = null;
      }
    }
  }

  async function downloadAs(kind: BidExportFormat) {
    if (!activeDraftId || !isPersistedDraftId(activeDraftId)) {
      toast.error("Save or upload this draft before exporting.");
      return;
    }
    if (exportingFormat) return;

    setExportingFormat(kind);
    try {
      const { blob, filename } = await exportBidDraft(
        { draft_id: activeDraftId, format: kind },
        { title: activeDraft?.title }
      );
      triggerBidExportDownload(blob, filename);
      setDownloadOpen(false);
      toast.success(`Download started (${kind.toUpperCase()})`);
    } catch (err) {
      console.error("[MyDraftsEditor] Export failed:", err);
      toast.error(await messageFromBidExportError(err));
    } finally {
      setExportingFormat(null);
    }
  }

  async function handleSaveDraft() {
    if (!activeDraftId || !activeDraft) return;
    if (!isPersistedDraftId(activeDraftId)) {
      toast.error("This draft is not saved on the server yet. Upload or save from chat first.");
      return;
    }
    if (isSaving) return;
    setIsSaving(true);
    try {
      const updated = await updateBidDraft(activeDraftId, activeDraft.content);
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === activeDraftId
            ? {
                ...d,
                title: updated.title,
                content: updated.content,
                createdAt: draftListDateLabel(updated.created_at, updated.updated_at),
              }
            : d
        )
      );
      toast.success("Draft saved");
    } catch (err) {
      console.error("[MyDraftsEditor] Save draft failed:", err);
      const msg = err instanceof Error && err.message.trim() ? err.message.trim() : "Could not save draft";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }

  // Update refs each render so the keyboard effect always calls the latest undo/redo/save.
  undoFnRef.current = undo;
  redoFnRef.current = redo;
  saveDraftFnRef.current = () => { void handleSaveDraft(); };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* CSS Custom Highlight for locked selection — persists after browser focus moves */}
      <style>{`
        ::highlight(atai-locked-selection) {
          background-color: rgb(139 92 246 / 0.22);
          color: inherit;
        }
        .atai-citation-ref {
          position: relative;
          display: inline;
          vertical-align: baseline;
          margin: 0 0.125em;
        }
        .atai-citation-badge {
          display: inline-flex;
          cursor: help;
          align-items: center;
          border-radius: 0.375rem;
          padding: 0.125rem 0.375rem;
          font-size: 0.78em;
          font-weight: 600;
          line-height: 1;
          background-color: rgb(139 92 246 / 0.1);
          color: rgb(124 58 237);
          box-shadow: 0 0 0 1px rgb(139 92 246 / 0.2);
          transition: background-color 150ms, box-shadow 150ms;
        }
        .atai-citation-ref:hover .atai-citation-badge,
        .atai-citation-ref:focus-within .atai-citation-badge {
          background-color: rgb(139 92 246 / 0.2);
          box-shadow: 0 0 0 1px rgb(139 92 246 / 0.4);
        }
        .atai-citation-tooltip {
          pointer-events: none;
          position: absolute;
          visibility: hidden;
          top: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          width: max-content;
          max-width: min(20rem, calc(100vw - 2rem));
          border-radius: 0.5rem;
          border: 1px solid rgb(139 92 246 / 0.2);
          background: hsl(var(--popover, 0 0% 100%));
          color: hsl(var(--popover-foreground, 0 0% 9%));
          padding: 0.5rem 0.75rem;
          font-size: 11px;
          font-weight: 500;
          line-height: 1.375;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
          opacity: 0;
          transition: opacity 150ms;
          white-space: pre-line;
          text-align: left;
        }
        .atai-citation-ref:hover .atai-citation-tooltip,
        .atai-citation-ref:focus-within .atai-citation-tooltip {
          visibility: visible;
          opacity: 1;
        }
        .atai-citation-tooltip-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgb(124 58 237);
          margin-bottom: 0.125rem;
        }
      `}</style>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
          editorSidebarOpen ? "opacity-100" : "pointer-events-none invisible opacity-0"
        )}
        onClick={() => setEditorSidebarOpen(false)}
        aria-hidden
      />

      <aside
        className={cn(
          "flex shrink-0 select-none flex-col border-r border-border bg-card",
          "fixed inset-y-0 left-0 z-50 w-60 shadow-xl",
          editorSidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:inset-auto lg:z-auto lg:shadow-none lg:translate-x-0",
          "transition-[transform,width,opacity] duration-300 ease-in-out",
          editorSidebarOpen ? "lg:w-60 lg:opacity-100" : "lg:w-0 lg:overflow-hidden lg:opacity-0"
        )}
        aria-label="My drafts"
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-4.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
            <FileText className="h-4 w-4 text-primary-foreground" aria-hidden />
          </div>
          <span className="whitespace-nowrap text-sm font-semibold text-foreground">
            AutoTender AI
          </span>
        </div>

        <Link
          href="/my-drafts/chat"
          prefetch
          className="flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to Chat
        </Link>

        <div className="border-b border-border p-3">
          <input
            ref={uploadDraftRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onUploadDraft?.(file);
            }}
          />
          <button
            type="button"
            disabled={draftUploading || draftsLoading}
            onClick={() => uploadDraftRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {draftUploading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
            ) : (
              <Upload className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            {draftUploading ? "Uploading…" : "Upload Existing Draft"}
          </button>

        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-1 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              My Drafts
            </p>
            {!draftsLoading && !draftsError && draftsTotal > 0 && (
              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                {draftsTotal}
              </span>
            )}
          </div>

          {draftsLoading ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">Loading drafts…</div>
          ) : draftsError ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Could not load drafts. Check your connection and try again.
            </p>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No saved drafts yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Save from chat or upload a document.
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5 px-2 pb-4 pt-1" role="list">
              {drafts.map((draft) => {
                const isActive = activeDraftId === draft.id;
                const isDeleting = deletingDraftId === draft.id;
                return (
                  <li key={draft.id} className="group relative flex items-stretch">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDraft(draft.id);
                        setToolOutput(null);
                        setActiveTool(null);
                        setToolOutputSources(null);
                        setDraftMenuOpenId(null);
                      }}
                      className={cn(
                        "min-w-0 flex-1 rounded-l-lg px-3 py-2.5 text-left transition-colors",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "text-foreground hover:bg-muted"
                      )}
                      aria-current={isActive ? "true" : undefined}
                    >
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          isActive ? "text-primary" : "text-foreground"
                        )}
                      >
                        {draft.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{draft.createdAt}</p>
                    </button>
                    <div
                      className="relative flex shrink-0 items-start py-1 pr-1"
                      data-draft-menu-root
                    >
                      <button
                        type="button"
                        aria-label="Draft actions"
                        aria-expanded={draftMenuOpenId === draft.id}
                        aria-haspopup="menu"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftMenuOpenId((v) => (v === draft.id ? null : draft.id));
                        }}
                        className={cn(
                          "rounded-md p-1.5 transition-opacity hover:bg-muted hover:text-foreground",
                          isActive ? "text-primary/70" : "text-muted-foreground",
                          "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                          draftMenuOpenId === draft.id && "opacity-100"
                        )}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                      {draftMenuOpenId === draft.id && (
                        <div
                          className="absolute right-0 top-full z-30 mt-0.5 min-w-[9.5rem] rounded-lg border border-border bg-popover py-1 shadow-md"
                          role="menu"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            disabled={deletingDraftId !== null}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => {
                              setDraftMenuOpenId(null);
                              onDeleteDraft?.({ id: draft.id, title: draft.title });
                            }}
                          >
                            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 select-none flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditorSidebarOpen((v) => !v)}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={editorSidebarOpen ? "Collapse drafts panel" : "Expand drafts panel"}
            >
              <Menu className="h-4 w-4" aria-hidden />
            </button>
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate text-sm font-medium text-foreground">
              {activeDraft ? activeDraft.title : "Select a draft from the sidebar"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeDraft && toolOutput && !toolStreaming && (
              <button
                type="button"
                onClick={applyOutput}
                className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Apply to Draft
              </button>
            )}
            {activeDraft && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {copied ? "Copied!" : "Copy"}
              </button>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-stretch overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden border-r border-border">
            <div className="shrink-0 select-none overflow-visible border-b border-border bg-background">
              <div className="min-w-0 overflow-visible px-4 py-3 sm:px-6">
                <div className="flex flex-col gap-2.5">
                  {/* Row 1: label left, utilities right (reference) */}
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Draft Document
                    </span>
                    {activeDraft && (
                      <div className="flex min-w-0 flex-1 justify-end">
                        <div className="inline-flex max-w-full items-center gap-0.5 overflow-visible rounded-xl border border-border/60 bg-muted/60 p-1 dark:bg-muted/40">
                        <EditorToolbarTooltip label="Undo" shortcut="Ctrl+Z">
                          <button
                            type="button"
                            disabled={!canUndo}
                            onClick={undo}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Undo"
                          >
                            <Undo2 className="h-4 w-4" aria-hidden />
                          </button>
                        </EditorToolbarTooltip>
                        <EditorToolbarTooltip label="Redo" shortcut="Ctrl+Y">
                          <button
                            type="button"
                            disabled={!canRedo}
                            onClick={redo}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Redo"
                          >
                            <Redo2 className="h-4 w-4" aria-hidden />
                          </button>
                        </EditorToolbarTooltip>
                        <EditorToolbarTooltip label="Save draft" shortcut="Ctrl+S">
                          <button
                            type="button"
                            disabled={isSaving}
                            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => void handleSaveDraft()}
                            aria-label="Save"
                            aria-busy={isSaving}
                          >
                            {isSaving ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                            ) : (
                              <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            )}
                            {isSaving ? "Saving…" : "Save"}
                          </button>
                        </EditorToolbarTooltip>
                        <div className="relative shrink-0" ref={downloadRef}>
                          <EditorToolbarTooltip label="Export draft">
                            <button
                              type="button"
                              onClick={() => setDownloadOpen((o) => !o)}
                              disabled={exportingFormat !== null}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Export draft"
                              aria-expanded={downloadOpen}
                              aria-busy={exportingFormat !== null}
                            >
                              {exportingFormat ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <Download className="h-4 w-4" aria-hidden />
                              )}
                            </button>
                          </EditorToolbarTooltip>
                          {downloadOpen && (
                            <div className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-lg border border-border bg-popover py-1 shadow-md">
                              {(
                                [
                                  { label: "PDF", kind: "pdf" as const, iconCn: "text-red-500", bgCn: "bg-red-50 dark:bg-red-950/50" },
                                  { label: "Word (.docx)", kind: "docx" as const, iconCn: "text-blue-500", bgCn: "bg-blue-50 dark:bg-blue-950/50" },
                                  { label: "Plain Text", kind: "txt" as const, iconCn: "text-muted-foreground", bgCn: "bg-muted" },
                                ] as const
                              ).map(({ label, kind, iconCn, bgCn }) => (
                                <button
                                  key={kind}
                                  type="button"
                                  disabled={exportingFormat !== null}
                                  className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                                  onClick={() => void downloadAs(kind)}
                                >
                                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", bgCn)}>
                                    {exportingFormat === kind ? (
                                      <Loader2 className={cn("h-3.5 w-3.5 animate-spin", iconCn)} aria-hidden />
                                    ) : (
                                      <ArrowDownToLine className={cn("h-3.5 w-3.5", iconCn)} aria-hidden />
                                    )}
                                  </span>
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {activeDraft && (
                    <div className="min-w-0 rounded-2xl border border-border/50 bg-muted/50 p-2 shadow-sm dark:bg-muted/30">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
                        <div className="flex shrink-0 items-center sm:pr-3">
                          <button
                            type="button"
                            disabled={toolStreaming}
                            onClick={() => setAskAiOpen((v) => !v)}
                            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-expanded={askAiOpen}
                          >
                            <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
                            Ask AI
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 opacity-90 transition-transform",
                                askAiOpen && "rotate-180"
                              )}
                            />
                          </button>
                        </div>
                        <div
                          className="hidden h-8 w-px shrink-0 bg-border/70 sm:block"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1 sm:border-l sm:border-border/40 sm:pl-3">
                          <div className="flex min-w-0 flex-wrap content-start items-center gap-x-1.5 gap-y-1.5">
                            {TOOLS.map((tool) => (
                              <div key={tool.id} className="relative shrink-0">
                                <button
                                  type="button"
                                  disabled={toolStreaming}
                                  onClick={() => handleToolClick(tool.id)}
                                  className={cn(
                                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                                    "text-muted-foreground hover:bg-background/90 hover:text-foreground",
                                    "disabled:cursor-not-allowed disabled:opacity-50",
                                    activeTool === tool.id &&
                                      "bg-background font-semibold text-primary shadow-sm ring-1 ring-border/60 dark:bg-background/80"
                                  )}
                                >
                                  <tool.icon
                                    className={cn(
                                      "h-3.5 w-3.5 shrink-0",
                                      activeTool === tool.id ? "text-primary" : "text-muted-foreground"
                                    )}
                                    aria-hidden
                                  />
                                  <span className="whitespace-nowrap">{tool.label}</span>
                                </button>

                                {tool.id === "expand" && wcExpandOpen && (
                                  <div className="absolute left-0 top-full z-40 mt-1 w-56 rounded-lg border border-border bg-popover p-2.5 shadow-md">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Target word count
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                                      Base: <span className="font-medium text-foreground">{baseWordCount}</span> word{baseWordCount !== 1 ? "s" : ""}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {expandPresets.map((n) => (
                                        <button
                                          key={n}
                                          type="button"
                                          onClick={() => {
                                            setWcExpandPreset(n);
                                            setWcExpandCustom("");
                                            setWcExpandError(null);
                                          }}
                                          className={cn(
                                            "rounded px-2 py-0.5 text-xs",
                                            wcExpandPreset === n && wcExpandCustom === ""
                                              ? "bg-primary text-primary-foreground"
                                              : "bg-background text-muted-foreground hover:bg-muted"
                                          )}
                                        >
                                          {n}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="mt-2 flex gap-1">
                                      <input
                                        type="number"
                                        min={baseWordCount + 1}
                                        placeholder="Custom…"
                                        value={wcExpandCustom}
                                        onChange={(e) => {
                                          setWcExpandCustom(e.target.value);
                                          setWcExpandPreset(null);
                                          setWcExpandError(null);
                                        }}
                                        className={cn(
                                          "min-w-0 flex-1 rounded border bg-background px-2 py-1 text-xs",
                                          wcExpandError ? "border-destructive" : "border-border"
                                        )}
                                      />
                                      <button
                                        type="button"
                                        onClick={runExpandWithWc}
                                        disabled={toolStreaming}
                                        className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                                      >
                                        Run
                                      </button>
                                    </div>
                                    {wcExpandError && (
                                      <p className="mt-1.5 text-[10px] leading-snug text-destructive">{wcExpandError}</p>
                                    )}
                                  </div>
                                )}

                                {tool.id === "shorten" && wcShortenOpen && (
                                  <div className="absolute left-0 top-full z-40 mt-1 w-56 rounded-lg border border-border bg-popover p-2.5 shadow-md">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Target word count
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                                      Base: <span className="font-medium text-foreground">{baseWordCount}</span> word{baseWordCount !== 1 ? "s" : ""}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {shortenPresets.length > 0 ? shortenPresets.map((n) => (
                                        <button
                                          key={n}
                                          type="button"
                                          onClick={() => {
                                            setWcShortenPreset(n);
                                            setWcShortenCustom("");
                                            setWcShortenError(null);
                                          }}
                                          className={cn(
                                            "rounded px-2 py-0.5 text-xs",
                                            wcShortenPreset === n && wcShortenCustom === ""
                                              ? "bg-primary text-primary-foreground"
                                              : "bg-background text-muted-foreground hover:bg-muted"
                                          )}
                                        >
                                          {n}
                                        </button>
                                      )) : (
                                        <p className="text-[10px] text-muted-foreground">No presets — draft is too short.</p>
                                      )}
                                    </div>
                                    <div className="mt-2 flex gap-1">
                                      <input
                                        type="number"
                                        min={1}
                                        max={Math.max(1, baseWordCount - 1)}
                                        placeholder="Custom…"
                                        value={wcShortenCustom}
                                        onChange={(e) => {
                                          setWcShortenCustom(e.target.value);
                                          setWcShortenPreset(null);
                                          setWcShortenError(null);
                                        }}
                                        className={cn(
                                          "min-w-0 flex-1 rounded border bg-background px-2 py-1 text-xs",
                                          wcShortenError ? "border-destructive" : "border-border"
                                        )}
                                      />
                                      <button
                                        type="button"
                                        onClick={runShortenWithWc}
                                        disabled={toolStreaming}
                                        className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                                      >
                                        Run
                                      </button>
                                    </div>
                                    {wcShortenError && (
                                      <p className="mt-1.5 text-[10px] leading-snug text-destructive">{wcShortenError}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {activeDraft && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <p
                      className={cn(
                        "text-[10px] font-semibold leading-snug tracking-[0.15em]",
                        selectedText.trim() || selectionLocked
                          ? "text-primary/80"
                          : "uppercase text-muted-foreground"
                      )}
                    >
                      {selectedText.trim() || selectionLocked
                        ? `${selectionWordCount || countWords(toolInputSelectedText)} word${(selectionWordCount || countWords(toolInputSelectedText)) !== 1 ? "s" : ""} selected — tool will process selection only`
                        : "Select text then pick a tool"}
                    </p>
                    {selectionLocked && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                        Locked
                      </span>
                    )}
                  </div>
                )}

                {activeDraft && askAiOpen && (
                  <div className="mt-2 w-full max-w-full rounded-lg border border-border bg-background p-3">
                    <textarea
                      value={askAiInput}
                      onChange={(e) => setAskAiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendAskAi();
                        }
                      }}
                      disabled={toolStreaming}
                      placeholder="Ask a question or get suggestions…"
                      rows={3}
                      className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void sendAskAi()}
                        disabled={toolStreaming || !askAiInput.trim()}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Ask
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-background">
              {activeDraftLoading && activeDraftId ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <Loader2
                    className="h-8 w-8 animate-spin text-primary"
                    aria-hidden
                  />
                  <p className="text-sm font-medium text-foreground">Loading draft…</p>
                  <p className="text-xs text-muted-foreground">Fetching document content.</p>
                </div>
              ) : activeDraftLoadError && activeDraftId ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <p className="text-sm font-medium text-foreground">{activeDraftLoadError}</p>
                  {onRetryDraftLoad && (
                    <button
                      type="button"
                      onClick={onRetryDraftLoad}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : activeDraft ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="px-4 py-4 sm:px-6 sm:py-6">
                    <div
                      ref={contentEditorRef}
                      contentEditable
                      suppressContentEditableWarning
                      spellCheck
                      role="textbox"
                      aria-label="Draft content"
                      aria-multiline
                      tabIndex={0}
                      data-placeholder="Start typing your draft here…"
                      className={cn(
                        "markdown-tool-output min-h-[50vh] min-w-0 max-w-full text-sm leading-relaxed text-foreground",
                        "focus:outline-none",
                        "empty:before:pointer-events-none empty:before:block empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
                      )}
                      onInput={handleEditorInput}
                      onBlur={handleEditorBlur}
                      onMouseDown={() => contentEditorRef.current?.focus()}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          if (toolStreamingRef.current) return;
                          clearLockedHighlight();
                          lockedRangeRef.current = null;
                          selectionLockedRef.current = false;
                          setSelectionLocked(false);
                          window.getSelection()?.removeAllRanges();
                          setSelectedText("");
                        }
                      }}
                    />
                    {activeDraft.sources && Object.keys(activeDraft.sources).length > 0 && (
                      <div className="mt-8 border-t border-border pt-6">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Sources
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-foreground">
                          {sortDraftSourceKeys(Object.keys(activeDraft.sources)).map((key) => (
                            <li key={key} className="flex items-start gap-2.5">
                              <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.78em] font-semibold leading-none text-primary ring-1 ring-primary/20">
                                [{key}]
                              </span>
                              <span className="min-w-0 leading-snug text-foreground">{activeDraft.sources![key]}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {activeDraft.web_sources && activeDraft.web_sources.length > 0 && (
                      <div className="mt-8 border-t border-border pt-6">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Web sources
                        </p>
                        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                          {activeDraft.web_sources.map((item, idx) => {
                            const { label, href } = formatWebSourceLine(item);
                            return (
                              <li key={idx} className="break-words pl-1">
                                {href ? (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline-offset-4 hover:underline"
                                  >
                                    {label}
                                  </a>
                                ) : (
                                  <span className="text-foreground">{label}</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
                    <FileText className="h-6 w-6 text-primary" aria-hidden />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-base font-semibold text-foreground">No draft selected</p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      Choose a draft from the left sidebar or upload a file.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="hidden min-h-0 flex-col overflow-hidden lg:flex lg:min-w-0 lg:flex-1 lg:basis-0">
            <ToolOutputHeader
              activeTool={activeTool}
              toolOutput={toolOutput}
              toolStreaming={toolStreaming}
            />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
              <ToolOutputBody
                activeTool={activeTool}
                toolStreaming={toolStreaming}
                toolOutput={toolOutput}
                targetHeadingLevel={toolOutputHeadingTarget}
                sourceLabelBySeq={toolOutputSourceLabelBySeq}
              />
            </div>
            <div className="shrink-0 select-none border-t border-border bg-card/50 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-start gap-2">
                <button
                  type="button"
                  disabled={!toolOutput || toolStreaming}
                  onClick={applyOutput}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Apply to Draft
                </button>
                <button
                  type="button"
                  disabled={!toolOutput || toolStreaming}
                  onClick={appendOutput}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Append to Draft
                </button>
                <button
                  type="button"
                  disabled={!toolOutput || toolStreaming}
                  onClick={() => void copyOutput()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Copy Output
                </button>
                <button
                  type="button"
                  disabled={!toolOutput && !toolStreaming && !selectionLocked}
                  onClick={clearAllToolState}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Clear
                </button>
              </div>
            </div>
            {activeDraft && (selectedText.trim() || selectionLocked) && (
              <div className={cn(
                "shrink-0 select-none border-t border-border px-3 py-2",
                selectionLocked ? "bg-primary/10" : "bg-muted/30"
              )}>
                <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  {selectionWordCount || countWords(toolInputSelectedText)} word{(selectionWordCount || countWords(toolInputSelectedText)) !== 1 ? "s" : ""} selected — Apply will replace this range.
                  {selectionLocked && (
                    <span className="inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                      Locked
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
        {(toolOutput || toolStreaming) && (
          <div className="flex max-h-[40vh] shrink-0 flex-col overflow-hidden border-t border-border lg:hidden">
            <ToolOutputHeader
              activeTool={activeTool}
              toolOutput={toolOutput}
              toolStreaming={toolStreaming}
            />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
              <ToolOutputBody
                activeTool={activeTool}
                toolStreaming={toolStreaming}
                toolOutput={toolOutput}
                contentClassName="px-4 py-4"
                targetHeadingLevel={toolOutputHeadingTarget}
                sourceLabelBySeq={toolOutputSourceLabelBySeq}
              />
            </div>
            <div className="shrink-0 select-none border-t border-border bg-card/50 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!toolOutput || toolStreaming}
                  onClick={applyOutput}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Apply
                </button>
                <button
                  type="button"
                  disabled={!toolOutput || toolStreaming}
                  onClick={appendOutput}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Append
                </button>
                <button
                  type="button"
                  disabled={!toolOutput || toolStreaming}
                  onClick={() => void copyOutput()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Copy
                </button>
                <button
                  type="button"
                  onClick={clearAllToolState}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

