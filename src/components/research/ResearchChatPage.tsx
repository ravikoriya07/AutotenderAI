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
  Plus,
  Send,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  fetchResearchQueryResult,
  fetchResearchQueryStatus,
  submitResearchQuery,
} from "@/services/researchService";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";

type ChatMessageItem = {
  id: string;
  role: ChatRole;
  message: string;
  typing?: boolean;
  error?: boolean;
};

type StoredChat = {
  query: string;
  refined_answer: string;
};

type JobChatStore = {
  jobIds: string[];
  chats: Record<string, StoredChat>;
};

const STORAGE_KEY = "autotender_research_sessions_v1";

function readStoredChats(): JobChatStore {
  if (typeof window === "undefined") return { jobIds: [], chats: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { jobIds: [], chats: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { jobIds: [], chats: {} };
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
      if (typeof c.query === "string" && typeof c.refined_answer === "string") {
        chats[id] = { query: c.query, refined_answer: c.refined_answer };
      }
    }
    return { jobIds, chats };
  } catch {
    return { jobIds: [], chats: {} };
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
          "relative max-w-[70%] whitespace-pre-wrap break-words rounded-[20px] px-4 py-3 text-sm leading-[1.55] shadow-sm",
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
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
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
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-transparent px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Source Providers
          </button>
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim()}
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

function ChatContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-3xl border border-slate-200 bg-[#f9fafb] shadow-sm">
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
  jobIds,
  activeJobId,
  onNewSession,
  onSelectJob,
}: {
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  jobIds: string[];
  activeJobId: string | null;
  onNewSession: () => void;
  onSelectJob: (jobId: string) => void;
}) {
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
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              RECENT SESSIONS
            </p>
            <ul className="space-y-1">
              {jobIds.map((jobId) => (
                <li key={jobId}>
                  <button
                    type="button"
                    onClick={() => onSelectJob(jobId)}
                    className={cn(
                      "w-full truncate rounded-md px-2 py-2 text-left text-sm",
                      jobId === activeJobId
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                    title={jobId}
                  >
                    {jobId.slice(0, 8)}
                  </button>
                </li>
              ))}
              {jobIds.length === 0 ? (
                <li className="px-2 py-2 text-sm text-muted-foreground">
                  No sessions yet
                </li>
              ) : null}
            </ul>
          </div>
        </>
      )}
    </aside>
  );
}

export function ResearchChatPage() {
  const router = useRouter();
  const params = useParams<{ sessionId?: string }>();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [chatByJobId, setChatByJobId] = useState<Record<string, StoredChat>>({});
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatCacheRef = useRef<Record<string, StoredChat>>({});

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
    setActiveJobId(null);
    setMessages([]);
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
        hydrateChatFromResult(jobId, cached.query, cached.refined_answer);
        return;
      }

      setIsChatLoading(true);
      try {
        const result = await fetchResearchQueryResult(jobId);
        const detail =
          typeof (result as { detail?: unknown }).detail === "string"
            ? ((result as { detail?: string }).detail ?? "")
            : "";
        const query = result.outputs?.query?.trim() ?? "";
        const answer = result.outputs?.refined_answer?.trim() ?? "";
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
        if (!answer) {
          setMessages([
            {
              id: `${jobId}-not-found`,
              role: "assistant",
              message: "No conversation found",
              error: true,
            },
          ]);
        } else {
          const fallbackQuery = chatCacheRef.current[jobId]?.query ?? "";
          hydrateChatFromResult(jobId, query || fallbackQuery, answer);
        }
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
    [hydrateChatFromResult, router, stopPolling]
  );

  useEffect(() => {
    const stored = readStoredChats();
    setJobIds(stored.jobIds);
    setChatByJobId(stored.chats);
    chatCacheRef.current = stored.chats;
    setHydrated(true);
  }, []);

  useEffect(() => {
    chatCacheRef.current = chatByJobId;
  }, [chatByJobId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!routeJobId) {
      setActiveJobId(null);
      setMessages([]);
      setIsChatLoading(false);
      setIsTyping(false);
      return;
    }
    if (pendingJobId && routeJobId === pendingJobId) return;
    void loadJobConversation(routeJobId, false);
  }, [hydrated, routeJobId, loadJobConversation, pendingJobId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredChats({ jobIds, chats: chatByJobId });
  }, [hydrated, jobIds, chatByJobId]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const handleSend = useCallback(async () => {
    const prompt = inputValue.trim();
    if (!prompt || isTyping) return;

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

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
      const queued = await submitResearchQuery({
        query: prompt,
        show_sources: true,
        show_combined: false,
        database: "neo4j",
      });
      if (!queued?.job_id) {
        throw new Error("Query request did not return a job id.");
      }
      setPendingJobId(queued.job_id);
      setActiveJobId(queued.job_id);
      setJobIds((prev) =>
        prev.includes(queued.job_id) ? prev : [queued.job_id, ...prev]
      );
      router.push(`/research/${queued.job_id}`);
    } catch {
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
  }, [inputValue, isTyping, replaceAssistantMessage, router]);

  const handleSelectJob = useCallback(
    (jobId: string) => {
      if (!jobId) return;
      if (jobId === routeJobId) return;
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

  useEffect(() => {
    if (!pendingJobId || !activeAssistantId) return;

    let cancelled = false;

    const pollOnce = async () => {
      try {
        const status = await fetchResearchQueryStatus(pendingJobId);
        if (cancelled) return;

        const normalized = status.status?.toLowerCase?.() ?? "";
        if (normalized === "success" || normalized === "completed") {
          const result = await fetchResearchQueryResult(pendingJobId);
          if (cancelled) return;
          const query = result.outputs?.query?.trim() ?? "";
          const answer = result.outputs?.refined_answer?.trim() ?? "";
          if (!answer) {
            replaceAssistantMessage(activeAssistantId, {
              typing: false,
              error: true,
              message: "Completed, but no response text was returned.",
            });
          } else {
            replaceAssistantMessage(activeAssistantId, {
              typing: false,
              error: false,
              message: answer,
            });
            const resolvedQuery = query || pendingPrompt.trim();
            if (resolvedQuery) {
              setChatByJobId((prev) => ({
                ...prev,
                [pendingJobId]: {
                  query: resolvedQuery,
                  refined_answer: answer,
                },
              }));
            }
          }
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
  }, [pendingJobId, activeAssistantId, replaceAssistantMessage, stopPolling, pendingPrompt]);

  const hasMessages = messages.length > 0;

  return (
    <DashboardLayout
      title="Research"
      subtitle="Your intelligent research partner."
    >
      <div className="flex min-h-[calc(100vh-4rem)]">
        <ResearchSidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          jobIds={jobIds}
          activeJobId={activeJobId}
          onNewSession={createAndGoToNewSession}
          onSelectJob={handleSelectJob}
        />
        <PageContainer className="flex flex-1 flex-col items-center justify-start overflow-auto bg-[#f8fafc] py-4 md:py-6">
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-3 md:px-4">
            <h1 className="text-center text-2xl font-semibold text-foreground">
              Your Intelligent Research Partner
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Ask anything about your documents, answer bank, or the web.
            </p>
            <div className="mx-auto mt-4 flex w-full max-w-[860px] flex-1 flex-col gap-4 md:mt-6">
              {hasMessages || isChatLoading ? (
                <ChatContainer>
                  <div className="h-[56vh] overflow-y-auto px-4 py-4 md:h-[60vh] md:px-6 md:py-5">
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
              ) : null}

              <div className="sticky bottom-3 z-10 w-full md:bottom-4">
                <ChatInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={() => void handleSend()}
                  disabled={isTyping}
                />
              </div>
            </div>
          </div>
        </PageContainer>
      </div>
    </DashboardLayout>
  );
}

