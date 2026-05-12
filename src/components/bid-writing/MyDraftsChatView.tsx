"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  FileText,
  ArrowUp,
  PanelLeftClose,
  PanelLeft,
  Filter,
  FolderOpen,
  Globe,
  Trash2,
  Library,
  Copy,
  Download,
  ChevronDown,
  Save,
} from "lucide-react";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { MarkdownRenderer } from "@/components/bid-writing/MarkdownRenderer";
import type { ChatSession, DraftRecord, FilterPresetId } from "@/lib/bid-writing/types";
import { loadChatHistory, saveChatHistory } from "@/lib/bid-writing/chatHistoryStorage";
import { MOCK_LIBRARY_FOLDERS } from "@/lib/bid-writing/mockBidFolders";
import { MOCK_CLIENT_PROJECTS } from "@/lib/bid-writing/mockClientProjects";

const SUGGESTION_CARDS = [
  "How will you manage financial risks and budget control throughout the project?",
  "Describe your approach to resident engagement and community communication.",
  "How will you ensure compliance with current building regulations and design standards?",
  "Explain your quality management and contract management strategy.",
];

const MOCK_ASSISTANT_REPLY = `Based on your historical bid library, here is a structured response you can refine [1].

**Mobilisation**  
We stage works to minimise disruption and maintain a single point of contact for residents [2].

**Governance**  
Quality checkpoints align with your contract management plan and reporting cycle [1].

*(Connect to the AI backend to stream live answers and sources.)*`;

type Msg = { role: "user" | "assistant"; content: string };

interface MyDraftsChatViewProps {
  drafts: DraftRecord[];
  onOpenEditor: (draftId?: string) => void;
  onSaveDraftFromAssistant: (title: string, body: string) => void;
}

export function MyDraftsChatView({
  drafts,
  onOpenEditor,
  onSaveDraftFromAssistant,
}: MyDraftsChatViewProps) {
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [webSourceOn, setWebSourceOn] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPreset, setFilterPreset] = useState<FilterPresetId>("high");
  const [folderSearch, setFolderSearch] = useState("");
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
    () => new Set(MOCK_LIBRARY_FOLDERS.map((f) => f.name))
  );

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientProject, setClientProject] = useState<string | null>(null);

  const [draftToast, setDraftToast] = useState(false);
  /** Which assistant message index has the export dropdown open (null = closed). */
  const [exportMenuIndex, setExportMenuIndex] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessions(loadChatHistory());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (exportMenuIndex === null) return;
    function closeOnOutsideClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-chat-export-root]")) setExportMenuIndex(null);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [exportMenuIndex]);

  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [chatInput, autoResizeTextarea]);

  function persistSessions(next: ChatSession[]) {
    setSessions(next);
    saveChatHistory(next);
  }

  function startNewChat() {
    const id = `chat_${Date.now()}`;
    setCurrentChatId(id);
    setMessages([]);
    setChatInput("");
  }

  function loadSession(id: string) {
    const s = sessions.find((c) => c.id === id);
    if (!s) return;
    setCurrentChatId(id);
    setMessages(
      s.messages.flatMap((m) => [
        { role: "user" as const, content: m.question },
        { role: "assistant" as const, content: m.answer },
      ])
    );
  }

  function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = sessions.filter((c) => c.id !== id);
    persistSessions(next);
    if (currentChatId === id) startNewChat();
  }

  function handleChatKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void sendMessage();
    }
  }

  async function sendMessage() {
    const q = chatInput.trim();
    if (!q) return;

    let chatId = currentChatId;
    if (!chatId) {
      chatId = `chat_${Date.now()}`;
      setCurrentChatId(chatId);
    }

    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);

    // Mock latency + assistant reply (replace with SSE)
    await new Promise((r) => setTimeout(r, 450));
    setMessages((prev) => [...prev, { role: "assistant", content: MOCK_ASSISTANT_REPLY }]);

    const title = q.length > 55 ? `${q.slice(0, 55).trim()}…` : q;
    const answer = MOCK_ASSISTANT_REPLY;
    setSessions((prev) => {
      const updated = [...prev];
      const idx = updated.findIndex((c) => c.id === chatId);
      const now = new Date().toISOString();
      if (idx >= 0) {
        const existing = updated[idx];
        const merged: ChatSession = {
          ...existing,
          title,
          messages: [...existing.messages, { question: q, answer }],
          updatedAt: now,
        };
        updated.splice(idx, 1);
        updated.unshift(merged);
      } else {
        updated.unshift({
          id: chatId,
          title,
          messages: [{ question: q, answer }],
          createdAt: now,
          updatedAt: now,
        });
      }
      const next = updated.slice(0, 30);
      saveChatHistory(next);
      return next;
    });
  }

  function saveAssistantContentAsDraft(content: string) {
    const title = `Draft — ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`;
    onSaveDraftFromAssistant(title, content);
    setDraftToast(true);
    setTimeout(() => setDraftToast(false), 3200);
    toast.success("Draft saved");
  }

  async function copyAssistantContent(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }

  function exportAssistantContent(kind: "pdf" | "docx" | "txt", content: string) {
    if (!content.trim()) {
      toast.info("Nothing to export.");
      return;
    }
    toast.info(`${kind.toUpperCase()} export will download when the API is connected.`);
    setExportMenuIndex(null);
  }

  function toggleFolder(name: string) {
    setSelectedFolders((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }

  function applyPreset(p: FilterPresetId) {
    setFilterPreset(p);
    if (p === "full") {
      setSelectedFolders(new Set(MOCK_LIBRARY_FOLDERS.map((f) => f.name)));
    } else if (p === "high") {
      setSelectedFolders(new Set(MOCK_LIBRARY_FOLDERS.slice(0, 4).map((f) => f.name)));
    }
  }

  const filteredFolders = MOCK_LIBRARY_FOLDERS.filter((f) =>
    f.name.toLowerCase().includes(folderSearch.trim().toLowerCase())
  );

  const filterLabel =
    filterPreset === "high"
      ? "High scoring"
      : filterPreset === "full"
        ? "Full library"
        : "Custom";

  return (
    <>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
            chatSidebarOpen ? "opacity-100" : "pointer-events-none invisible opacity-0"
          )}
          onClick={() => setChatSidebarOpen(false)}
          aria-hidden
        />

        <aside
          className={cn(
            "flex shrink-0 flex-col border-r border-border bg-card",
            "fixed inset-y-0 left-0 z-50 w-60 shadow-xl",
            chatSidebarOpen ? "translate-x-0" : "-translate-x-full",
            "lg:relative lg:inset-auto lg:z-auto lg:shadow-none lg:translate-x-0",
            "transition-[transform,width,opacity] duration-300 ease-in-out",
            chatSidebarOpen ? "lg:w-60 lg:opacity-100" : "lg:w-0 lg:overflow-hidden lg:opacity-0"
          )}
          aria-label="Bid writing sessions"
        >
          <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-4.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-4 w-4 text-primary-foreground" aria-hidden />
            </div>
            <span className="whitespace-nowrap text-sm font-semibold text-foreground">
              AutoTender AI
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            <button
              type="button"
              onClick={() => {
                startNewChat();
                setChatInput("");
              }}
              className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">New Bid Question</span>
            </button>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => onOpenEditor()}
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
                drafts.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      onOpenEditor(d.id);
                      setChatSidebarOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate text-xs text-foreground">{d.title}</span>
                  </button>
                ))
              )}
            </div>

            <Link
              href="/past-bid-library"
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
              onClick={() => setChatSidebarOpen(false)}
            >
              <Library className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Bid Library
            </Link>

            <div className="mt-4 border-t border-border pt-3">
              <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Recent chats
              </p>
              <div className="space-y-0.5">
                {sessions.length === 0 ? (
                  <p className="px-1 text-xs text-muted-foreground">No chats yet</p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "group flex items-center gap-1 rounded-lg",
                        currentChatId === s.id && "bg-primary/10"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          loadSession(s.id);
                          setChatSidebarOpen(false);
                        }}
                        className="min-w-0 flex-1 truncate px-2 py-2 text-left text-xs text-foreground hover:bg-muted"
                        title={s.title}
                      >
                        {s.title}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => deleteSession(s.id, e)}
                        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        aria-label="Delete chat"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">Drafts</span>
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {drafts.length}
            </span>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
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
            <h2 className="min-w-0 flex-1 text-sm font-semibold text-foreground">
              Bid Writing Assistant
            </h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setClientModalOpen(true)}
                className="flex max-w-[11rem] items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Select client project"
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {clientProject ?? "No client doc"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Filter bid library"
              >
                <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{filterLabel}</span>
                <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary">
                  {selectedFolders.size}
                </span>
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-6"
          >
            {messages.length === 0 ? (
              <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 py-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
                  <FileText className="h-7 w-7 text-primary" aria-hidden />
                </div>
                <div className="space-y-2 text-center">
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">
                    Ask me a tender question
                  </h3>
                  <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
                    I&apos;ll search your historical bid library and generate a compelling, cited draft response.
                  </p>
                </div>
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  {SUGGESTION_CARDS.map((card, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setChatInput(card);
                        setTimeout(() => textareaRef.current?.focus(), 0);
                      }}
                      className="rounded-xl border border-border bg-card p-3.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted hover:text-foreground"
                    >
                      {card}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                {messages.map((m, i) => (
                  <div
                    key={`${i}-${m.role}`}
                    className={cn(
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-foreground"
                      )}
                    >
                      {m.role === "assistant" ? (
                        <MarkdownRenderer content={m.content} className="text-sm" />
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                      {m.role === "assistant" && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                          <button
                            type="button"
                            onClick={() => void copyAssistantContent(m.content)}
                            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Copy
                          </button>
                          <div className="relative shrink-0" data-chat-export-root>
                            <button
                              type="button"
                              onClick={() =>
                                setExportMenuIndex((idx) => (idx === i ? null : i))
                              }
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              aria-expanded={exportMenuIndex === i}
                              aria-haspopup="menu"
                            >
                              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Export
                              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                            </button>
                            {exportMenuIndex === i && (
                              <div
                                className="absolute left-0 top-full z-20 mt-1 min-w-[11rem] rounded-lg border border-border bg-popover py-1 shadow-md"
                                role="menu"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                                  onClick={() => exportAssistantContent("pdf", m.content)}
                                >
                                  PDF
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                                  onClick={() => exportAssistantContent("docx", m.content)}
                                >
                                  Word (.docx)
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                                  onClick={() => exportAssistantContent("txt", m.content)}
                                >
                                  Plain Text (.txt)
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => saveAssistantContentAsDraft(m.content)}
                            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary bg-transparent px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                          >
                            <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Save as Draft
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                  onClick={() => void sendMessage()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send question"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sources:</span>
                  <button
                    type="button"
                    onClick={() => setWebSourceOn((v) => !v)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      webSourceOn
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Globe className="h-3.5 w-3.5" aria-hidden />
                    Web
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ctrl + Enter to send · Citations [1], [2]…
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Library filter"
        className="max-w-lg"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Choose which ingested bid folders are allowed as retrieval context (mock selection — wire to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/chat</code>).
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => applyPreset("high")}
            className={cn(
              "flex flex-1 flex-col rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              filterPreset === "high"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted"
            )}
          >
            <span className="font-medium">High scoring</span>
            <span className="text-[11px] text-muted-foreground">
              Won + lost ≥60% quality (mock subset)
            </span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset("full")}
            className={cn(
              "flex flex-1 flex-col rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              filterPreset === "full"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted"
            )}
          >
            <span className="font-medium">Full library</span>
            <span className="text-[11px] text-muted-foreground">All ingested projects</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterPreset("custom")}
            className={cn(
              "flex flex-1 flex-col rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              filterPreset === "custom"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted"
            )}
          >
            <span className="font-medium">Custom</span>
            <span className="text-[11px] text-muted-foreground">Pick folders</span>
          </button>
        </div>

        {filterPreset === "custom" && (
          <div className="mt-4 flex max-h-72 flex-col rounded-lg border border-border">
            <input
              type="search"
              value={folderSearch}
              onChange={(e) => setFolderSearch(e.target.value)}
              placeholder="Search projects…"
              className="border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filteredFolders.map((f) => (
                <label
                  key={f.name}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selectedFolders.has(f.name)}
                    onChange={() => toggleFolder(f.name)}
                    className="mt-1 rounded border-border"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-foreground">{f.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {f.count} chunks
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setFilterOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => setFilterOpen(false)}
          >
            Apply selection
          </Button>
        </div>
      </Modal>

      <Modal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        title="Select client project"
        className="max-w-md"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Choose which client&apos;s uploaded tender documents to include as context when drafting responses.
        </p>
        <button
          type="button"
          className="mb-3 w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
          onClick={() => {
            setClientProject(null);
            setClientModalOpen(false);
          }}
        >
          None (DCK library only)
        </button>
        <div className="flex flex-col gap-2">
          {MOCK_CLIENT_PROJECTS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
              onClick={() => {
                setClientProject(p.name);
                setClientModalOpen(false);
              }}
            >
              <span className="font-medium text-foreground">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.chunks} chunks</span>
            </button>
          ))}
        </div>
      </Modal>

      <div
        className={cn(
          "fixed bottom-24 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-lg transition-all duration-300 lg:bottom-20",
          draftToast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        )}
        role="status"
      >
        <span className="text-primary">✓</span>
        Draft saved!
        <button
          type="button"
          className="font-semibold text-primary hover:underline"
          onClick={() => onOpenEditor()}
        >
          Open →
        </button>
      </div>
    </>
  );
}
