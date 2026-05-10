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
  HelpCircle,
  Copy,
  PenLine,
  Maximize2,
  AlignLeft,
  RefreshCcw,
  Minimize2,
  Feather,
  Menu,
  Upload,
  FolderArchive,
  Check,
  ArrowDownToLine,
} from "lucide-react";
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

const EXPAND_PRESETS = [150, 300, 500, 750];
const SHORTEN_PRESETS = [80, 120, 200];

interface MyDraftsEditorViewProps {
  drafts: DraftRecord[];
  setDrafts: React.Dispatch<React.SetStateAction<DraftRecord[]>>;
  activeDraftId: string | null;
  setActiveDraftId: React.Dispatch<React.SetStateAction<string | null>>;
  onBackToChat: () => void;
}

export function MyDraftsEditorView({
  drafts,
  setDrafts,
  activeDraftId,
  setActiveDraftId,
  onBackToChat,
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
  const [wcExpandPreset, setWcExpandPreset] = useState<number | null>(300);
  const [wcShortenPreset, setWcShortenPreset] = useState<number | null>(120);

  const [clientZipBusy, setClientZipBusy] = useState(false);
  const [clientZipPct, setClientZipPct] = useState(0);

  const uploadDraftRef = useRef<HTMLInputElement>(null);
  const clientZipRef = useRef<HTMLInputElement>(null);
  const activeDraft = drafts.find((d) => d.id === activeDraftId) ?? null;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function handleDeleteDraft(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (activeDraftId === id) setActiveDraftId(null);
  }

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
    setToolOutput(mockToolMessage(toolId, wcNote));
    if (toolId !== "expand") setWcExpandOpen(false);
    if (toolId !== "shorten") setWcShortenOpen(false);
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
    const n =
      wcExpandCustom.trim() !== ""
        ? parseInt(wcExpandCustom, 10)
        : wcExpandPreset;
    if (!n || Number.isNaN(n)) {
      toast.info("Pick a target word count.");
      return;
    }
    handleRunTool("expand", `target ${n} words`);
  }

  function runShortenWithWc() {
    const n =
      wcShortenCustom.trim() !== ""
        ? parseInt(wcShortenCustom, 10)
        : wcShortenPreset;
    if (!n || Number.isNaN(n)) {
      toast.info("Pick a target word count.");
      return;
    }
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

  function mockClientZip(file: File | null) {
    if (!file) return;
    setClientZipBusy(true);
    setClientZipPct(0);
    const steps = [15, 40, 72, 100];
    let i = 0;
    const id = window.setInterval(() => {
      setClientZipPct(steps[i] ?? 100);
      i += 1;
      if (i >= steps.length) {
        window.clearInterval(id);
        setClientZipBusy(false);
        toast.success(`Ingested ${file.name} (mock)`);
      }
    }, 400);
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

        <button
          type="button"
          onClick={onBackToChat}
          className="flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to Chat
        </button>

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

          <input
            ref={clientZipRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              mockClientZip(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => clientZipRef.current?.click()}
            className="mt-2 flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <FolderArchive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Client Documents (ZIP)
          </button>

          {clientZipBusy && (
            <div className="mt-3 rounded-lg border border-border bg-muted/30 p-2">
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Ingesting…</span>
                <span>{clientZipPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${clientZipPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            My Drafts
          </p>

          {drafts.length === 0 ? (
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
                return (
                  <li key={draft.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDraftId(draft.id);
                        setToolOutput(null);
                        setActiveTool(null);
                      }}
                      className={cn(
                        "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
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
                    {isActive && (
                      <div className="px-3 pb-1.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(draft.id)}
                          className="rounded px-2 py-0.5 text-xs text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          Delete
                        </button>
                      </div>
                    )}
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
            <div className="shrink-0 border-b border-border bg-card/50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-3">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Draft Document
                </span>
                {activeDraft && (
                  <>
                    <span
                      className="hidden h-5 w-px shrink-0 bg-border sm:block"
                      aria-hidden
                    />
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Undo"
                      >
                        <Undo2 className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Redo"
                      >
                        <Redo2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      onClick={() => toast.success("Saved (mock)")}
                    >
                      <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Save
                    </button>
                    <div className="relative shrink-0" ref={downloadRef}>
                      <button
                        type="button"
                        onClick={() => setDownloadOpen((o) => !o)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Download"
                        aria-expanded={downloadOpen}
                      >
                        <Download className="h-4 w-4" aria-hidden />
                      </button>
                      {downloadOpen && (
                        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border bg-popover py-1 shadow-md">
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
                    <button
                      type="button"
                      onClick={() => setAskAiOpen((v) => !v)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:ml-auto"
                      aria-expanded={askAiOpen}
                    >
                      <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Ask AI
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 transition-transform",
                          askAiOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </>
                )}
              </div>
              <p className="mt-1.5 text-[10px] font-semibold uppercase leading-snug tracking-wide text-muted-foreground sm:mt-1">
                Select text then pick a tool · Click to edit
              </p>

              {activeDraft && askAiOpen && (
                <div className="mt-2 rounded-lg border border-border bg-background p-3">
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

            <div className="min-h-0 flex-1 overflow-y-auto bg-background">
              {activeDraft ? (
                <textarea
                  key={activeDraft.id}
                  value={activeDraft.content}
                  onChange={(e) => handleDraftContentChange(e.target.value)}
                  placeholder="Start typing your draft here..."
                  className="h-full min-h-full w-full resize-none bg-transparent px-6 py-6 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                  aria-label="Draft content"
                />
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

          <div className="hidden min-h-0 shrink-0 flex-col overflow-hidden border-r border-border sm:flex sm:w-44 md:w-48 lg:w-52">
            <div className="shrink-0 border-b border-border bg-card/50 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Tools
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
              {TOOLS.map((tool) => (
                <div key={tool.id}>
                  <button
                    type="button"
                    onClick={() => handleToolClick(tool.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors",
                      "hover:border-primary/40 hover:bg-muted",
                      activeTool === tool.id
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "text-foreground"
                    )}
                  >
                    <tool.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        activeTool === tool.id ? "text-primary" : "text-muted-foreground"
                      )}
                      aria-hidden
                    />
                    {tool.label}
                  </button>

                  {tool.id === "expand" && wcExpandOpen && (
                    <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Target word count
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {EXPAND_PRESETS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              setWcExpandPreset(n);
                              setWcExpandCustom("");
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
                          min={50}
                          max={2000}
                          placeholder="Custom…"
                          value={wcExpandCustom}
                          onChange={(e) => {
                            setWcExpandCustom(e.target.value);
                            setWcExpandPreset(null);
                          }}
                          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={runExpandWithWc}
                          className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                        >
                          Run
                        </button>
                      </div>
                    </div>
                  )}

                  {tool.id === "shorten" && wcShortenOpen && (
                    <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Target word count
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {SHORTEN_PRESETS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              setWcShortenPreset(n);
                              setWcShortenCustom("");
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
                        ))}
                      </div>
                      <div className="mt-2 flex gap-1">
                        <input
                          type="number"
                          min={20}
                          max={2000}
                          placeholder="Custom…"
                          value={wcShortenCustom}
                          onChange={(e) => {
                            setWcShortenCustom(e.target.value);
                            setWcShortenPreset(null);
                          }}
                          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={runShortenWithWc}
                          className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                        >
                          Run
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="shrink-0 border-t border-border px-3 py-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Select text in the document, then click a tool. Or click a tool to process the whole draft.
              </p>
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
          </div>
        </div>
      </div>
    </div>
  );
}
