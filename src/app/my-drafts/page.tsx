"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Plus,
  FileText,
  ArrowUp,
  PanelLeftClose,
  PanelLeft,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Draft = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

type View = "chat" | "editor";

// ─── Constants ───────────────────────────────────────────────────────────────

const SUGGESTION_CARDS = [
  "How will you manage financial risks and budget control throughout the project?",
  "Describe your approach to resident engagement and community communication.",
  "How will you ensure compliance with current building regulations and design standards?",
  "Explain your quality management and contract management strategy.",
];

const INITIAL_DRAFTS: Draft[] = [
  {
    id: "1",
    title: "Document - 11 Apr 2025, 10:44",
    content: "",
    createdAt: "11 Apr 2025",
  },
];

const TOOLS = [
  { id: "spellCheck", label: "Spell Check", icon: PenLine },
  { id: "expand", label: "Expand", icon: Maximize2 },
  { id: "summarize", label: "Summarize", icon: AlignLeft },
  { id: "rephrase", label: "Rephrase", icon: RefreshCcw },
  { id: "shorten", label: "Shorten", icon: Minimize2 },
  { id: "makeFormal", label: "Make Formal", icon: Feather },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MyDraftsPage() {
  const [view, setView] = useState<View>("chat");
  const [drafts, setDrafts] = useState<Draft[]>(INITIAL_DRAFTS);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Chat view state
  const [chatInput, setChatInput] = useState("");
  const [chatSidebarOpen, setChatSidebarOpen] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Editor view state
  const [editorSidebarOpen, setEditorSidebarOpen] = useState(true);
  const [toolOutput, setToolOutput] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeDraft = drafts.find((d) => d.id === activeDraftId) ?? null;

  // Auto-resize chat textarea
  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [chatInput, autoResizeTextarea]);

  function handleSuggestion(text: string) {
    setChatInput(text);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleChatKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
    }
  }

  function openEditor(draftId?: string) {
    setActiveDraftId(draftId ?? null);
    setToolOutput(null);
    setActiveTool(null);
    setView("editor");
  }

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

  function handleRunTool(toolId: string) {
    if (!activeDraft) return;
    setActiveTool(toolId);
    const tool = TOOLS.find((t) => t.id === toolId);
    setToolOutput(
      `${tool?.label ?? toolId} output will appear here once connected to the AI backend.`
    );
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

  // ─── CHAT VIEW ─────────────────────────────────────────────────────────────
  if (view === "chat") {
    return (
      <DashboardLayout title="My Drafts">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Inner session sidebar */}
          <aside
            className={cn(
              "flex shrink-0 flex-col border-r border-border bg-card",
              "transition-[width,opacity] duration-300 ease-in-out",
              chatSidebarOpen ? "w-60 opacity-100" : "w-0 overflow-hidden opacity-0"
            )}
            aria-label="Draft sessions"
          >
            {/* Logo */}
            <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-4.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
                <FileText className="h-4 w-4 text-primary-foreground" aria-hidden />
              </div>
              <span className="whitespace-nowrap text-sm font-semibold text-foreground">
                AutoTender AI
              </span>
            </div>

            {/* Nav content */}
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              <button
                type="button"
                onClick={() => { setChatInput(""); setActiveDraftId(null); }}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">New Bid Question</span>
              </button>

              {/* My Drafts section */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => openEditor()}
                  className="mb-1 flex w-full items-center justify-between px-2 py-1 text-left"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">
                    My Drafts
                  </span>
                  {drafts.length > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      {drafts.length}
                    </span>
                  )}
                </button>
                {drafts.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">No drafts yet.</p>
                ) : (
                  drafts.map((draft) => (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => openEditor(draft.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate text-xs text-foreground">{draft.title}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Bottom count */}
            <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">Drafts</span>
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {drafts.length}
              </span>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex min-w-0 flex-1 flex-col bg-background">
            {/* Header bar */}
            <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
              <button
                type="button"
                onClick={() => setChatSidebarOpen((v) => !v)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={chatSidebarOpen ? "Collapse panel" : "Expand panel"}
              >
                {chatSidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                ) : (
                  <PanelLeft className="h-4 w-4" aria-hidden />
                )}
              </button>
              <h2 className="text-sm font-semibold text-foreground">Bid Writing Assistant</h2>
            </div>

            {/* Centered prompt */}
            <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10">
              <div className="flex w-full max-w-2xl flex-col items-center gap-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
                  <FileText className="h-7 w-7 text-primary" aria-hidden />
                </div>
                <div className="space-y-2 text-center">
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">
                    Ask me a tender question
                  </h3>
                  <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
                    I'll search your historical bid library and generate a compelling, cited draft response.
                  </p>
                </div>
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  {SUGGESTION_CARDS.map((card, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSuggestion(card)}
                      className="rounded-xl border border-border bg-card p-3.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted hover:text-foreground"
                    >
                      {card}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat input */}
            <div className="shrink-0 border-t border-border bg-card px-4 py-4">
              <div className="mx-auto max-w-2xl">
                <div
                  className={cn(
                    "flex items-end gap-3 rounded-xl border bg-background px-4 py-3 transition-colors",
                    chatInput
                      ? "border-primary ring-1 ring-primary/25"
                      : "border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/25"
                  )}
                >
                  <textarea
                    ref={textareaRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Type your tender question here..."
                    rows={1}
                    className="max-h-40 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    aria-label="Tender question input"
                  />
                  <button
                    type="button"
                    disabled={!chatInput.trim()}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Send question"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Ctrl + Enter to send · Sources are cited inline as [1], [2], …
                </p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── DRAFT EDITOR VIEW ─────────────────────────────────────────────────────
  return (
    <DashboardLayout title="My Drafts">
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── Editor left sidebar ── */}
        <aside
          className={cn(
            "flex shrink-0 flex-col border-r border-border bg-card",
            "transition-[width,opacity] duration-300 ease-in-out",
            editorSidebarOpen ? "w-60 opacity-100" : "w-0 overflow-hidden opacity-0"
          )}
          aria-label="My drafts"
        >
          {/* Logo */}
          <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-4.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-4 w-4 text-primary-foreground" aria-hidden />
            </div>
            <span className="whitespace-nowrap text-sm font-semibold text-foreground">
              AutoTender AI
            </span>
          </div>

          {/* Back to Chat */}
          <button
            type="button"
            onClick={() => setView("chat")}
            className="flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to Chat
          </button>

          {/* MY DRAFTS list */}
          <div className="flex flex-1 flex-col overflow-y-auto">
            <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              My Drafts
            </p>

            {drafts.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">No saved drafts yet.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Save a draft from the chat.
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
                        <p className={cn(
                          "truncate text-sm font-medium",
                          isActive ? "text-primary" : "text-foreground"
                        )}>
                          {draft.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {draft.createdAt}
                        </p>
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

        {/* ── Main editor area ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

          {/* Top bar: sidebar toggle + draft title + Copy */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 py-2.5">
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

          {/* Three-panel body */}
          <div className="flex min-h-0 flex-1 overflow-hidden">

            {/* ── Panel 1: Draft Document ── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border">
              {/* Panel toolbar */}
              <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border bg-card/50 px-3 py-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Draft Document
                </span>

                {activeDraft && (
                  <>
                    {/* Undo / Redo */}
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Undo"
                      >
                        <Undo2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Redo"
                      >
                        <Redo2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>

                    {/* Save */}
                    <button
                      type="button"
                      className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                    >
                      <Save className="h-3 w-3" aria-hidden />
                      Save
                    </button>

                    {/* Download */}
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Download"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                    </button>

                    {/* Ask AI */}
                    <button
                      type="button"
                      className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <HelpCircle className="h-3 w-3" aria-hidden />
                      Ask AI
                      <ChevronDown className="h-3 w-3" aria-hidden />
                    </button>
                  </>
                )}

                {/* Hint text */}
                <span className="hidden min-w-0 truncate text-[10px] tracking-wide text-muted-foreground sm:block">
                  SELECT TEXT THEN PICK A TOOL · CLICK TO EDIT
                </span>
              </div>

              {/* Draft content */}
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
                        Choose a draft from the left sidebar to open it here.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Panel 2: Tools ── */}
            <div className="hidden shrink-0 flex-col overflow-hidden border-r border-border sm:flex sm:w-44 md:w-48 lg:w-52">
              {/* Header */}
              <div className="shrink-0 border-b border-border bg-card/50 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Tools
                </span>
              </div>

              {/* Tool buttons */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                {TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleRunTool(tool.id)}
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
                ))}
              </div>

              {/* Footer hint */}
              <div className="shrink-0 border-t border-border px-3 py-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Select text in the document, then click a tool. Or click a tool to process the whole draft.
                </p>
              </div>
            </div>

            {/* ── Panel 3: Tool Output ── */}
            <div className="hidden shrink-0 flex-col overflow-hidden lg:flex lg:w-52 xl:w-60">
              {/* Header */}
              <div className="shrink-0 border-b border-border bg-card/50 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Tool Output
                </span>
              </div>

              {/* Output content */}
              <div className="min-h-0 flex-1 overflow-y-auto bg-background p-4">
                {toolOutput ? (
                  <p className="text-sm leading-relaxed text-foreground">{toolOutput}</p>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
                      <FileText className="h-6 w-6 text-primary" aria-hidden />
                    </div>
                    <p className="max-w-[10rem] text-sm text-muted-foreground">
                      Run a tool on the left to see the output here.
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
