"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  fetchResearchQueryResult,
  fetchResearchQueryStatus,
  submitResearchQuery,
} from "@/services/researchService";
import type { QueryResultResponse } from "@/services/researchService";
import { useCompletedStepProjects } from "@/hooks/useCompletedStepProjects";
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

function parseChatSessionsFromOutputs(
  outputs: unknown
): Record<string, StoredChatTurn[]> | null {
  if (!outputs || typeof outputs !== "object") return null;
  const o = outputs as Record<string, unknown>;
  const cs = o.chat_sessions;
  if (!cs || typeof cs !== "object" || Array.isArray(cs)) return null;
  const out: Record<string, StoredChatTurn[]> = {};
  for (const [sid, arr] of Object.entries(cs as Record<string, unknown>)) {
    if (!Array.isArray(arr)) continue;
    const turns: StoredChatTurn[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const q = typeof row.query === "string" ? row.query.trim() : "";
      const a =
        typeof row.refined_answer === "string" ? row.refined_answer.trim() : "";
      if (q || a) {
        const t: StoredChatTurn = { query: q, refined_answer: a };
        if ("contexts" in row) t.contexts = row.contexts;
        turns.push(t);
      }
    }
    if (turns.length) out[sid] = turns;
  }
  return Object.keys(out).length ? out : null;
}

function pickActiveChatSession(
  sessions: Record<string, StoredChatTurn[]>,
  preferredSessionId: string | undefined,
  topQuery: string,
  topAnswer: string
): { sessionId: string; turns: StoredChatTurn[] } | null {
  const keys = Object.keys(sessions).filter((k) => sessions[k].length > 0);
  if (!keys.length) return null;

  if (preferredSessionId && sessions[preferredSessionId]?.length) {
    return {
      sessionId: preferredSessionId,
      turns: sessions[preferredSessionId],
    };
  }

  if (keys.length === 1) {
    const sessionId = keys[0];
    return { sessionId, turns: sessions[sessionId] };
  }

  const tq = topQuery.trim();
  const ta = topAnswer.trim();
  if (tq || ta) {
    for (const sid of keys) {
      const turns = sessions[sid];
      const last = turns[turns.length - 1];
      if (last && last.query === tq && last.refined_answer === ta) {
        return { sessionId: sid, turns };
      }
    }
    if (ta) {
      for (const sid of keys) {
        const turns = sessions[sid];
        const last = turns[turns.length - 1];
        if (last && last.refined_answer === ta) {
          return { sessionId: sid, turns };
        }
      }
    }
  }

  let bestKey = keys[0];
  let bestLen = sessions[bestKey].length;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    const len = sessions[k].length;
    if (len > bestLen) {
      bestLen = len;
      bestKey = k;
    }
  }
  return { sessionId: bestKey, turns: sessions[bestKey] };
}

/** If API top-level outputs are newer than the last row in chat_sessions, append one turn. */
function mergeTopLevelIntoTurns(
  turns: StoredChatTurn[],
  topQuery: string,
  topAnswer: string
): StoredChatTurn[] {
  const tq = topQuery.trim();
  const ta = topAnswer.trim();
  if (!ta && !tq) return turns;

  if (turns.length === 0) {
    return [{ query: tq, refined_answer: ta }];
  }

  const last = turns[turns.length - 1];
  if (last.refined_answer === ta && (!tq || last.query === tq)) {
    return turns;
  }
  if (last.refined_answer === ta) {
    return turns;
  }
  return [...turns, { query: tq || last.query || "", refined_answer: ta }];
}

function mergedTurnsFromResult(
  result: QueryResultResponse,
  preferredSessionId: string | undefined
): StoredChatTurn[] | null {
  const sessionMap = parseChatSessionsFromOutputs(result.outputs);
  if (!sessionMap || Object.keys(sessionMap).length === 0) return null;
  const query = result.outputs?.query?.trim() ?? "";
  const answer = result.outputs?.refined_answer?.trim() ?? "";
  const picked = pickActiveChatSession(
    sessionMap,
    preferredSessionId,
    query,
    answer
  );
  if (!picked) return null;
  const merged = mergeTopLevelIntoTurns(picked.turns, query, answer);
  return withLatestTurnContexts(merged, result.outputs?.contexts);
}

function turnsIncludeUserQuery(turns: StoredChatTurn[], userQuery: string): boolean {
  const t = userQuery.trim();
  if (!t) return true;
  return turns.some((x) => x.query.trim() === t);
}

/** Attach top-level `/results` `outputs.contexts` to the latest assistant turn. */
function withLatestTurnContexts(
  turns: StoredChatTurn[],
  contexts: unknown
): StoredChatTurn[] {
  if (!turns.length || countResearchSources(contexts) === 0) return turns;
  const last = turns.length - 1;
  return turns.map((t, i) =>
    i === last ? { ...t, contexts } : t
  );
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
    <div className="w-full rounded-[1.75rem] border border-border/80 bg-card p-4 shadow-md">
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
        className="min-h-[72px] w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70"
        rows={2}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
          >
            Research
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleShowSources}
            aria-pressed={showSources}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              showSources
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "border border-input bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Source Providers
          </button>
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim() || blockSendForProject}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
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
        "flex w-full min-h-0 flex-1 flex-col rounded-3xl border border-slate-200 bg-[#f9fafb] shadow-sm",
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
  sessionIds,
  selectedSessionId,
  onSelectSession,
}: {
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  onNewSession: () => void;
  projectSelected: boolean;
  sessionsLoading: boolean;
  sessionIds: string[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}) {
  const showEmptyHint = !projectSelected;
  const showNoSessions =
    projectSelected && !sessionsLoading && sessionIds.length === 0;

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
                  {sessionIds.map((sid) => (
                    <li key={sid}>
                      <button
                        type="button"
                        onClick={() => onSelectSession(sid)}
                        className={cn(
                          "w-full max-w-full rounded-md px-2 py-2 text-left font-mono text-[11px] leading-snug break-all whitespace-normal",
                          sid === selectedSessionId
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground hover:bg-muted"
                        )}
                        title={sid}
                      >
                        {sid}
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
  sessionIds,
  selectedSessionId,
  onSelectSession,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewSession: () => void;
  projectSelected: boolean;
  sessionsLoading: boolean;
  sessionIds: string[];
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
                {sessionIds.map((sid) => (
                  <li key={sid}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSession(sid);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "w-full max-w-full rounded-md px-2 py-2 text-left font-mono text-[11px] leading-snug break-all whitespace-normal",
                        sid === selectedSessionId
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-foreground hover:bg-muted"
                      )}
                      title={sid}
                    >
                      {sid}
                    </button>
                  </li>
                ))}
              </ul>
              {!sessionsLoading && sessionIds.length === 0 ? (
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
  const { selectedProjectJobId } = useResearchProject();

  const { projects: catalogProjects, loading: catalogProjectsLoading } =
    useCompletedStepProjects();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [sidebarSessionsLoading, setSidebarSessionsLoading] = useState(false);
  const [chatSessionsMapByJob, setChatSessionsMapByJob] = useState<
    Record<string, Record<string, StoredChatTurn[]>>
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
  /** Project job_id used for GET /status and /results while a query is in flight. */
  const [pendingPollProjectJobId, setPendingPollProjectJobId] = useState<
    string | null
  >(null);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatCacheRef = useRef<Record<string, StoredChat>>({});
  const researchSessionsRef = useRef<Record<string, string>>({});
  const selectedSessionIdByJobRef = useRef<Record<string, string>>({});
  const chatSessionsMapByJobRef = useRef<
    Record<string, Record<string, StoredChatTurn[]>>
  >({});
  /** Tracks last selected project to reset chat only on real project changes. */
  const lastProjectForClearRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

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
    stopPolling();
    setIsTyping(false);
    setIsChatLoading(false);
    setPendingPollProjectJobId(null);
    setPendingPrompt("");
    setActiveAssistantId(null);
    setInputValue("");
    setShowSources(false);
    setSourcesDrawerOpen(false);
    const pid = selectedProjectJobId.trim();
    if (pid) {
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
  }, [router, stopPolling, selectedProjectJobId]);

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
      console.log("[research] digest /results", {
        job_id: jobId,
        result,
        pollAssistantId,
        updateMessages,
      });
      const query = result.outputs?.query?.trim() ?? "";
      const answer = result.outputs?.refined_answer?.trim() ?? "";
      const sessionMap = parseChatSessionsFromOutputs(result.outputs);
      const hasSessions = Boolean(
        sessionMap && Object.keys(sessionMap).length > 0
      );

      if (hasSessions && sessionMap) {
        setChatSessionsMapByJob((prev) => ({ ...prev, [jobId]: sessionMap }));
        if (!updateMessages) {
          return;
        }
        const preferred =
          researchSessionsRef.current[jobId] ||
          selectedSessionIdByJobRef.current[jobId];
        const picked = pickActiveChatSession(
          sessionMap,
          preferred,
          query,
          answer
        );
        if (picked) {
          const turns = withLatestTurnContexts(
            mergeTopLevelIntoTurns(picked.turns, query, answer),
            result.outputs?.contexts
          );
          console.log("[research] chat_sessions", {
            job_id: jobId,
            session_id: picked.sessionId,
            turnsCount: turns.length,
          });
          setResearchSessions((prev) => {
            const next = { ...prev, [jobId]: picked.sessionId };
            researchSessionsRef.current = next;
            return next;
          });
          setSelectedSessionIdByJob((prev) => ({
            ...prev,
            [jobId]: picked.sessionId,
          }));
          if (turns.length) {
            hydrateChatFromTurns(jobId, turns);
          } else if (answer) {
            hydrateChatFromResult(
              jobId,
              query || "",
              answer,
              result.outputs?.contexts
            );
          }
          return;
        }
      }

      setChatSessionsMapByJob((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });

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
    [
      hydrateChatFromResult,
      hydrateChatFromTurns,
      replaceAssistantMessage,
    ]
  );

  useEffect(() => {
    researchSessionsRef.current = researchSessions;
  }, [researchSessions]);

  useEffect(() => {
    selectedSessionIdByJobRef.current = selectedSessionIdByJob;
  }, [selectedSessionIdByJob]);

  useEffect(() => {
    chatSessionsMapByJobRef.current = chatSessionsMapByJob;
  }, [chatSessionsMapByJob]);

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
      stopPolling();
      setIsTyping(false);
      setPendingPollProjectJobId(null);
      setPendingPrompt("");
      setActiveAssistantId(null);
      setInputValue("");
      setSourcesDrawerOpen(false);
      setMessages([]);
    }
  }, [hydrated, selectedProjectJobId, stopPolling]);

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
        const result = await fetchResearchQueryResult(projectId);
        if (cancelled) return;
        const map = parseChatSessionsFromOutputs(result.outputs);
        if (map && Object.keys(map).length > 0) {
          setChatSessionsMapByJob((prev) => ({ ...prev, [projectId]: map }));
        } else {
          setChatSessionsMapByJob((prev) => {
            const next = { ...prev };
            delete next[projectId];
            return next;
          });
        }
      } catch {
        if (!cancelled) {
          setChatSessionsMapByJob((prev) => {
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

  /** After refresh: reload thread for persisted session once `/results` map is available. */
  useEffect(() => {
    if (!hydrated) return;
    if (isTyping || pendingPollProjectJobId) return;
    const pid = selectedProjectJobId.trim();
    if (!pid || sidebarSessionsLoading) return;
    const sessionId = (
      selectedSessionIdByJob[pid] ||
      researchSessions[pid] ||
      ""
    ).trim();
    if (!sessionId) return;
    const turns = chatSessionsMapByJob[pid]?.[sessionId];
    if (!turns?.length) return;
    if (messages.length > 0) return;

    hydrateChatFromTurns(pid, turns);
  }, [
    hydrated,
    isTyping,
    pendingPollProjectJobId,
    selectedProjectJobId,
    sidebarSessionsLoading,
    chatSessionsMapByJob,
    researchSessions,
    selectedSessionIdByJob,
    messages.length,
    hydrateChatFromTurns,
  ]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredChats({ chats: chatByJobId, sessions: researchSessions });
  }, [hydrated, chatByJobId, researchSessions]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

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
    setPendingPrompt(prompt);

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
        show_combined: false,
        database: "neo4j",
      });
      console.log("[research] /query-neo4j response", queued);
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
      setPendingPollProjectJobId(projectJobId);
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
      setPendingPollProjectJobId(null);
      setPendingPrompt("");
      toast.error("Failed to send query.");
    }
  }, [
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
    (sessionId: string) => {
      const projectJobId = selectedProjectJobId.trim();
      if (!projectJobId) return;
      const map = chatSessionsMapByJobRef.current[projectJobId];
      const turns = map?.[sessionId];
      if (!turns?.length) return;
      console.log("[research] sidebar select session", {
        job_id: projectJobId,
        session_id: sessionId,
      });
      selectedSessionIdByJobRef.current = {
        ...selectedSessionIdByJobRef.current,
        [projectJobId]: sessionId,
      };
      setSelectedSessionIdByJob((prev) => ({
        ...prev,
        [projectJobId]: sessionId,
      }));
      setResearchSessions((prev) => {
        const next = { ...prev, [projectJobId]: sessionId };
        researchSessionsRef.current = next;
        return next;
      });
      hydrateChatFromTurns(projectJobId, turns);
    },
    [selectedProjectJobId, hydrateChatFromTurns]
  );

  useEffect(() => {
    if (!pendingPollProjectJobId || !activeAssistantId) return;

    let cancelled = false;
    const projectJobId = pendingPollProjectJobId;

    const pollOnce = async () => {
      try {
        const status = await fetchResearchQueryStatus(projectJobId);
        if (cancelled) return;
        console.log("[research] /status response", {
          job_id: projectJobId,
          status,
        });

        const normalized = status.status?.toLowerCase?.() ?? "";
        if (normalized === "success" || normalized === "completed") {
          let result = await fetchResearchQueryResult(projectJobId);
          if (cancelled) return;
          const pendingQ = pendingPrompt.trim();
          if (pendingQ) {
            const merged = mergedTurnsFromResult(
              result,
              researchSessionsRef.current[projectJobId]
            );
            if (
              merged &&
              !turnsIncludeUserQuery(merged, pendingQ)
            ) {
              await new Promise((r) => setTimeout(r, 750));
              if (cancelled) return;
              result = await fetchResearchQueryResult(projectJobId);
              if (cancelled) return;
            }
          }
          console.log("[research] poll /status success → /results", {
            job_id: projectJobId,
            result,
          });
          digestResearchResults(projectJobId, result, activeAssistantId, {
            fallbackUserQuery: pendingPrompt,
          });
          setIsTyping(false);
          setPendingPollProjectJobId(null);
          setPendingPrompt("");
          setActiveAssistantId(null);
          stopPolling();
          return;
        }

        if (normalized === "failed" || normalized === "error") {
          replaceAssistantMessage(activeAssistantId, {
            typing: false,
            error: true,
            message: "The request failed while processing. Please try again.",
          });
          setIsTyping(false);
          setPendingPollProjectJobId(null);
          setPendingPrompt("");
          setActiveAssistantId(null);
          stopPolling();
          return;
        }

        pollingTimerRef.current = setTimeout(pollOnce, 2500);
      } catch {
        if (cancelled) return;
        replaceAssistantMessage(activeAssistantId, {
          typing: false,
          error: true,
          message: "Could not fetch the response status. Please try again.",
        });
        setIsTyping(false);
        setPendingPollProjectJobId(null);
        setPendingPrompt("");
        setActiveAssistantId(null);
        stopPolling();
      }
    };

    void pollOnce();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [
    pendingPollProjectJobId,
    activeAssistantId,
    replaceAssistantMessage,
    stopPolling,
    pendingPrompt,
    digestResearchResults,
  ]);

  const hasMessages = messages.length > 0;

  const projectJobIdForSidebar = selectedProjectJobId.trim();
  const sidebarSessionIds = projectJobIdForSidebar
    ? Object.keys(chatSessionsMapByJob[projectJobIdForSidebar] ?? {})
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
      <div className="flex min-h-[calc(100dvh-4rem)] min-w-0 flex-col lg:flex-row">
        <MobileSessionsDrawer
          open={mobileSessionsOpen}
          onOpenChange={setMobileSessionsOpen}
          onNewSession={createAndGoToNewSession}
          projectSelected={Boolean(projectJobIdForSidebar)}
          sessionsLoading={sidebarSessionsLoading}
          sessionIds={sidebarSessionIds}
          selectedSessionId={sidebarSelectedSessionId}
          onSelectSession={handleSelectSession}
        />
        <ResearchSidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          onNewSession={createAndGoToNewSession}
          projectSelected={Boolean(projectJobIdForSidebar)}
          sessionsLoading={sidebarSessionsLoading}
          sessionIds={sidebarSessionIds}
          selectedSessionId={sidebarSelectedSessionId}
          onSelectSession={handleSelectSession}
        />
        <PageContainer className="flex min-h-0 flex-1 flex-col items-center justify-start overflow-x-hidden overflow-y-hidden bg-[#f8fafc] py-4 md:py-6 lg:min-h-[calc(100dvh-4rem)]">
          <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col px-3 md:px-4">
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
                <div className="mx-auto mt-4 flex min-h-0 w-full max-w-[860px] flex-1 flex-col gap-4 md:mt-6">
                  {showChatThread ? (
                    <ChatContainer>
                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 max-lg:pb-[14rem] md:px-6 md:py-5 lg:max-h-[60vh] lg:pb-4">
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
                            <div ref={chatBottomRef} />
                          </div>
                        )}
                      </div>
                    </ChatContainer>
                  ) : (
                    <div className="min-h-0 flex-1 lg:min-h-0" aria-hidden />
                  )}

                  <div
                    className={cn(
                      "z-20 w-full shrink-0",
                      "max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:border-t max-lg:border-border/80 max-lg:bg-[#f8fafc] max-lg:px-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:pt-3",
                      "lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0"
                    )}
                  >
                    <div className="mx-auto w-full max-w-[860px]">
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

