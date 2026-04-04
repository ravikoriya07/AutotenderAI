"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  type QueryResultResponse,
} from "@/services/researchService";
import type { CompletedStepProject } from "@/services/statsService";
import { useCompletedStepProjects } from "@/hooks/useCompletedStepProjects";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";

type ChatMessageItem = {
  id: string;
  role: ChatRole;
  message: string;
  typing?: boolean;
  error?: boolean;
};

type StoredChatTurn = {
  query: string;
  refined_answer: string;
};

type StoredChat = {
  query: string;
  refined_answer: string;
  /** Present when multiple turns were loaded from `/results` `chat_sessions`. */
  turns?: StoredChatTurn[];
};

type JobChatStore = {
  jobIds: string[];
  chats: Record<string, StoredChat>;
  /** research job_id → Neo4j session_id from /query-neo4j */
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
  if (typeof window === "undefined")
    return { jobIds: [], chats: {}, sessions: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { jobIds: [], chats: {}, sessions: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object")
      return { jobIds: [], chats: {}, sessions: {} };
    const o = parsed as Record<string, unknown>;
    const jobIds = Array.isArray(o.jobIds)
      ? o.jobIds.filter((id): id is string => typeof id === "string")
      : [];
    const chatsRaw =
      o.chats && typeof o.chats === "object"
        ? (o.chats as Record<string, unknown>)
        : {};
    const chats: Record<string, StoredChat> = {};
    for (const id of jobIds) {
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
            parsed.push({ query: tr.query, refined_answer: tr.refined_answer });
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
        chats[id] = { query: c.query, refined_answer: c.refined_answer };
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
    return { jobIds, chats, sessions };
  } catch {
    return { jobIds: [], chats: {}, sessions: {} };
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
      if (q || a) turns.push({ query: q, refined_answer: a });
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
  return mergeTopLevelIntoTurns(picked.turns, query, answer);
}

function turnsIncludeUserQuery(turns: StoredChatTurn[], userQuery: string): boolean {
  const t = userQuery.trim();
  if (!t) return true;
  return turns.some((x) => x.query.trim() === t);
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

function ChatMessage({ item }: { item: ChatMessageItem }) {
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

  return (
    <div
      className={cn("group flex w-full", user ? "justify-end" : "justify-start")}
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
    </div>
  );
}

function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  showProjectPicker,
  catalogProjects,
  catalogProjectsLoading,
  selectedProjectJobId,
  onProjectJobIdChange,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  showProjectPicker: boolean;
  catalogProjects: CompletedStepProject[];
  catalogProjectsLoading: boolean;
  selectedProjectJobId: string;
  onProjectJobIdChange: (jobId: string) => void;
}) {
  const selectValue =
    selectedProjectJobId &&
    catalogProjects.some((p) => p.job_id === selectedProjectJobId)
      ? selectedProjectJobId
      : "";

  const firstSendBlocked =
    showProjectPicker &&
    (!selectValue || catalogProjectsLoading || catalogProjects.length === 0);

  return (
    <div className="w-full rounded-[1.75rem] border border-border/80 bg-card p-4 shadow-md">
      {showProjectPicker ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {catalogProjectsLoading ? (
            <div
              className="flex h-8 max-w-[11rem] items-center gap-2"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                Loading projects…
              </span>
            </div>
          ) : (
            <div className="flex max-w-[11rem] shrink-0 items-center gap-1.5 sm:max-w-[13rem]">
              <select
                aria-label="Select project"
                value={selectValue}
                onChange={(e) => onProjectJobIdChange(e.target.value)}
                disabled={catalogProjects.length === 0}
                className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {catalogProjects.length === 0
                    ? "No projects available"
                    : "Select project"}
                </option>
                {catalogProjects.map((p) => (
                  <option key={p.job_id} value={p.job_id}>
                    {p.project_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : null}
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
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-transparent px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Source Providers
          </button>
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim() || firstSendBlocked}
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
  recentJobIds,
  onSelectRecentJob,
  researchJobId,
  sessionIds,
  selectedSessionId,
  onSelectSession,
}: {
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  onNewSession: () => void;
  recentJobIds: string[];
  onSelectRecentJob: (jobId: string) => void;
  researchJobId: string | null;
  sessionIds: string[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}) {
  const hasRecent = recentJobIds.length > 0;
  const showCurrentDetail = Boolean(researchJobId);
  const showEmptyHint = !hasRecent && !showCurrentDetail;

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
            {hasRecent ? (
              <>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Recent chats
                </p>
                <ul className="space-y-1">
                  {recentJobIds.map((jid) => (
                    <li key={jid}>
                      <button
                        type="button"
                        onClick={() => onSelectRecentJob(jid)}
                        className={cn(
                          "w-full truncate rounded-md px-2 py-2 text-left font-mono text-xs",
                          jid === researchJobId
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground hover:bg-muted"
                        )}
                        title={jid}
                      >
                        {jid.slice(0, 8)}…
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {showCurrentDetail ? (
              <>
                {hasRecent ? (
                  <hr className="my-4 border-border" aria-hidden />
                ) : null}
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Job id
                </p>
                <p
                  className="mb-4 truncate rounded-md border border-border bg-card px-2 py-2 font-mono text-xs text-foreground"
                  title={researchJobId ?? undefined}
                >
                  {researchJobId}
                </p>
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
                          "w-full truncate rounded-md px-2 py-2 text-left font-mono text-xs",
                          sid === selectedSessionId
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground hover:bg-muted"
                        )}
                        title={sid}
                      >
                        {sid.slice(0, 8)}…
                      </button>
                    </li>
                  ))}
                  {sessionIds.length === 0 ? (
                    <li className="px-2 py-2 text-sm text-muted-foreground">
                      Open results to load sessions
                    </li>
                  ) : null}
                </ul>
              </>
            ) : null}
            {showEmptyHint ? (
              <p className="px-1 text-sm text-muted-foreground">
                No chats yet. Submit a question to start.
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
  recentJobIds,
  onSelectRecentJob,
  researchJobId,
  sessionIds,
  selectedSessionId,
  onSelectSession,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewSession: () => void;
  recentJobIds: string[];
  onSelectRecentJob: (jobId: string) => void;
  researchJobId: string | null;
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
          {recentJobIds.length > 0 ? (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recent chats
              </p>
              <ul className="space-y-1">
                {recentJobIds.map((jid) => (
                  <li key={jid}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectRecentJob(jid);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "w-full truncate rounded-md px-2 py-2 text-left font-mono text-xs",
                        jid === researchJobId
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-foreground hover:bg-muted"
                      )}
                      title={jid}
                    >
                      {jid.slice(0, 8)}…
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {researchJobId ? (
            <>
              {recentJobIds.length > 0 ? (
                <hr className="my-4 border-border" aria-hidden />
              ) : null}
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Job id
              </p>
              <p
                className="mb-4 break-all rounded-md border border-border bg-card px-2 py-2 font-mono text-[10px] leading-snug text-foreground"
                title={researchJobId}
              >
                {researchJobId}
              </p>
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
                        "w-full truncate rounded-md px-2 py-2 text-left font-mono text-xs",
                        sid === selectedSessionId
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-foreground hover:bg-muted"
                      )}
                      title={sid}
                    >
                      {sid.slice(0, 8)}…
                    </button>
                  </li>
                ))}
                {sessionIds.length === 0 ? (
                  <li className="px-2 py-2 text-sm text-muted-foreground">
                    Open results to load sessions
                  </li>
                ) : null}
              </ul>
            </>
          ) : null}
          {recentJobIds.length === 0 && !researchJobId ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No chats yet. Submit a question to start.
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
}

export function ResearchChatPage() {
  const router = useRouter();
  const params = useParams<{ sessionId?: string }>();

  const { projects: catalogProjects, loading: catalogProjectsLoading } =
    useCompletedStepProjects();
  const [selectedProjectJobId, setSelectedProjectJobId] = useState("");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [jobIds, setJobIds] = useState<string[]>([]);
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
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const pendingJobIdRef = useRef<string | null>(null);
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

  const routeJobId = typeof params?.sessionId === "string" ? params.sessionId : null;

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
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
    setPendingJobId(null);
    setPendingPrompt("");
    setActiveAssistantId(null);
    setInputValue("");
    setSelectedProjectJobId("");
    setActiveJobId(null);
    setMessages([]);
    setMobileSessionsOpen(false);
    router.push("/research");
  }, [router, stopPolling]);

  const hydrateChatFromResult = useCallback((jobId: string, query: string, answer: string) => {
    setMessages([
      { id: `${jobId}-user`, role: "user", message: query },
      { id: `${jobId}-assistant`, role: "assistant", message: answer },
    ]);
    setChatByJobId((prev) => ({
      ...prev,
      [jobId]: { query, refined_answer: answer },
    }));
  }, []);

  const hydrateChatFromTurns = useCallback(
    (jobId: string, turns: StoredChatTurn[]) => {
      const msgs: ChatMessageItem[] = [];
      turns.forEach((t, i) => {
        msgs.push({
          id: `${jobId}-user-${i}`,
          role: "user",
          message: t.query,
        });
        msgs.push({
          id: `${jobId}-asst-${i}`,
          role: "assistant",
          message: t.refined_answer,
        });
      });
      setMessages(msgs);
      const last = turns[turns.length - 1];
      setChatByJobId((prev) => ({
        ...prev,
        [jobId]:
          turns.length > 1
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
          const turns = mergeTopLevelIntoTurns(picked.turns, query, answer);
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
            hydrateChatFromResult(jobId, query || "", answer);
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
          replaceAssistantMessage(pollAssistantId, {
            typing: false,
            error: false,
            message: answer,
          });
          const resolvedQuery = query || fallbackUserQuery;
          if (resolvedQuery) {
            setChatByJobId((prev) => ({
              ...prev,
              [jobId]: {
                query: resolvedQuery,
                refined_answer: answer,
              },
            }));
          }
        }
        return;
      }

      if (updateMessages && answer) {
        const fq =
          query || chatCacheRef.current[jobId]?.query || "";
        hydrateChatFromResult(jobId, fq, answer);
      }
    },
    [
      hydrateChatFromResult,
      hydrateChatFromTurns,
      replaceAssistantMessage,
    ]
  );

  const loadJobConversation = useCallback(
    async (jobId: string, navigate: boolean) => {
      if (!jobId) return;
      stopPolling();
      setIsTyping(false);
      setPendingJobId(null);
      setPendingPrompt("");
      setActiveAssistantId(null);
      setInputValue("");
      setActiveJobId(jobId);
      if (navigate) {
        router.push(`/research/${jobId}`);
      }

      const cached = chatCacheRef.current[jobId];
      if (cached) {
        setIsChatLoading(false);
        if (cached.turns?.length) {
          hydrateChatFromTurns(jobId, cached.turns);
        } else {
          hydrateChatFromResult(jobId, cached.query, cached.refined_answer);
        }
        void fetchResearchQueryResult(jobId)
          .then((result) => {
            console.log("[research] sidebar refresh /results (cached chat)", {
              jobId,
              result,
            });
            const map = parseChatSessionsFromOutputs(result.outputs);
            const hasChatSessions =
              map != null && Object.keys(map).length > 0;
            digestResearchResults(jobId, result, null, {
              updateMessages: hasChatSessions,
            });
          })
          .catch(() => {});
        return;
      }

      setIsChatLoading(true);
      try {
        const result = await fetchResearchQueryResult(jobId);
        console.log("[research] load /results response", { jobId, result });
        const detail =
          typeof result.detail === "string" ? result.detail : "";
        const answer = result.outputs?.refined_answer?.trim() ?? "";
        const sessionMap = parseChatSessionsFromOutputs(result.outputs);
        const hasSessions = Boolean(
          sessionMap && Object.keys(sessionMap).length > 0
        );
        if (detail.toLowerCase().includes("not completed")) {
          setMessages([
            {
              id: `${jobId}-processing`,
              role: "assistant",
              message: "This job is still processing. Please try again in a moment.",
            },
          ]);
          return;
        }
        if (!hasSessions && !answer) {
          setMessages([
            {
              id: `${jobId}-not-found`,
              role: "assistant",
              message: "No conversation found",
              error: true,
            },
          ]);
          return;
        }

        digestResearchResults(jobId, result, null);
      } catch {
        setMessages([
          {
            id: `${jobId}-error`,
            role: "assistant",
            message: "No conversation found",
            error: true,
          },
        ]);
      } finally {
        setIsChatLoading(false);
      }
    },
    [digestResearchResults, hydrateChatFromResult, hydrateChatFromTurns, router, stopPolling]
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
    setJobIds(stored.jobIds);
    setChatByJobId(stored.chats);
    setResearchSessions(stored.sessions);
    researchSessionsRef.current = stored.sessions;
    chatCacheRef.current = stored.chats;
    setHydrated(true);
  }, []);

  useEffect(() => {
    chatCacheRef.current = chatByJobId;
  }, [chatByJobId]);

  useEffect(() => {
    pendingJobIdRef.current = pendingJobId;
  }, [pendingJobId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!routeJobId) {
      setActiveJobId(null);
      setMessages([]);
      setIsChatLoading(false);
      setIsTyping(false);
      return;
    }
    if (
      pendingJobIdRef.current &&
      routeJobId === pendingJobIdRef.current
    ) {
      return;
    }
    void loadJobConversation(routeJobId, false);
  }, [hydrated, routeJobId, loadJobConversation]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredChats({ jobIds, chats: chatByJobId, sessions: researchSessions });
  }, [hydrated, jobIds, chatByJobId, researchSessions]);

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

    if (!hadUserMessage) {
      if (!selectedProjectJobId.trim()) return;
      payloadJobId = selectedProjectJobId;
      sessionIdForPayload = undefined;
    } else {
      const researchJobId = routeJobId ?? activeJobId;
      if (!researchJobId) {
        console.log("[research] follow-up submit: missing research job id");
        toast.error("Session error. Open a research chat or start a new session.");
        return;
      }
      const storedSession = (
        selectedSessionIdByJob[researchJobId] ||
        researchSessions[researchJobId] ||
        ""
      ).trim();
      if (!storedSession) {
        console.log("[research] follow-up submit: missing session_id", {
          researchJobId,
          researchSessions,
          selectedSessionIdByJob,
        });
        toast.error("Session missing. Start a new research session.");
        return;
      }
      payloadJobId = researchJobId;
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
      });
      const queued = await submitResearchQuery({
        job_id: payloadJobId,
        ...(sessionIdForPayload !== undefined
          ? { session_id: sessionIdForPayload }
          : {}),
        query: prompt,
        show_sources: true,
        show_combined: false,
        database: "neo4j",
      });
      console.log("[research] /query-neo4j response", queued);
      if (!queued?.job_id) {
        throw new Error("Query request did not return a job id.");
      }
      if (queued.session_id?.trim()) {
        const sid = queued.session_id.trim();
        setResearchSessions((prev) => {
          const next = { ...prev, [queued.job_id]: sid };
          researchSessionsRef.current = next;
          return next;
        });
        setSelectedSessionIdByJob((prev) => ({
          ...prev,
          [queued.job_id]: sid,
        }));
        selectedSessionIdByJobRef.current = {
          ...selectedSessionIdByJobRef.current,
          [queued.job_id]: sid,
        };
      }
      setPendingJobId(queued.job_id);
      setActiveJobId(queued.job_id);
      setJobIds((prev) =>
        prev.includes(queued.job_id) ? prev : [queued.job_id, ...prev]
      );
      router.push(`/research/${queued.job_id}`);
    } catch (err) {
      console.log("[research] submitResearchQuery failed", err);
      replaceAssistantMessage(assistantId, {
        typing: false,
        error: true,
        message: "Sorry, I could not submit your question. Please try again.",
      });
      setIsTyping(false);
      setActiveAssistantId(null);
      setPendingJobId(null);
      setPendingPrompt("");
      toast.error("Failed to send query.");
    }
  }, [
    activeJobId,
    inputValue,
    isTyping,
    messages,
    replaceAssistantMessage,
    researchSessions,
    routeJobId,
    router,
    selectedProjectJobId,
    selectedSessionIdByJob,
  ]);

  const handleSelectRecentJob = useCallback(
    (jobId: string) => {
      if (!jobId || jobId === routeJobId) return;
      stopPolling();
      setIsTyping(false);
      setPendingJobId(null);
      setPendingPrompt("");
      setActiveAssistantId(null);
      setInputValue("");
      setIsChatLoading(true);
      router.push(`/research/${jobId}`);
    },
    [routeJobId, router, stopPolling]
  );

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (!routeJobId) return;
      const map = chatSessionsMapByJobRef.current[routeJobId];
      const turns = map?.[sessionId];
      if (!turns?.length) return;
      console.log("[research] sidebar select session", {
        job_id: routeJobId,
        session_id: sessionId,
      });
      selectedSessionIdByJobRef.current = {
        ...selectedSessionIdByJobRef.current,
        [routeJobId]: sessionId,
      };
      setSelectedSessionIdByJob((prev) => ({
        ...prev,
        [routeJobId]: sessionId,
      }));
      setResearchSessions((prev) => {
        const next = { ...prev, [routeJobId]: sessionId };
        researchSessionsRef.current = next;
        return next;
      });
      hydrateChatFromTurns(routeJobId, turns);
    },
    [routeJobId, hydrateChatFromTurns]
  );

  useEffect(() => {
    if (!pendingJobId || !activeAssistantId) return;

    let cancelled = false;

    const pollOnce = async () => {
      try {
        const status = await fetchResearchQueryStatus(pendingJobId);
        if (cancelled) return;
        console.log("[research] /status response", {
          job_id: pendingJobId,
          status,
        });

        const normalized = status.status?.toLowerCase?.() ?? "";
        if (normalized === "success" || normalized === "completed") {
          let result = await fetchResearchQueryResult(pendingJobId);
          if (cancelled) return;
          const pendingQ = pendingPrompt.trim();
          if (pendingQ) {
            const merged = mergedTurnsFromResult(
              result,
              researchSessionsRef.current[pendingJobId]
            );
            if (
              merged &&
              !turnsIncludeUserQuery(merged, pendingQ)
            ) {
              await new Promise((r) => setTimeout(r, 750));
              if (cancelled) return;
              result = await fetchResearchQueryResult(pendingJobId);
              if (cancelled) return;
            }
          }
          console.log("[research] poll /status success → /results", {
            job_id: pendingJobId,
            result,
          });
          digestResearchResults(pendingJobId, result, activeAssistantId, {
            fallbackUserQuery: pendingPrompt,
          });
          setIsTyping(false);
          setPendingJobId(null);
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
          setPendingJobId(null);
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
        setPendingJobId(null);
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
    pendingJobId,
    activeAssistantId,
    replaceAssistantMessage,
    stopPolling,
    pendingPrompt,
    hydrateChatFromTurns,
    digestResearchResults,
  ]);

  const hasMessages = messages.length > 0;

  const sidebarSessionIds = routeJobId
    ? Object.keys(chatSessionsMapByJob[routeJobId] ?? {})
    : [];
  const sidebarSelectedSessionId: string | null = routeJobId
    ? selectedSessionIdByJob[routeJobId] ??
      researchSessions[routeJobId] ??
      null
    : null;

  const showProjectPicker = !messages.some((m) => m.role === "user");

  const isRecordNotFoundView =
    hydrated &&
    messages.length === 1 &&
    messages[0].role === "assistant" &&
    Boolean(messages[0].error) &&
    messages[0].message === "No conversation found";

  const isNewSessionView =
    hydrated &&
    routeJobId == null &&
    !isChatLoading &&
    !isTyping &&
    messages.length === 0;

  const useCenteredInputLayout = isNewSessionView || isRecordNotFoundView;

  const showChatThread =
    (hasMessages || isChatLoading) && !isRecordNotFoundView;

  return (
    <DashboardLayout
      title="Research"
      subtitle="Your intelligent research partner."
    >
      <div className="flex min-h-[calc(100dvh-4rem)] min-w-0 flex-col lg:flex-row">
        <MobileSessionsDrawer
          open={mobileSessionsOpen}
          onOpenChange={setMobileSessionsOpen}
          onNewSession={createAndGoToNewSession}
          recentJobIds={jobIds}
          onSelectRecentJob={handleSelectRecentJob}
          researchJobId={routeJobId}
          sessionIds={sidebarSessionIds}
          selectedSessionId={sidebarSelectedSessionId}
          onSelectSession={handleSelectSession}
        />
        <ResearchSidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          onNewSession={createAndGoToNewSession}
          recentJobIds={jobIds}
          onSelectRecentJob={handleSelectRecentJob}
          researchJobId={routeJobId}
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
                    showProjectPicker={showProjectPicker}
                    catalogProjects={catalogProjects}
                    catalogProjectsLoading={catalogProjectsLoading}
                    selectedProjectJobId={selectedProjectJobId}
                    onProjectJobIdChange={setSelectedProjectJobId}
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
                              <ChatMessage key={item.id} item={item} />
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
                        showProjectPicker={showProjectPicker}
                        catalogProjects={catalogProjects}
                        catalogProjectsLoading={catalogProjectsLoading}
                        selectedProjectJobId={selectedProjectJobId}
                        onProjectJobIdChange={setSelectedProjectJobId}
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

