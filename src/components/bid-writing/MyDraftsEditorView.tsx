"use client";

import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import type { DraftRecord } from "@/lib/bid-writing/types";
import { MarkdownRenderer } from "@/components/bid-writing/MarkdownRenderer";

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
}: MyDraftsEditorViewProps) {
  const [editorSidebarOpen, setEditorSidebarOpen] = useState(false);
  const [toolOutput, setToolOutput] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [askAiOpen, setAskAiOpen] = useState(false);
  const [askAiInput, setAskAiInput] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  const [wcExpandOpen, setWcExpandOpen] = useState(false);
  const [wcShortenOpen, setWcShortenOpen] = useState(false);
  const [wcExpandCustom, setWcExpandCustom] = useState("");
  const [wcShortenCustom, setWcShortenCustom] = useState("");
  const [wcExpandPreset, setWcExpandPreset] = useState<number | null>(null);
  const [wcShortenPreset, setWcShortenPreset] = useState<number | null>(null);
  const [wcExpandError, setWcExpandError] = useState<string | null>(null);
  const [wcShortenError, setWcShortenError] = useState<string | null>(null);
  const [draftDocTab, setDraftDocTab] = useState<"preview" | "edit">("preview");
  const [draftMenuOpenId, setDraftMenuOpenId] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState("");
  // DOM-sourced word count — kept in sync via useEffect; see comment on that effect.
  const [renderedWordCount, setRenderedWordCount] = useState(0);

  const uploadDraftRef = useRef<HTMLInputElement>(null);
  const contentPreviewRef = useRef<HTMLDivElement>(null);
  const activeDraft = drafts.find((d) => d.id === activeDraftId) ?? null;
  const selectionWordCount = countWords(selectedText);
  const baseWordCount = selectionWordCount > 0 ? selectionWordCount : renderedWordCount;
  const expandPresets = buildExpandPresets(baseWordCount);
  const shortenPresets = buildShortenPresets(baseWordCount);

  useEffect(() => {
    setDraftDocTab("preview");
    setSelectedText("");
    setRenderedWordCount(0);
    window.getSelection()?.removeAllRanges();
  }, [activeDraftId]);

  // activeDraft.content is raw markdown and excludes sources rendered separately, so it
  // gives a lower word count than the visible text. Read from the committed DOM instead to
  // match what the user sees (and what Ctrl+A selects). Edit-tab falls back to raw content.
  useEffect(() => {
    if (draftDocTab === "preview") {
      // If the preview DOM isn't mounted yet (loading spinner visible), skip — the effect
      // will re-run once activeDraftLoading becomes false and the DOM is ready.
      if (!contentPreviewRef.current) return;
      setRenderedWordCount(countWords(contentPreviewRef.current.textContent ?? ""));
    } else {
      setRenderedWordCount(countWords(activeDraft?.content ?? ""));
    }
  }, [activeDraftId, activeDraft?.content, draftDocTab, activeDraftLoading]);

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

  // Clear selection when switching tabs
  useEffect(() => {
    setSelectedText("");
  }, [draftDocTab]);

  // Track browser text selection within the preview content area
  useEffect(() => {
    if (draftDocTab !== "preview") return;
    function handleSelChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !contentPreviewRef.current) {
        setSelectedText("");
        return;
      }
      try {
        const range = sel.getRangeAt(0);
        if (contentPreviewRef.current.contains(range.commonAncestorContainer)) {
          setSelectedText(sel.toString());
        } else {
          setSelectedText("");
        }
      } catch {
        setSelectedText("");
      }
    }
    document.addEventListener("selectionchange", handleSelChange);
    return () => document.removeEventListener("selectionchange", handleSelChange);
  }, [draftDocTab]);

  // Keyboard shortcuts scoped to the preview content area
  useEffect(() => {
    if (draftDocTab !== "preview") return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        window.getSelection()?.removeAllRanges();
        setSelectedText("");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        const el = contentPreviewRef.current;
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
  }, [draftDocTab, selectedText]);

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

  function handleDraftContentChange(content: string) {
    if (!activeDraftId) return;
    setDrafts((prev) =>
      prev.map((d) => (d.id === activeDraftId ? { ...d, content } : d))
    );
  }

  function mockToolMessage(toolId: string, extra?: string) {
    const tool = TOOLS.find((t) => t.id === toolId);
    const label = tool?.label ?? toolId;
    const scope = extra ?? "full draft";
    return `### ${label}\n\n**Scope:** ${scope}\n\nPreview markdown formatting below — connect the AI backend to stream live results.\n\n- Bullet example\n- \`Inline code\` and **bold**\n\n| Aspect | Note |\n| --- | --- |\n| Status | Mock |\n| Output | Placeholder |\n`;
  }

  function handleRunTool(toolId: string, wcNote?: string) {
    if (!activeDraft) return;
    setActiveTool(toolId);
    const hasSelection = selectedText.trim().length > 0;
    const scope = hasSelection
      ? `selection (${selectionWordCount} word${selectionWordCount !== 1 ? "s" : ""})`
      : wcNote ?? "full draft";
    setToolOutput(mockToolMessage(toolId, scope));
    setWcExpandOpen(false);
    setWcShortenOpen(false);
  }

  function handleToolClick(toolId: string) {
    if (!activeDraft) return;
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
    handleRunTool("expand", `target ${n} words`);
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
    handleRunTool("shorten", `target ${n} words`);
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

  function applyOutput() {
    if (!toolOutput || !activeDraftId) return;
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === activeDraftId ? { ...d, content: toolOutput } : d
      )
    );
    toast.success("Applied to draft");
  }

  function appendOutput() {
    if (!toolOutput || !activeDraftId) return;
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === activeDraftId
          ? {
              ...d,
              content: d.content
                ? `${d.content.trimEnd()}\n\n${toolOutput}`
                : toolOutput,
            }
          : d
      )
    );
    toast.success("Appended to draft");
  }

  function mockUploadDraft(file: File | null) {
    if (!file) return;
    toast.info(`Extracted “${file.name}” (mock) — connect upload API to ingest text.`);
  }

  function sendAskAi() {
    if (!askAiInput.trim()) return;
    setToolOutput(
      `Ask AI (“${askAiInput.slice(0, 80)}…”) — responses will stream here when the endpoint is connected.`
    );
    setActiveTool("askAi");
    setAskAiInput("");
    setAskAiOpen(false);
  }

  function downloadAs(kind: "pdf" | "docx" | "txt") {
    if (!activeDraft?.content.trim()) {
      toast.info("Add draft content first.");
      return;
    }
    toast.info(`Export ${kind.toUpperCase()} will download via API (mock).`);
    setDownloadOpen(false);
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
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
          "flex shrink-0 flex-col border-r border-border bg-card",
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
              mockUploadDraft(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => uploadDraftRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Upload className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Upload Existing Draft
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
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-3 py-2.5">
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
            {activeDraft && toolOutput && (
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
            <div className="shrink-0 border-b border-border bg-background">
              <div className="min-w-0 px-4 py-3 sm:px-6">
                <div className="flex flex-col gap-2.5">
                  {/* Row 1: label left, utilities right (reference) */}
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Draft Document
                    </span>
                    {activeDraft && (
                      <div className="flex min-w-0 flex-1 justify-end">
                        <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-clip rounded-xl border border-border/60 bg-muted/60 p-1 [-ms-overflow-style:none] [scrollbar-width:none] dark:bg-muted/40 [&::-webkit-scrollbar]:hidden">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                          aria-label="Undo"
                        >
                          <Undo2 className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                          aria-label="Redo"
                        >
                          <Redo2 className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                          onClick={() => toast.success("Saved (mock)")}
                        >
                          <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Save
                        </button>
                        <div className="relative shrink-0" ref={downloadRef}>
                          <button
                            type="button"
                            onClick={() => setDownloadOpen((o) => !o)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                            aria-label="Download"
                            aria-expanded={downloadOpen}
                          >
                            <Download className="h-4 w-4" aria-hidden />
                          </button>
                          {downloadOpen && (
                            <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border bg-popover py-1 shadow-md">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                                onClick={() => downloadAs("pdf")}
                              >
                                <ArrowDownToLine className="h-4 w-4" aria-hidden />
                                PDF
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                                onClick={() => downloadAs("docx")}
                              >
                                <ArrowDownToLine className="h-4 w-4" aria-hidden />
                                Word (.docx)
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                                onClick={() => downloadAs("txt")}
                              >
                                <ArrowDownToLine className="h-4 w-4" aria-hidden />
                                Plain Text (.txt)
                              </button>
                            </div>
                          )}
                        </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 2: compact tray — Ask AI + tools (wrap inside panel; no overflow clip) */}
                  {activeDraft && (
                    <div className="min-w-0 rounded-2xl border border-border/50 bg-muted/50 p-2 shadow-sm dark:bg-muted/30">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
                        <div className="flex shrink-0 items-center sm:pr-3">
                          <button
                            type="button"
                            onClick={() => setAskAiOpen((v) => !v)}
                            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
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
                                  onClick={() => handleToolClick(tool.id)}
                                  className={cn(
                                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                                    "text-muted-foreground hover:bg-background/90 hover:text-foreground",
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
                                        className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
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
                                        className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
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
                  <p
                    className={cn(
                      "mt-2 text-[10px] font-semibold leading-snug tracking-[0.15em]",
                      selectedText.trim()
                        ? "text-primary/80"
                        : "uppercase text-muted-foreground"
                    )}
                  >
                    {selectedText.trim()
                      ? `${selectionWordCount} word${selectionWordCount !== 1 ? "s" : ""} selected — tool will process selection only`
                      : "Select text then pick a tool · click to edit"}
                  </p>
                )}

                {activeDraft && askAiOpen && (
                  <div className="mt-2 w-full max-w-full rounded-lg border border-border bg-background p-3">
                    <textarea
                      value={askAiInput}
                      onChange={(e) => setAskAiInput(e.target.value)}
                      placeholder="Ask a question or get suggestions…"
                      rows={3}
                      className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/30"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={sendAskAi}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
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
                <div className="flex h-full min-h-0 flex-1 flex-col">
                  <div
                    className="flex shrink-0 gap-1 border-b border-border/80 bg-muted/30 px-4 py-2 sm:px-6"
                    role="tablist"
                    aria-label="Draft document view"
                  >
                    {(
                      [
                        ["preview", "Preview"] as const,
                        ["edit", "Edit markdown"] as const,
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={draftDocTab === id}
                        onClick={() => setDraftDocTab(id)}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                          draftDocTab === id
                            ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
                            : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
                    {draftDocTab === "preview" ? (
                      <div
                        ref={contentPreviewRef}
                        tabIndex={0}
                        className="px-4 py-4 focus:outline-none sm:px-6 sm:py-6"
                        onMouseDown={() => contentPreviewRef.current?.focus()}
                      >
                        {activeDraft.content.trim() ? (
                          <MarkdownRenderer
                            content={activeDraft.content}
                            className="text-sm leading-relaxed text-foreground"
                            sourceLabelBySeq={sourceLabelBySeq}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No content yet. Switch to <strong>Edit markdown</strong> to add text.
                          </p>
                        )}
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
                    ) : (
                      <textarea
                        key={activeDraft.id}
                        value={activeDraft.content}
                        onChange={(e) => {
                          handleDraftContentChange(e.target.value);
                          setSelectedText("");
                        }}
                        onSelect={(e) => {
                          const ta = e.currentTarget;
                          const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
                          setSelectedText(sel);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            const ta = e.currentTarget;
                            ta.setSelectionRange(ta.selectionStart, ta.selectionStart);
                            setSelectedText("");
                          }
                        }}
                        placeholder="Start typing your draft here..."
                        className="h-full min-h-[50vh] w-full resize-none bg-transparent px-4 py-4 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none sm:px-6 sm:py-6"
                        aria-label="Draft content"
                      />
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
            <div className="flex shrink-0 items-center border-b border-border bg-card/50 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Tool Output
              </span>
              {activeTool && (
                <span className="ml-2 truncate text-[10px] text-muted-foreground">
                  ({activeTool})
                </span>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
              {toolOutput ? (
                <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-6">
                  <MarkdownRenderer content={toolOutput} />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-6 text-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                    <FileText className="h-6 w-6 text-primary" aria-hidden />
                  </div>
                  <p className="max-w-[14rem] text-sm text-muted-foreground">
                    Run a tool on the left to see the output here.
                  </p>
                </div>
              )}
            </div>
            {toolOutput && (
              <div className="shrink-0 border-t border-border bg-card/50 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-start gap-2">
                  <button
                    type="button"
                    onClick={applyOutput}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  >
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Apply to Draft
                  </button>
                  <button
                    type="button"
                    onClick={appendOutput}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Append to Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyOutput()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Copy Output
                  </button>
                </div>
              </div>
            )}
            {activeDraft && selectedText.trim() && (
              <div className="shrink-0 border-t border-border bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">
                  {selectionWordCount} word{selectionWordCount !== 1 ? "s" : ""} selected — tool will process selection only.
                </p>
              </div>
            )}
          </div>
        </div>
        {toolOutput && (
          <div className="flex max-h-[40vh] shrink-0 flex-col overflow-hidden border-t border-border lg:hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-card/50 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Tool Output
              </span>
              {activeTool && (
                <span className="ml-2 truncate text-[10px] text-muted-foreground">
                  ({activeTool})
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-background px-4 py-4">
              <MarkdownRenderer content={toolOutput} />
            </div>
            <div className="shrink-0 border-t border-border bg-card/50 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={applyOutput}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Apply
                </button>
                <button
                  type="button"
                  onClick={appendOutput}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Append
                </button>
                <button
                  type="button"
                  onClick={() => void copyOutput()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
