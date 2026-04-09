"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Loader2,
  PanelLeft,
  Plus,
  Send,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  displayAnswerFromOutputs,
  fetchChatHistory,
  fetchChatSessions,
  submitResearchQuery,
} from "@/services/researchService";
import type {
  ChatSessionListEntry,
  QueryResultResponse,
} from "@/services/researchService";
import { useResearchProject } from "@/contexts/ResearchProjectContext";
import {
  ResearchSourcesDrawer,
  ResearchSourcesTrigger,
} from "@/components/research/ResearchSourcesDrawer";
import { countResearchSources, displayResearchSourceCount } from "@/lib/researchSources";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";

type ChatMessageItem = {
  id: string;
  role: ChatRole;
  message: string;
  typing?: boolean;
  error?: boolean;
  /** From API `contexts` when show_sources was true (shape varies). */
  sourceContexts?: unknown;
};

type StoredChatTurn = {
  query: string;
  refined_answer: string;
  /** Raw sources payload from `/results` turn row (optional). */
  contexts?: unknown;
};

type StoredChat = {
  query: string;
  refined_answer: string;
  /** Present when multiple turns were loaded from `/results` `chat_sessions`. */
  turns?: StoredChatTurn[];
  /** Top-level sources for single-turn chats (optional). */
  contexts?: unknown;
};

type JobChatStore = {
  chats: Record<string, StoredChat>;
  /** project job_id → Neo4j session_id from /query-neo4j */
  sessions: Record<string, string>;
};

const STORAGE_KEY = "autotender_research_sessions_v1";

function generateClientId(prefix: string): string {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredChats(): JobChatStore {
  if (typeof window === "undefined") return { chats: {}, sessions: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { chats: {}, sessions: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object")
      return { chats: {}, sessions: {} };
    const o = parsed as Record<string, unknown>;
    const chatsRaw =
      o.chats && typeof o.chats === "object"
        ? (o.chats as Record<string, unknown>)
        : {};
    const legacyJobIds = Array.isArray(o.jobIds)
      ? o.jobIds.filter((id): id is string => typeof id === "string")
      : [];
    const chatKeys =
      legacyJobIds.length > 0
        ? legacyJobIds
        : Object.keys(chatsRaw).filter((k) => typeof k === "string");
    const chats: Record<string, StoredChat> = {};
    for (const id of chatKeys) {
      const maybe = chatsRaw[id];
      if (!maybe || typeof maybe !== "object") continue;
      const c = maybe as Record<string, unknown>;
      let turns: StoredChatTurn[] | undefined;
      const turnsRaw = c.turns;
      if (Array.isArray(turnsRaw)) {
        const parsed: StoredChatTurn[] = [];
        for (const t of turnsRaw) {
          if (!t || typeof t !== "object") continue;
          const tr = t as Record<string, unknown>;
          if (
            typeof tr.query === "string" &&
            typeof tr.refined_answer === "string"
          ) {
            const turn: StoredChatTurn = {
              query: tr.query,
              refined_answer: tr.refined_answer,
            };
            if ("contexts" in tr) turn.contexts = tr.contexts;
            parsed.push(turn);
          }
        }
        if (parsed.length > 0) turns = parsed;
      }
      if (turns?.length) {
        const last = turns[turns.length - 1];
        chats[id] =
          turns.length > 1
            ? {
                query: last.query,
                refined_answer: last.refined_answer,
                turns,
              }
            : { query: last.query, refined_answer: last.refined_answer };
      } else if (
        typeof c.query === "string" &&
        typeof c.refined_answer === "string"
      ) {
        const single: StoredChat = {
          query: c.query,
          refined_answer: c.refined_answer,
        };
        if ("contexts" in c) single.contexts = c.contexts;
        chats[id] = single;
      }
    }
    const sessions: Record<string, string> = {};
    const sessRaw =
      o.sessions && typeof o.sessions === "object"
        ? (o.sessions as Record<string, unknown>)
        : {};
    for (const [k, v] of Object.entries(sessRaw)) {
      if (typeof k === "string" && typeof v === "string" && v.trim()) {
        sessions[k] = v;
      }
    }
    return { chats, sessions };
  } catch {
    return { chats: {}, sessions: {} };
  }
}

function writeStoredChats(store: JobChatStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label="Typing">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </span>
  );
}

function ChatMessage({
  item,
  onOpenSources,
}: {
  item: ChatMessageItem;
  onOpenSources: (contexts: unknown) => void;
}) {
  const user = item.role === "user";
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  const canCopy = !user && !item.typing && Boolean(item.message?.length);

  const handleCopy = useCallback(async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(item.message);
      setCopied(true);
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [canCopy, item.message]);

  const showSourcesBadge =
    !user &&
    !item.typing &&
    !item.error &&
    item.sourceContexts !== undefined &&
    displayResearchSourceCount(item.sourceContexts) > 0;

  return (
    <div
      className={cn(
        "group flex w-full flex-col gap-0",
        user ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "relative max-w-[min(100%,85%)] whitespace-pre-wrap break-words rounded-[20px] px-4 py-3 text-sm leading-[1.55] shadow-sm sm:max-w-[70%]",
          user
            ? "rounded-br-md bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
            : item.error
              ? "rounded-bl-md border border-destructive/30 bg-destructive/10 text-destructive"
              : "rounded-bl-md border border-slate-200 bg-slate-50 pr-11 text-slate-800"
        )}
      >
        {canCopy ? (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className={cn(
              "absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700",
              copied ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            aria-label={copied ? "Copied" : "Copy response"}
            title={copied ? "Copied!" : "Copy"}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        ) : null}
        {item.typing ? <TypingDots /> : item.message}
      </div>
      {showSourcesBadge ? (
        <ResearchSourcesTrigger
          contexts={item.sourceContexts}
          onOpen={() => onOpenSources(item.sourceContexts!)}
        />
      ) : null}
    </div>
  );
}

function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  blockSendForProject,
  showSources,
  onToggleShowSources,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  /** First message: require a project selected in the header. */
  blockSendForProject: boolean;
  showSources: boolean;
  onToggleShowSources: () => void;
}) {
  return (
    <div className="w-full min-w-0 rounded-[1.75rem] border border-border/80 bg-card p-3 shadow-md sm:p-4">
      <textarea
        placeholder="Ask anything"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        disabled={disabled}
        className="min-h-[56px] w-full min-w-0 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70 sm:min-h-[72px]"
        rows={2}
      />
      <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 sm:w-auto sm:justify-start sm:py-1.5"
          >
            Research
            <ChevronDown className="h-4 w-4 shrink-0" />
          </button>
          <button
            type="button"
            onClick={onToggleShowSources}
            aria-pressed={showSources}
            className={cn(
              "inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors sm:w-auto sm:justify-start sm:py-1.5",
              showSources
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "border border-input bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Source Providers
          </button>
        </div>
        <div className="flex shrink-0 justify-end sm:justify-start">
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || !value.trim() || blockSendForProject}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:w-10"
            aria-label="Send"
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-[#f9fafb] shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="space-y-3 md:space-y-4">
      <div className="h-12 w-[62%] animate-pulse rounded-[18px] border border-slate-200 bg-slate-100" />
      <div className="ml-auto h-12 w-[52%] animate-pulse rounded-[18px] border border-slate-200 bg-slate-100" />
      <div className="h-12 w-[68%] animate-pulse rounded-[18px] border border-slate-200 bg-slate-100" />
    </div>
  );
}

function ResearchSidebar({
  collapsed,
  onCollapsedChange,
  onNewSession,
  projectSelected,
  sessionsLoading,
  sessions,
  selectedSessionId,
  onSelectSession,
}: {
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  onNewSession: () => void;
  projectSelected: boolean;
  sessionsLoading: boolean;
  sessions: ChatSessionListEntry[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}) {
  const showEmptyHint = !projectSelected;
  const showNoSessions =
    projectSelected && !sessionsLoading && sessions.length === 0;

  return (
    <aside
      className={cn(
        "hidden flex-col border-r border-border bg-[#f9fafb] transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-14" : "w-[260px]"
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-border px-3">
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="p-3">
            <Button
              variant="outline"
              className="w-full justify-center"
              size="sm"
              onClick={onNewSession}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4">
            {sessionsLoading ? (
              <div
                className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                Loading sessions…
              </div>
            ) : null}
            {projectSelected ? (
              <>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Sessions
                </p>
                <ul className="space-y-1">
                  {sessions.map((s) => (
                    <li key={s.session_id}>
                      <button
                        type="button"
                        onClick={() => onSelectSession(s.session_id)}
                        className={cn(
                          "w-full max-w-full rounded-md px-2 py-2 text-left text-sm leading-snug break-words",
                          s.session_id === selectedSessionId
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground hover:bg-muted"
                        )}
                        title={s.session_id}
                      >
                        {s.title?.trim() || s.session_id}
                      </button>
                    </li>
                  ))}
                </ul>
                {showNoSessions ? (
                  <p className="mt-2 px-1 text-sm text-muted-foreground">
                    No sessions yet. Submit a question to start.
                  </p>
                ) : null}
              </>
            ) : null}
            {showEmptyHint ? (
              <p className="px-1 text-sm text-muted-foreground">
                Select a project in the header to see sessions.
              </p>
            ) : null}
          </div>
        </>
      )}
    </aside>
  );
}

function MobileSessionsDrawer({
  open,
  onOpenChange,
  onNewSession,
  projectSelected,
  sessionsLoading,
  sessions,
  selectedSessionId,
  onSelectSession,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewSession: () => void;
  projectSelected: boolean;
  sessionsLoading: boolean;
  sessions: ChatSessionListEntry[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none invisible opacity-0"
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-[#f9fafb] shadow-xl transition-transform duration-300 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!open}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="text-sm font-medium text-foreground">Research</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-3">
          <Button
            variant="outline"
            className="w-full justify-center"
            size="sm"
            onClick={() => {
              onNewSession();
              onOpenChange(false);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {sessionsLoading ? (
            <div
              className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
              Loading sessions…
            </div>
          ) : null}
          {projectSelected ? (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sessions
              </p>
              <ul className="space-y-1">
                {sessions.map((s) => (
                  <li key={s.session_id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSession(s.session_id);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "w-full max-w-full rounded-md px-2 py-2 text-left text-sm leading-snug break-words",
                        s.session_id === selectedSessionId
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-foreground hover:bg-muted"
                      )}
                      title={s.session_id}
                    >
                      {s.title?.trim() || s.session_id}
                    </button>
                  </li>
                ))}
              </ul>
              {!sessionsLoading && sessions.length === 0 ? (
                <p className="mt-2 px-1 text-sm text-muted-foreground">
                  No sessions yet. Submit a question to start.
                </p>
              ) : null}
            </>
          ) : null}
          {!projectSelected ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Select a project in the header to see sessions.
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
}

export function ResearchChatPage() {
  const router = useRouter();
  const {
    selectedProjectJobId,
    completedStepProjects: catalogProjects,
    completedStepsLoading: catalogProjectsLoading,
  } = useResearchProject();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [sidebarSessionsLoading, setSidebarSessionsLoading] = useState(false);
  const [sessionCatalogByJob, setSessionCatalogByJob] = useState<
    Record<string, ChatSessionListEntry[]>
  >({});
  const [selectedSessionIdByJob, setSelectedSessionIdByJob] = useState<
    Record<string, string>
  >({});
  const [chatByJobId, setChatByJobId] = useState<Record<string, StoredChat>>({});
  const [researchSessions, setResearchSessions] = useState<Record<string, string>>(
    {}
  );
  const [hydrated, setHydrated] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [sourcesDrawerOpen, setSourcesDrawerOpen] = useState(false);
  const [sourcesDrawerContexts, setSourcesDrawerContexts] = useState<unknown>(
    undefined
  );
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatCacheRef = useRef<Record<string, StoredChat>>({});
  const researchSessionsRef = useRef<Record<string, string>>({});
  const selectedSessionIdByJobRef = useRef<Record<string, string>>({});
  /** Tracks last loaded history so refresh does not refetch unnecessarily. */
  const loadedHistoryKeyRef = useRef<string | null>(null);
  /** Tracks last selected project to reset chat only on real project changes. */
  const lastProjectForClearRef = useRef<string | null>(null);

  const openSourcesDrawer = useCallback((ctx: unknown) => {
    setSourcesDrawerContexts(ctx);
    setSourcesDrawerOpen(true);
  }, []);

  const closeSourcesDrawer = useCallback(() => {
    setSourcesDrawerOpen(false);
  }, []);

  const replaceAssistantMessage = useCallback(
    (assistantId: string, patch: Partial<ChatMessageItem>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
      );
    },
    []
  );

  const createAndGoToNewSession = useCallback(() => {
    setIsTyping(false);
    setIsChatLoading(false);
    setActiveAssistantId(null);
    setInputValue("");
    setShowSources(false);
    setSourcesDrawerOpen(false);
    const pid = selectedProjectJobId.trim();
    if (pid) {
      loadedHistoryKeyRef.current = null;
      setResearchSessions((prev) => {
        const next = { ...prev };
        delete next[pid];
        researchSessionsRef.current = next;
        return next;
      });
      setSelectedSessionIdByJob((prev) => {
        const next = { ...prev };
        delete next[pid];
        selectedSessionIdByJobRef.current = next;
        return next;
      });
    }
    setMessages([]);
    setMobileSessionsOpen(false);
    router.push("/research");
  }, [router, selectedProjectJobId]);

  const hydrateChatFromResult = useCallback(
    (jobId: string, query: string, answer: string, contexts?: unknown) => {
      const sc = displayResearchSourceCount(contexts);
      setMessages([
        { id: `${jobId}-user`, role: "user", message: query },
        {
          id: `${jobId}-assistant`,
          role: "assistant",
          message: answer,
          ...(sc > 0 && contexts !== undefined
            ? { sourceContexts: contexts }
            : {}),
        },
      ]);
      setChatByJobId((prev) => ({
        ...prev,
        [jobId]: {
          query,
          refined_answer: answer,
          ...(sc > 0 && contexts !== undefined ? { contexts } : {}),
        },
      }));
    },
    []
  );

  const hydrateChatFromTurns = useCallback(
    (jobId: string, turns: StoredChatTurn[]) => {
      const msgs: ChatMessageItem[] = [];
      turns.forEach((t, i) => {
        msgs.push({
          id: `${jobId}-user-${i}`,
          role: "user",
          message: t.query,
        });
        const sc = displayResearchSourceCount(t.contexts);
        msgs.push({
          id: `${jobId}-asst-${i}`,
          role: "assistant",
          message: t.refined_answer,
          ...(sc > 0 && t.contexts !== undefined
            ? { sourceContexts: t.contexts }
            : {}),
        });
      });
      setMessages(msgs);
      const last = turns[turns.length - 1];
      const persistTurns =
        turns.length > 1 || countResearchSources(last.contexts) > 0;
      setChatByJobId((prev) => ({
        ...prev,
        [jobId]: persistTurns
          ? { query: last.query, refined_answer: last.refined_answer, turns }
          : { query: last.query, refined_answer: last.refined_answer },
      }));
    },
    []
  );

  const digestResearchResults = useCallback(
    (
      jobId: string,
      result: QueryResultResponse,
      pollAssistantId: string | null,
      options?: { updateMessages?: boolean; fallbackUserQuery?: string }
    ) => {
      const updateMessages = options?.updateMessages !== false;
      const fallbackUserQuery = options?.fallbackUserQuery?.trim() ?? "";
      console.log("[research] digest POST /query-neo4j", {
        job_id: jobId,
        result,
        pollAssistantId,
        updateMessages,
      });
      const query = result.outputs?.query?.trim() ?? "";
      const answer = displayAnswerFromOutputs(result.outputs);

      if (pollAssistantId) {
        if (!answer) {
          replaceAssistantMessage(pollAssistantId, {
            typing: false,
            error: true,
            message: "Completed, but no response text was returned.",
          });
        } else {
          const sc = displayResearchSourceCount(result.outputs?.contexts);
          replaceAssistantMessage(pollAssistantId, {
            typing: false,
            error: false,
            message: answer,
            ...(sc > 0 && result.outputs?.contexts !== undefined
              ? { sourceContexts: result.outputs.contexts }
              : {}),
          });
          const resolvedQuery = query || fallbackUserQuery;
          if (resolvedQuery) {
            setChatByJobId((prev) => ({
              ...prev,
              [jobId]: {
                query: resolvedQuery,
                refined_answer: answer,
                ...(sc > 0 && result.outputs?.contexts !== undefined
                  ? { contexts: result.outputs.contexts }
                  : {}),
              },
            }));
          }
        }
        return;
      }

      if (updateMessages && answer) {
        const fq =
          query || chatCacheRef.current[jobId]?.query || "";
        hydrateChatFromResult(jobId, fq, answer, result.outputs?.contexts);
      }
    },
    [hydrateChatFromResult, replaceAssistantMessage]
  );

  useEffect(() => {
    researchSessionsRef.current = researchSessions;
  }, [researchSessions]);

  useEffect(() => {
    selectedSessionIdByJobRef.current = selectedSessionIdByJob;
  }, [selectedSessionIdByJob]);

  useEffect(() => {
    const stored = readStoredChats();
    setChatByJobId(stored.chats);
    setResearchSessions(stored.sessions);
    researchSessionsRef.current = stored.sessions;
    const sess = { ...stored.sessions };
    setSelectedSessionIdByJob(sess);
    selectedSessionIdByJobRef.current = sess;
    chatCacheRef.current = stored.chats;
    setHydrated(true);
  }, []);

  useEffect(() => {
    chatCacheRef.current = chatByJobId;
  }, [chatByJobId]);

  useEffect(() => {
    if (!hydrated) return;
    const pid = selectedProjectJobId.trim();
    const prev = lastProjectForClearRef.current;
    lastProjectForClearRef.current = pid || null;
    if (prev !== null && prev !== (pid || null)) {
      loadedHistoryKeyRef.current = null;
      setIsTyping(false);
      setActiveAssistantId(null);
      setInputValue("");
      setSourcesDrawerOpen(false);
      setMessages([]);
    }
  }, [hydrated, selectedProjectJobId]);

  useEffect(() => {
    if (!selectedProjectJobId.trim()) {
      setSidebarSessionsLoading(false);
      return;
    }
    const projectId = selectedProjectJobId.trim();
    let cancelled = false;
    setSidebarSessionsLoading(true);
    void (async () => {
      try {
        const res = await fetchChatSessions(projectId);
        if (cancelled) return;
        const list = res.sessions ?? [];
        setSessionCatalogByJob((prev) => ({ ...prev, [projectId]: list }));
      } catch (e) {
        console.log("[research] fetchChatSessions failed", e);
        if (!cancelled) {
          setSessionCatalogByJob((prev) => {
            const next = { ...prev };
            delete next[projectId];
            return next;
          });
        }
      } finally {
        if (!cancelled) setSidebarSessionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectJobId]);

  /** After refresh: load `/chat-history` once for the persisted session (messages still empty). */
  useEffect(() => {
    if (!hydrated) return;
    if (isTyping) return;
    const pid = selectedProjectJobId.trim();
    if (!pid || sidebarSessionsLoading) return;
    const sessionId = (
      selectedSessionIdByJob[pid] ||
      researchSessions[pid] ||
      ""
    ).trim();
    if (!sessionId) return;
    if (messages.length > 0) return;

    const key = `${pid}|${sessionId}`;
    if (loadedHistoryKeyRef.current === key) return;

    let cancelled = false;
    setIsChatLoading(true);
    void (async () => {
      try {
        const turns = await fetchChatHistory(pid, sessionId);
        if (cancelled) return;
        loadedHistoryKeyRef.current = key;
        if (turns.length) {
          hydrateChatFromTurns(pid, turns);
        } else {
          setMessages([]);
        }
      } catch (e) {
        console.log("[research] fetchChatHistory (restore) failed", e);
      } finally {
        if (!cancelled) setIsChatLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    isTyping,
    selectedProjectJobId,
    sidebarSessionsLoading,
    selectedSessionIdByJob,
    researchSessions,
    messages.length,
    hydrateChatFromTurns,
  ]);

  /** Scroll the chat panel (not `scrollIntoView`) so the latest thread stays above the fixed mobile composer. */
  useLayoutEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const snap = () => {
      el.scrollTop = el.scrollHeight;
    };
    snap();
    requestAnimationFrame(() => {
      requestAnimationFrame(snap);
    });
  }, [messages]);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredChats({ chats: chatByJobId, sessions: researchSessions });
  }, [hydrated, chatByJobId, researchSessions]);

  const handleSend = useCallback(async () => {
    const prompt = inputValue.trim();
    if (!prompt || isTyping) return;

    const hadUserMessage = messages.some((m) => m.role === "user");
    let payloadJobId: string;
    let sessionIdForPayload: string | undefined;

    const projectJobId = selectedProjectJobId.trim();
    if (!projectJobId) {
      if (!hadUserMessage) return;
      toast.error("Select a project in the header to continue.");
      return;
    }

    if (!hadUserMessage) {
      payloadJobId = projectJobId;
      sessionIdForPayload = undefined;
    } else {
      const storedSession = (
        selectedSessionIdByJob[projectJobId] ||
        researchSessions[projectJobId] ||
        ""
      ).trim();
      if (!storedSession) {
        console.log("[research] follow-up submit: missing session_id", {
          projectJobId,
          researchSessions,
          selectedSessionIdByJob,
        });
        toast.error("Session missing. Start a new research session.");
        return;
      }
      payloadJobId = projectJobId;
      sessionIdForPayload = storedSession;
    }

    const userId = generateClientId("user");
    const assistantId = generateClientId("assistant");

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", message: prompt },
      { id: assistantId, role: "assistant", message: "Typing...", typing: true },
    ]);
    setInputValue("");
    setIsTyping(true);
    setIsChatLoading(false);
    setActiveAssistantId(assistantId);

    try {
      console.log("[research] POST /query-neo4j", {
        job_id: payloadJobId,
        session_id: sessionIdForPayload ?? "(omit)",
        query: prompt,
        show_sources: showSources,
      });
      const queued = await submitResearchQuery({
        job_id: payloadJobId,
        ...(sessionIdForPayload !== undefined
          ? { session_id: sessionIdForPayload }
          : {}),
        query: prompt,
        show_sources: showSources,
        show_combined: true,
        database: "neo4j",
      });
      console.log("[research] /query-neo4j response", queued);

      const statusNormalized = queued.status?.toLowerCase?.() ?? "";
      if (statusNormalized !== "success" && statusNormalized !== "completed") {
        replaceAssistantMessage(assistantId, {
          typing: false,
          error: true,
          message:
            queued.status?.trim() ||
            "The request did not complete successfully.",
        });
        setIsTyping(false);
        setActiveAssistantId(null);
        toast.error("Request failed.");
        router.push("/research");
        return;
      }

      if (!queued.interaction) {
        replaceAssistantMessage(assistantId, {
          typing: false,
          error: true,
          message: "No response content returned.",
        });
        setIsTyping(false);
        setActiveAssistantId(null);
        router.push("/research");
        return;
      }

      if (queued.session_id?.trim()) {
        const sid = queued.session_id.trim();
        setResearchSessions((prev) => {
          const next = { ...prev, [projectJobId]: sid };
          researchSessionsRef.current = next;
          return next;
        });
        setSelectedSessionIdByJob((prev) => ({
          ...prev,
          [projectJobId]: sid,
        }));
        selectedSessionIdByJobRef.current = {
          ...selectedSessionIdByJobRef.current,
          [projectJobId]: sid,
        };
      }

      const result: QueryResultResponse = {
        status: queued.status,
        outputs: {
          query: queued.interaction.query ?? prompt,
          refined_answer: queued.interaction.refined_answer,
          combined_answer: queued.interaction.combined_answer,
          contexts: queued.interaction.contexts,
        },
      };

      digestResearchResults(projectJobId, result, assistantId, {
        fallbackUserQuery: prompt,
      });
      setIsTyping(false);
      setActiveAssistantId(null);
      setShowSources(false);

      const sidForKey =
        queued.session_id?.trim() ||
        researchSessionsRef.current[projectJobId] ||
        "";
      if (sidForKey) {
        loadedHistoryKeyRef.current = `${projectJobId}|${sidForKey}`;
      }

      void (async () => {
        try {
          const res = await fetchChatSessions(projectJobId);
          const list = res.sessions ?? [];
          setSessionCatalogByJob((prev) => ({
            ...prev,
            [projectJobId]: list,
          }));
        } catch (e) {
          console.log("[research] fetchChatSessions after send failed", e);
        }
      })();

      router.push("/research");
    } catch (err) {
      console.log("[research] submitResearchQuery failed", err);
      replaceAssistantMessage(assistantId, {
        typing: false,
        error: true,
        message: "Sorry, I could not submit your question. Please try again.",
      });
      setIsTyping(false);
      setActiveAssistantId(null);
      toast.error("Failed to send query.");
    }
  }, [
    digestResearchResults,
    inputValue,
    isTyping,
    messages,
    replaceAssistantMessage,
    researchSessions,
    router,
    selectedProjectJobId,
    selectedSessionIdByJob,
    showSources,
  ]);

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      const projectJobId = selectedProjectJobId.trim();
      if (!projectJobId) return;
      const sid = sessionId.trim();
      if (!sid) return;
      console.log("[research] sidebar select session", {
        job_id: projectJobId,
        session_id: sid,
      });
      selectedSessionIdByJobRef.current = {
        ...selectedSessionIdByJobRef.current,
        [projectJobId]: sid,
      };
      setSelectedSessionIdByJob((prev) => ({
        ...prev,
        [projectJobId]: sid,
      }));
      setResearchSessions((prev) => {
        const next = { ...prev, [projectJobId]: sid };
        researchSessionsRef.current = next;
        return next;
      });
      setIsChatLoading(true);
      try {
        const turns = await fetchChatHistory(projectJobId, sid);
        loadedHistoryKeyRef.current = `${projectJobId}|${sid}`;
        if (turns.length) {
          hydrateChatFromTurns(projectJobId, turns);
        } else {
          setMessages([]);
        }
      } catch (e) {
        console.log("[research] handleSelectSession fetchChatHistory failed", e);
      } finally {
        setIsChatLoading(false);
      }
    },
    [selectedProjectJobId, hydrateChatFromTurns]
  );

  const hasMessages = messages.length > 0;

  const projectJobIdForSidebar = selectedProjectJobId.trim();
  const sidebarSessionsList: ChatSessionListEntry[] = projectJobIdForSidebar
    ? sessionCatalogByJob[projectJobIdForSidebar] ?? []
    : [];
  const sidebarSelectedSessionId: string | null = projectJobIdForSidebar
    ? selectedSessionIdByJob[projectJobIdForSidebar] ??
      researchSessions[projectJobIdForSidebar] ??
      null
    : null;

  const showProjectPicker = !messages.some((m) => m.role === "user");
  const projectSelectOk =
    Boolean(projectJobIdForSidebar) &&
    catalogProjects.some((p) => p.job_id === projectJobIdForSidebar);
  const blockSendForProject =
    showProjectPicker &&
    (!projectSelectOk || catalogProjectsLoading || catalogProjects.length === 0);

  const isRecordNotFoundView =
    hydrated &&
    messages.length === 1 &&
    messages[0].role === "assistant" &&
    Boolean(messages[0].error) &&
    messages[0].message === "No conversation found";

  const isNewSessionView =
    hydrated && !isChatLoading && !isTyping && messages.length === 0;

  const useCenteredInputLayout = isNewSessionView || isRecordNotFoundView;

  const showChatThread =
    (hasMessages || isChatLoading) && !isRecordNotFoundView;

  return (
    <DashboardLayout
      title="Research"
      subtitle="Your intelligent research partner."
    >
      <ResearchSourcesDrawer
        open={sourcesDrawerOpen}
        onClose={closeSourcesDrawer}
        contexts={sourcesDrawerContexts}
        projectJobId={selectedProjectJobId}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden lg:flex-row">
        <MobileSessionsDrawer
          open={mobileSessionsOpen}
          onOpenChange={setMobileSessionsOpen}
          onNewSession={createAndGoToNewSession}
          projectSelected={Boolean(projectJobIdForSidebar)}
          sessionsLoading={sidebarSessionsLoading}
          sessions={sidebarSessionsList}
          selectedSessionId={sidebarSelectedSessionId}
          onSelectSession={handleSelectSession}
        />
        <ResearchSidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          onNewSession={createAndGoToNewSession}
          projectSelected={Boolean(projectJobIdForSidebar)}
          sessionsLoading={sidebarSessionsLoading}
          sessions={sidebarSessionsList}
          selectedSessionId={sidebarSelectedSessionId}
          onSelectSession={handleSelectSession}
        />
        <PageContainer className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-start overflow-x-hidden overflow-y-hidden bg-[#f8fafc] py-3 sm:py-4 md:py-6">
          <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-5xl flex-1 flex-col px-2 sm:px-3 md:px-4">
            <button
              type="button"
              onClick={() => setMobileSessionsOpen(true)}
              className="mb-3 inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted lg:hidden"
            >
              <PanelLeft className="h-4 w-4 shrink-0" />
              Menu
            </button>

            {useCenteredInputLayout ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 py-6 md:py-10">
                <div className="w-full max-w-xl px-1 text-center">
                  <h1 className="text-2xl font-semibold text-foreground">
                    Your Intelligent Research Partner
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Ask anything about your documents, answer bank, or the web.
                  </p>
                  {isRecordNotFoundView ? (
                    <p
                      className="mt-4 text-sm font-medium text-destructive"
                      role="alert"
                    >
                      No conversation found for this session.
                    </p>
                  ) : null}
                </div>
                <div className="w-full max-w-[860px] shrink-0">
                  <ChatInput
                    value={inputValue}
                    onChange={setInputValue}
                    onSend={() => void handleSend()}
                    disabled={isTyping}
                    blockSendForProject={blockSendForProject}
                    showSources={showSources}
                    onToggleShowSources={() =>
                      setShowSources((prev) => !prev)
                    }
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex w-full shrink-0 flex-col items-stretch gap-3 sm:items-center">
                  <h1 className="text-center text-2xl font-semibold text-foreground">
                    Your Intelligent Research Partner
                  </h1>
                  <p className="text-center text-sm text-muted-foreground">
                    Ask anything about your documents, answer bank, or the web.
                  </p>
                </div>
                <div className="mx-auto mt-4 flex min-h-0 w-full max-w-[860px] flex-1 flex-col gap-0 md:mt-6">
                  {showChatThread ? (
                    <ChatContainer>
                      <div
                        ref={chatScrollRef}
                        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 py-4 sm:px-4 md:px-6 md:py-5 lg:max-h-[60vh]"
                      >
                        {isChatLoading ? (
                          <ChatSkeleton />
                        ) : (
                          <div className="space-y-3 md:space-y-4">
                            {messages.map((item) => (
                              <ChatMessage
                                key={item.id}
                                item={item}
                                onOpenSources={openSourcesDrawer}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </ChatContainer>
                  ) : (
                    <div className="min-h-0 flex-1 lg:min-h-0" aria-hidden />
                  )}

                  <div
                    className={cn(
                      "w-full min-w-0 shrink-0 border-t border-border/80 bg-[#f8fafc] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_24px_-16px_rgba(15,23,42,0.08)]",
                      "lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
                    )}
                  >
                    <div className="mx-auto w-full min-w-0 max-w-[860px]">
                      <ChatInput
                        value={inputValue}
                        onChange={setInputValue}
                        onSend={() => void handleSend()}
                        disabled={isTyping}
                        blockSendForProject={blockSendForProject}
                        showSources={showSources}
                        onToggleShowSources={() =>
                          setShowSources((prev) => !prev)
                        }
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </PageContainer>
      </div>
    </DashboardLayout>
  );
}

