"use client";

import { useState, useRef, useEffect, useCallback, useMemo, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  Loader2,
  Star,
  BookOpen,
  Flag,
  List,
  Upload,
  Check,
  FolderArchive,
  Search,
  Ban,
  X,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { MarkdownRenderer } from "@/components/bid-writing/MarkdownRenderer";
import type {
  ChatSession,
  DraftRecord,
  FilterPresetId,
  PastBid,
  ClientProjectOption,
  BidSessionSummary,
} from "@/lib/bid-writing/types";
import { loadChatHistory, saveChatHistory } from "@/lib/bid-writing/chatHistoryStorage";
import {
  fetchPastBids,
  fetchClientProjects,
  fetchBidSessions,
  fetchBidSession,
  deleteBidSession,
} from "@/lib/bid-writing/bidWritingApi";

function isHighScoringPresetBid(b: PastBid): boolean {
  const wonOrLost = b.group === "won" || b.group === "lost";
  const highQuality =
    b.quality_tier === "high_quality" ||
    (b.quality_score_pct != null && b.quality_score_pct >= 60);
  return wonOrLost && highQuality;
}

function seqsForPreset(preset: FilterPresetId, bids: PastBid[]): Set<number> {
  if (bids.length === 0) return new Set();
  if (preset === "full" || preset === "custom") {
    return new Set(bids.map((bid) => bid.seq));
  }
  if (preset === "framework") {
    return new Set(bids.filter((bid) => bid.is_framework === true).map((bid) => bid.seq));
  }
  const high = bids.filter(isHighScoringPresetBid);
  if (high.length > 0) return new Set(high.map((bid) => bid.seq));
  return new Set(bids.map((bid) => bid.seq));
}

function clientProjectRowKey(p: ClientProjectOption, index: number): string {
  return p.id ?? `row-${index}-${p.name}`;
}

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

/** Matches Tailwind `duration-300` for client panel overlay + slide. */
const CLIENT_PANEL_TRANSITION_MS = 300;

type Msg = { role: "user" | "assistant"; content: string };

type RecentChatRow = {
  id: string;
  title: string;
  source: "api" | "local";
  messageCount: number;
};

// ─── UI preference persistence ────────────────────────────────────────────────
const CHAT_UI_PREFS_KEY = "autotender_chat_ui_prefs_v1";

type ChatUiPrefs = {
  filterPreset: FilterPresetId;
  clientProject: string | null;
  customSeqs: number[];
};

function loadChatUiPrefs(): ChatUiPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHAT_UI_PREFS_KEY);
    return raw ? (JSON.parse(raw) as ChatUiPrefs) : null;
  } catch {
    return null;
  }
}

function saveChatUiPrefs(prefs: ChatUiPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAT_UI_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}
// ──────────────────────────────────────────────────────────────────────────────

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [localSessionsLoaded, setLocalSessionsLoaded] = useState(false);
  const [bidSessions, setBidSessions] = useState<BidSessionSummary[]>([]);
  const [bidSessionsLoading, setBidSessionsLoading] = useState(true);
  const [bidSessionsError, setBidSessionsError] = useState(false);
  const [bidSessionsLoaded, setBidSessionsLoaded] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [webSourceOn, setWebSourceOn] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const [libraryFilterPanelMounted, setLibraryFilterPanelMounted] = useState(false);
  const [libraryFilterPanelVisible, setLibraryFilterPanelVisible] = useState(false);
  // Lazy-initialise from persisted prefs so the filter survives refresh
  const [filterPreset, setFilterPreset] = useState<FilterPresetId>(() => {
    return loadChatUiPrefs()?.filterPreset ?? "high";
  });
  const [folderSearch, setFolderSearch] = useState("");
  const [libraryBids, setLibraryBids] = useState<PastBid[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryFetchError, setLibraryFetchError] = useState(false);
  const [selectedLibrarySeqs, setSelectedLibrarySeqs] = useState<Set<number>>(() => {
    const prefs = loadChatUiPrefs();
    if (prefs?.filterPreset === "custom" && prefs.customSeqs?.length) {
      return new Set(prefs.customSeqs);
    }
    return new Set();
  });
  const librarySelectionSeededRef = useRef(false);

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientPanelMounted, setClientPanelMounted] = useState(false);
  const [clientPanelVisible, setClientPanelVisible] = useState(false);
  // Lazy-initialise from persisted prefs
  const [clientProject, setClientProject] = useState<string | null>(() => {
    return loadChatUiPrefs()?.clientProject ?? null;
  });
  const [clientProjects, setClientProjects] = useState<ClientProjectOption[]>([]);
  const [clientProjectsLoading, setClientProjectsLoading] = useState(false);
  const [clientProjectsError, setClientProjectsError] = useState(false);
  const [clientProjectSearch, setClientProjectSearch] = useState("");
  const [selectedClientZip, setSelectedClientZip] = useState<File | null>(null);
  const [clientZipDragActive, setClientZipDragActive] = useState(false);
  const [clientZipIngesting, setClientZipIngesting] = useState(false);
  const [clientZipProgressPct, setClientZipProgressPct] = useState(0);
  const clientZipInputRef = useRef<HTMLInputElement>(null);
  const clientZipIntervalRef = useRef<number | null>(null);

  const [draftToast, setDraftToast] = useState(false);
  /** Which assistant message index has the export dropdown open (null = closed). */
  const [exportMenuIndex, setExportMenuIndex] = useState<number | null>(null);
  const [recentChatMenuOpenId, setRecentChatMenuOpenId] = useState<string | null>(null);
  /** Cancels in-flight `GET /bid/sessions/{id}` when switching chats or starting new. */
  const sessionFetchSeqRef = useRef(0);
  const [apiSessionLoading, setApiSessionLoading] = useState(false);
  const [apiSessionLoadError, setApiSessionLoadError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const initialUrlSessionLoadedRef = useRef(false);

  // Load local (localStorage) chat history and mark it ready
  useEffect(() => {
    setSessions(loadChatHistory());
    setLocalSessionsLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBidSessionsLoading(true);
    void fetchBidSessions()
      .then((data) => {
        if (cancelled) return;
        setBidSessions(Array.isArray(data) ? data : []);
        setBidSessionsError(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[MyDraftsChat] Failed to load bid sessions:", err);
        setBidSessions([]);
        setBidSessionsError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setBidSessionsLoading(false);
        setBidSessionsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLibraryLoading(true);
    void fetchPastBids()
      .then((data) => {
        if (cancelled) return;
        setLibraryBids(Array.isArray(data) ? data : []);
        setLibraryFetchError(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[MyDraftsChat] Failed to load library metadata:", err);
        setLibraryBids([]);
        setLibraryFetchError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filterPresetRef = useRef(filterPreset);
  filterPresetRef.current = filterPreset;

  // Seed library selection from bids once loaded.
  // If the persisted preset is "custom" and we already have seqs, skip re-seeding.
  useEffect(() => {
    if (libraryBids.length === 0 || librarySelectionSeededRef.current) return;
    librarySelectionSeededRef.current = true;
    const prefs = loadChatUiPrefs();
    if (prefs?.filterPreset === "custom" && prefs.customSeqs?.length) {
      // Restore exact custom selection — only keep seqs that still exist in the library
      const valid = new Set(libraryBids.map((b) => b.seq));
      setSelectedLibrarySeqs(new Set(prefs.customSeqs.filter((s) => valid.has(s))));
    } else {
      setSelectedLibrarySeqs(seqsForPreset(filterPresetRef.current, libraryBids));
    }
  }, [libraryBids]);

  // Persist filter/client prefs to localStorage whenever they change
  useEffect(() => {
    saveChatUiPrefs({
      filterPreset,
      clientProject,
      customSeqs: filterPreset === "custom" ? Array.from(selectedLibrarySeqs) : [],
    });
  }, [filterPreset, clientProject, selectedLibrarySeqs]);

  // Auto-load session from URL (?session_id=…) once local sessions are ready
  useEffect(() => {
    if (initialUrlSessionLoadedRef.current) return;
    if (!localSessionsLoaded) return; // wait for localStorage to hydrate

    const urlSessionId = searchParams?.get("session_id");
    if (!urlSessionId) {
      initialUrlSessionLoadedRef.current = true;
      return;
    }

    initialUrlSessionLoadedRef.current = true;

    // If already showing this session, do nothing
    if (currentChatId === urlSessionId) return;

    // Try local session first (instant, no API call)
    const local = sessions.find((c) => c.id === urlSessionId);
    if (local) {
      sessionFetchSeqRef.current += 1;
      setApiSessionLoading(false);
      setApiSessionLoadError(null);
      setCurrentChatId(urlSessionId);
      setMessages(
        local.messages.flatMap((m) => [
          { role: "user" as const, content: m.question },
          { role: "assistant" as const, content: m.answer },
        ])
      );
      return;
    }

    // API-backed session
    const seq = ++sessionFetchSeqRef.current;
    setCurrentChatId(urlSessionId);
    setMessages([]);
    setApiSessionLoadError(null);
    setApiSessionLoading(true);
    runApiSessionFetch(urlSessionId, seq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSessionsLoaded, searchParams]);

  useEffect(() => {
    if (!clientModalOpen) {
      setClientProjectSearch("");
      setSelectedClientZip(null);
      setClientZipDragActive(false);
      setClientZipProgressPct(0);
      setClientZipIngesting(false);
      if (clientZipIntervalRef.current) {
        window.clearInterval(clientZipIntervalRef.current);
        clientZipIntervalRef.current = null;
      }
      if (clientZipInputRef.current) clientZipInputRef.current.value = "";
      return;
    }
    let cancelled = false;
    setClientProjectsLoading(true);
    setClientProjectsError(false);
    void fetchClientProjects()
      .then((data) => {
        if (cancelled) return;
        setClientProjects(data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[MyDraftsChat] Failed to load client projects:", err);
        setClientProjects([]);
        setClientProjectsError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setClientProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientModalOpen]);

  useEffect(() => {
    if (clientModalOpen) {
      setClientPanelMounted(true);
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => setClientPanelVisible(true));
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        if (raf2) window.cancelAnimationFrame(raf2);
      };
    }
    setClientPanelVisible(false);
    const unmountTimer = window.setTimeout(() => {
      setClientPanelMounted(false);
    }, CLIENT_PANEL_TRANSITION_MS);
    return () => window.clearTimeout(unmountTimer);
  }, [clientModalOpen]);

  useEffect(() => {
    if (filterOpen) {
      setLibraryFilterPanelMounted(true);
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => setLibraryFilterPanelVisible(true));
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        if (raf2) window.cancelAnimationFrame(raf2);
      };
    }
    setLibraryFilterPanelVisible(false);
    const unmountTimer = window.setTimeout(() => {
      setLibraryFilterPanelMounted(false);
    }, CLIENT_PANEL_TRANSITION_MS);
    return () => window.clearTimeout(unmountTimer);
  }, [filterOpen]);

  useEffect(() => {
    const anyPanel = clientPanelMounted || libraryFilterPanelMounted;
    if (!anyPanel) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setClientModalOpen(false);
      setFilterOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [clientPanelMounted, libraryFilterPanelMounted]);

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

  useEffect(() => {
    if (recentChatMenuOpenId === null) return;
    function closeRecentMenu(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-recent-chat-menu-root]")) setRecentChatMenuOpenId(null);
    }
    document.addEventListener("mousedown", closeRecentMenu);
    return () => document.removeEventListener("mousedown", closeRecentMenu);
  }, [recentChatMenuOpenId]);

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

  /** Shallow-push ?session_id=… into the URL without a full navigation. */
  function pushSessionToUrl(sessionId: string) {
    const params = new URLSearchParams();
    params.set("session_id", sessionId);
    router.replace(`/my-drafts?${params.toString()}`, { scroll: false });
  }

  /** Remove ?session_id from the URL (new chat / clear state). */
  function clearSessionFromUrl() {
    router.replace("/my-drafts", { scroll: false });
  }

  function startNewChat() {
    sessionFetchSeqRef.current += 1;
    setApiSessionLoading(false);
    setApiSessionLoadError(null);
    const id = `chat_${Date.now()}`;
    setCurrentChatId(id);
    setMessages([]);
    setChatInput("");
    clearSessionFromUrl();
  }

  function loadSession(id: string) {
    const s = sessions.find((c) => c.id === id);
    if (!s) return;
    sessionFetchSeqRef.current += 1;
    setApiSessionLoading(false);
    setApiSessionLoadError(null);
    setCurrentChatId(id);
    setMessages(
      s.messages.flatMap((m) => [
        { role: "user" as const, content: m.question },
        { role: "assistant" as const, content: m.answer },
      ])
    );
  }

  function mapApiSessionMessages(
    raw: { role: string; content?: string }[] | undefined
  ): Msg[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: typeof m.content === "string" ? m.content : "",
      }));
  }

  function runApiSessionFetch(sessionId: string, seq: number) {
    void fetchBidSession(sessionId)
      .then((detail) => {
        if (seq !== sessionFetchSeqRef.current) return;
        setMessages(mapApiSessionMessages(detail.messages));
        setBidSessions((prev) => {
          const t = detail.title;
          if (!t || prev.length === 0) return prev;
          let changed = false;
          const next = prev.map((s) => {
            if (s.session_id !== sessionId) return s;
            if (s.title === t) return s;
            changed = true;
            return { ...s, title: t };
          });
          return changed ? next : prev;
        });
      })
      .catch((err) => {
        if (seq !== sessionFetchSeqRef.current) return;
        console.error("[MyDraftsChat] Failed to load session:", err);
        setApiSessionLoadError("Could not load this conversation.");
        toast.error("Could not load chat");
      })
      .finally(() => {
        if (seq === sessionFetchSeqRef.current) {
          setApiSessionLoading(false);
        }
      });
  }

  function openRecentChat(row: RecentChatRow) {
    setExportMenuIndex(null);
    setChatSidebarOpen(false);

    // Always sync URL so the session survives a refresh
    pushSessionToUrl(row.id);

    if (row.source === "local") {
      loadSession(row.id);
      return;
    }
    const local = sessions.find((c) => c.id === row.id);
    if (local) {
      loadSession(row.id);
      return;
    }

    if (
      row.source === "api" &&
      currentChatId === row.id &&
      messages.length > 0 &&
      !apiSessionLoadError
    ) {
      return;
    }

    const seq = ++sessionFetchSeqRef.current;
    setCurrentChatId(row.id);
    setMessages([]);
    setApiSessionLoadError(null);
    setApiSessionLoading(true);
    runApiSessionFetch(row.id, seq);
  }

  function retryApiSessionLoad() {
    const id = currentChatId;
    if (!id || sessions.some((c) => c.id === id)) return;
    const seq = ++sessionFetchSeqRef.current;
    setMessages([]);
    setApiSessionLoadError(null);
    setApiSessionLoading(true);
    runApiSessionFetch(id, seq);
  }

  function removeLocalSession(id: string) {
    const next = sessions.filter((c) => c.id !== id);
    persistSessions(next);
    if (currentChatId === id) startNewChat();
  }

  async function confirmDeleteRecentChat(row: RecentChatRow) {
    setRecentChatMenuOpenId(null);
    if (!window.confirm("Delete this chat? This cannot be undone.")) return;
    try {
      if (row.source === "api") {
        await deleteBidSession(row.id);
        setBidSessions((prev) => prev.filter((s) => s.session_id !== row.id));
        removeLocalSession(row.id);
        toast.success("Chat deleted");
      } else {
        removeLocalSession(row.id);
        toast.success("Chat deleted");
      }
    } catch (err) {
      console.error("[MyDraftsChat] Failed to delete session:", err);
      toast.error("Could not delete chat");
    }
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
    const isNewSession = !chatId;
    if (!chatId) {
      chatId = `chat_${Date.now()}`;
      setCurrentChatId(chatId);
    }

    // Push session_id to URL so a refresh re-opens this conversation
    if (isNewSession) {
      pushSessionToUrl(chatId);
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

  function toggleFolder(seq: number) {
    setSelectedLibrarySeqs((prev) => {
      const next = new Set(prev);
      if (next.has(seq)) next.delete(seq);
      else next.add(seq);
      return next;
    });
  }

  function applyPreset(p: FilterPresetId) {
    setFilterPreset(p);
    if (libraryBids.length === 0) return;
    if (p === "full") {
      setSelectedLibrarySeqs(new Set(libraryBids.map((b) => b.seq)));
    } else if (p === "high") {
      setSelectedLibrarySeqs(seqsForPreset("high", libraryBids));
    } else if (p === "framework") {
      setSelectedLibrarySeqs(seqsForPreset("framework", libraryBids));
    }
  }

  const filteredLibraryBids = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return libraryBids;
    return libraryBids.filter((b) => {
      const hay = `${b.seq} ${b.project} ${b.qdrant_project_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [libraryBids, folderSearch]);

  const filteredClientProjects = useMemo(() => {
    const q = clientProjectSearch.trim().toLowerCase();
    if (!q) return clientProjects;
    return clientProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [clientProjects, clientProjectSearch]);

  const clientZipUploadLocked = clientZipIngesting || clientProjectsLoading;

  const runMockClientZipIngest = useCallback((file: File) => {
    if (clientZipIntervalRef.current) {
      window.clearInterval(clientZipIntervalRef.current);
      clientZipIntervalRef.current = null;
    }
    setClientZipIngesting(true);
    setClientZipProgressPct(0);
    const steps = [15, 40, 72, 100];
    let i = 0;
    clientZipIntervalRef.current = window.setInterval(() => {
      setClientZipProgressPct(steps[i] ?? 100);
      i += 1;
      if (i >= steps.length) {
        if (clientZipIntervalRef.current) {
          window.clearInterval(clientZipIntervalRef.current);
          clientZipIntervalRef.current = null;
        }
        setClientZipIngesting(false);
        setSelectedClientZip(null);
        if (clientZipInputRef.current) clientZipInputRef.current.value = "";
        toast.success(`Ingested ${file.name} (mock — connect ZIP API when ready)`);
        void fetchClientProjects()
          .then((data) => {
            setClientProjects(data);
            setClientProjectsError(false);
          })
          .catch((err) => {
            console.error("[MyDraftsChat] Refresh client projects after ZIP:", err);
            setClientProjectsError(true);
          });
      }
    }, 400);
  }, []);

  function handleClientZipInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok =
      file.name.toLowerCase().endsWith(".zip") ||
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed";
    if (!ok) {
      toast.error("Please choose a ZIP file.");
      e.target.value = "";
      return;
    }
    setSelectedClientZip(file);
  }

  function handleClientZipDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setClientZipDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const ok =
      file.name.toLowerCase().endsWith(".zip") ||
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed";
    if (!ok) {
      toast.error("Please drop a ZIP file.");
      return;
    }
    setSelectedClientZip(file);
  }

  function clearSelectedClientZip() {
    setSelectedClientZip(null);
    if (clientZipInputRef.current) clientZipInputRef.current.value = "";
  }

  function handleSubmitClientZip() {
    if (!selectedClientZip) {
      toast.error("Please select a ZIP file before submitting.");
      return;
    }
    runMockClientZipIngest(selectedClientZip);
  }

  const filterLabel =
    filterPreset === "high"
      ? "High scoring"
      : filterPreset === "full"
        ? "Full library"
        : filterPreset === "framework"
          ? "Framework"
          : "Custom";

  const recentChatRows = useMemo((): RecentChatRow[] => {
    if (bidSessionsLoaded && !bidSessionsError) {
      return [...bidSessions]
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
        .map((s) => ({
          id: s.session_id,
          title: s.title,
          source: "api" as const,
          messageCount: s.message_count,
        }));
    }
    return [...sessions]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .map((s) => ({
        id: s.id,
        title: s.title,
        source: "local" as const,
        messageCount: s.messages.length,
      }));
  }, [bidSessions, bidSessionsLoaded, bidSessionsError, sessions]);

  const showApiBackedEmptyThread = useMemo(() => {
    if (messages.length > 0 || apiSessionLoading || apiSessionLoadError || !currentChatId) {
      return false;
    }
    if (currentChatId.startsWith("chat_")) return false;
    if (sessions.some((c) => c.id === currentChatId)) return false;
    return true;
  }, [messages.length, apiSessionLoading, apiSessionLoadError, currentChatId, sessions]);

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

            <button
              type="button"
              onClick={() => {
                onOpenEditor();
                setChatSidebarOpen(false);
              }}
              className="mt-3 flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">My Drafts</span>
              {drafts.length > 0 && (
                <span className="inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold text-white dark:bg-emerald-500">
                  {drafts.length}
                </span>
              )}
            </button>

            <Link
              href="/past-bid-library"
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
              onClick={() => setChatSidebarOpen(false)}
            >
              <Library className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Bid Library
            </Link>

            <div className="mt-4 border-t border-border pt-3">
              <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Recent chats
              </p>
              {bidSessionsError && (
                <p className="mb-2 px-1 text-[10px] text-muted-foreground">
                  Could not load server chats — showing saved browser history.
                </p>
              )}
              <div className="space-y-0.5">
                {bidSessionsLoading && !bidSessionsLoaded ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">Loading chats…</p>
                ) : recentChatRows.length === 0 ? (
                  <p className="px-1 text-xs text-muted-foreground">No chats yet</p>
                ) : (
                  recentChatRows.map((row) => {
                    const isActive = currentChatId === row.id;
                    return (
                    <div
                      key={row.id}
                      data-recent-chat-menu-root
                      className={cn(
                        "group flex min-h-0 items-stretch rounded-lg transition-colors",
                        isActive
                          ? "bg-primary/15 ring-1 ring-primary/30"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => openRecentChat(row)}
                        className="min-w-0 flex-1 rounded-l-lg px-2 py-2 text-left"
                        title={row.title}
                      >
                        <span
                          className={cn(
                            "block truncate text-xs font-medium leading-snug",
                            isActive ? "text-primary" : "text-foreground"
                          )}
                        >
                          {row.title}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block text-[10px]",
                            isActive ? "text-primary/70" : "text-muted-foreground"
                          )}
                        >
                          {row.messageCount} message{row.messageCount === 1 ? "" : "s"}
                        </span>
                      </button>
                      <div className="relative flex shrink-0 items-start py-1 pr-1">
                        <button
                          type="button"
                          aria-label="Chat actions"
                          aria-expanded={recentChatMenuOpenId === row.id}
                          aria-haspopup="menu"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecentChatMenuOpenId((v) => (v === row.id ? null : row.id));
                          }}
                          className={cn(
                            "rounded-md p-1.5 transition-opacity hover:bg-muted hover:text-foreground",
                            isActive ? "text-primary/70" : "text-muted-foreground",
                            "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                            recentChatMenuOpenId === row.id && "opacity-100"
                          )}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </button>
                        {recentChatMenuOpenId === row.id && (
                          <div
                            className="absolute right-0 top-full z-30 mt-0.5 min-w-[9.5rem] rounded-lg border border-border bg-popover py-1 shadow-md"
                            role="menu"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                              onClick={() => void confirmDeleteRecentChat(row)}
                            >
                              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
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
                onClick={() => {
                  setFilterOpen(false);
                  setClientModalOpen(true);
                }}
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
                onClick={() => {
                  setClientModalOpen(false);
                  setFilterOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Filter bid library"
              >
                <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{filterLabel}</span>
                <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary">
                  {selectedLibrarySeqs.size}
                </span>
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-6"
            aria-busy={apiSessionLoading}
          >
            {apiSessionLoading && messages.length === 0 ? (
              <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-16 text-center sm:py-24">
                <Loader2 className="h-9 w-9 shrink-0 animate-spin text-primary" aria-hidden />
                <p className="text-sm font-medium text-foreground">Loading conversation…</p>
                <p className="text-xs text-muted-foreground">Fetching messages from your workspace.</p>
              </div>
            ) : apiSessionLoadError && messages.length === 0 ? (
              <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-16 text-center sm:py-24">
                <p className="text-sm font-medium text-foreground">{apiSessionLoadError}</p>
                <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void retryApiSessionLoad()}>
                  Retry
                </Button>
              </div>
            ) : showApiBackedEmptyThread ? (
              <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-2 py-16 text-center sm:py-24">
                <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium text-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground">Send a question below to continue this chat.</p>
              </div>
            ) : messages.length === 0 ? (
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
              <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-2">
                {messages.map((m, i) => (
                  <div
                    key={`${currentChatId ?? "new"}-${i}-${m.role}`}
                    className={cn(
                      "flex items-start gap-3",
                      m.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {/* Avatar */}
                    {m.role === "user" ? (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white shadow-sm">
                        You
                      </div>
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white shadow-sm">
                        AI
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={cn(
                        "min-w-0 max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
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
                            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-primary bg-transparent px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
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

          {/* Sticky input area */}
          <div className="shrink-0 bg-card px-4 pb-3 pt-3">
            <div className="mx-auto max-w-2xl">
              {/* Unified border container — textarea + sources inside one box */}
              <div
                className={cn(
                  "rounded-2xl border bg-background px-4 pb-3 pt-3 transition-all duration-200",
                  chatInput
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                )}
              >
                {/* Textarea row */}
                <div className="flex items-start gap-3">
                  <textarea
                    ref={textareaRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Type your tender question here..."
                    rows={1}
                    disabled={apiSessionLoading}
                    className="max-h-40 flex-1 resize-none bg-transparent pt-0.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Tender question input"
                  />
                  <button
                    type="button"
                    disabled={!chatInput.trim() || apiSessionLoading}
                    onClick={() => void sendMessage()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Send question"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                {/* Sources row — inside the border */}
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Sources:
                  </span>
                  <button
                    type="button"
                    onClick={() => setWebSourceOn((v) => !v)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      webSourceOn
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Globe className="h-3.5 w-3.5" aria-hidden />
                    Web
                  </button>
                </div>
              </div>

              {/* Hint — outside the border, centered below */}
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Ctrl + Enter to send · Sources are cited inline as [1], [2]…
              </p>
            </div>
          </div>
        </div>
      </div>

      {libraryFilterPanelMounted && (
        <>
          <div
            className={cn(
              "fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300 ease-out motion-reduce:transition-none",
              libraryFilterPanelVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            aria-hidden
            onClick={() => setFilterOpen(false)}
          />
          <aside
            className={cn(
              "fixed inset-y-0 right-0 z-[101] flex h-full max-h-dvh min-h-0 w-[min(100vw,22rem)] min-w-0 flex-col border-l border-border bg-card shadow-2xl sm:w-[24rem]",
              "transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              libraryFilterPanelVisible ? "translate-x-0" : "translate-x-full"
            )}
            role="dialog"
            aria-modal="true"
            aria-hidden={!libraryFilterPanelVisible}
            aria-labelledby="library-filter-panel-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
              <div className="min-w-0 flex-1 pr-1">
                <h2
                  id="library-filter-panel-title"
                  className="text-base font-semibold leading-tight text-foreground"
                >
                  Library filter
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Choose which ingested bid projects are allowed as retrieval context for this assistant.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                onClick={() => setFilterOpen(false)}
                aria-label="Close panel"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 px-3 pb-3 pt-2 sm:px-4 sm:pb-3 sm:pt-2">
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => applyPreset("high")}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left text-sm transition-colors sm:gap-3 sm:px-3 sm:py-3",
                      filterPreset === "high"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4 shrink-0 sm:h-5 sm:w-5",
                        filterPreset === "high" ? "text-primary" : "text-muted-foreground"
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "min-w-0 font-semibold",
                        filterPreset === "high" ? "text-primary" : "text-foreground"
                      )}
                    >
                      High Scoring
                    </span>
                    <span
                      className={cn(
                        "ml-auto max-w-[48%] shrink-0 text-right text-[10px] leading-snug sm:max-w-[55%] sm:text-[11px]",
                        filterPreset === "high" ? "text-primary/90" : "text-muted-foreground"
                      )}
                    >
                      Won + lost ≥60% quality
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("full")}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left text-sm transition-colors sm:gap-3 sm:px-3 sm:py-3",
                      filterPreset === "full"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <BookOpen
                      className={cn(
                        "h-4 w-4 shrink-0 sm:h-5 sm:w-5",
                        filterPreset === "full" ? "text-primary" : "text-muted-foreground"
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "min-w-0 font-semibold",
                        filterPreset === "full" ? "text-primary" : "text-foreground"
                      )}
                    >
                      Full Library
                    </span>
                    <span
                      className={cn(
                        "ml-auto max-w-[48%] shrink-0 text-right text-[10px] leading-snug sm:max-w-[55%] sm:text-[11px]",
                        filterPreset === "full" ? "text-primary/90" : "text-muted-foreground"
                      )}
                    >
                      All ingested projects
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("framework")}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left text-sm transition-colors sm:gap-3 sm:px-3 sm:py-3",
                      filterPreset === "framework"
                        ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-400"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <Flag
                      className={cn(
                        "h-4 w-4 shrink-0 sm:h-5 sm:w-5",
                        filterPreset === "framework"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "min-w-0 font-semibold",
                        filterPreset === "framework"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-foreground"
                      )}
                    >
                      Framework
                    </span>
                    <span
                      className={cn(
                        "ml-auto max-w-[48%] shrink-0 text-right text-[10px] leading-snug sm:max-w-[55%] sm:text-[11px]",
                        filterPreset === "framework"
                          ? "text-emerald-700/90 dark:text-emerald-400/90"
                          : "text-muted-foreground"
                      )}
                    >
                      Framework-marked bids only
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPreset("custom")}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left text-sm transition-colors sm:gap-3 sm:px-3 sm:py-3",
                      filterPreset === "custom"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <List
                      className={cn(
                        "h-4 w-4 shrink-0 sm:h-5 sm:w-5",
                        filterPreset === "custom" ? "text-primary" : "text-muted-foreground"
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "min-w-0 font-semibold",
                        filterPreset === "custom" ? "text-primary" : "text-foreground"
                      )}
                    >
                      Custom Selection
                    </span>
                    <span
                      className={cn(
                        "ml-auto max-w-[48%] shrink-0 text-right text-[10px] leading-snug sm:max-w-[55%] sm:text-[11px]",
                        filterPreset === "custom" ? "text-primary/90" : "text-muted-foreground"
                      )}
                    >
                      Pick specific projects
                    </span>
                  </button>
                </div>
              </div>

              {filterPreset === "custom" ? (
                <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-0 sm:px-4 sm:pb-3">
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                    <div className="relative shrink-0 border-b border-border bg-muted/25">
                      <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:h-4 sm:w-4"
                        aria-hidden
                      />
                      <input
                        type="search"
                        value={folderSearch}
                        onChange={(e) => setFolderSearch(e.target.value)}
                        placeholder="Search projects…"
                        className="min-h-11 w-full bg-transparent py-2.5 pl-8 pr-2.5 text-sm outline-none sm:min-h-12 sm:pl-9 sm:pr-3"
                        autoComplete="off"
                      />
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth [-webkit-overflow-scrolling:touch] px-2 py-1 sm:px-3 sm:py-2">
                      {libraryLoading ? (
                        <div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                          <Loader2 className="h-7 w-7 shrink-0 animate-spin text-primary" aria-hidden />
                          <span>Loading projects…</span>
                        </div>
                      ) : libraryFetchError ? (
                        <p className="px-2 py-8 text-center text-sm leading-relaxed text-muted-foreground">
                          Could not load projects. Check your connection and try again.
                        </p>
                      ) : libraryBids.length === 0 ? (
                        <p className="px-2 py-8 text-center text-sm leading-relaxed text-muted-foreground">
                          No projects in the library yet.
                        </p>
                      ) : filteredLibraryBids.length === 0 ? (
                        <p className="px-2 py-8 text-center text-sm leading-relaxed text-muted-foreground">
                          No projects match your search.
                        </p>
                      ) : (
                        <ul className="divide-y divide-border/70">
                          {filteredLibraryBids.map((b) => {
                            const subtitle =
                              b.quality_score_pct != null
                                ? `${b.outcome || b.group} · ${b.quality_score_pct}% quality`
                                : b.outcome || b.group;
                            return (
                              <li key={b.seq}>
                                <label className="flex cursor-pointer items-start gap-3 px-1.5 py-2.5 text-sm transition-colors hover:bg-muted/80 sm:gap-3 sm:px-2 sm:py-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedLibrarySeqs.has(b.seq)}
                                    onChange={() => toggleFolder(b.seq)}
                                    className="mt-0.5 size-4 shrink-0 rounded border-border sm:mt-1"
                                  />
                                  <span className="min-w-0 flex-1 leading-snug">
                                    <span className="block text-[13px] font-medium text-foreground sm:text-sm">
                                      {b.seq}. {b.project}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="min-h-0 flex-1" aria-hidden />
              )}

              <div className="mt-auto flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-card px-3 py-3 sm:px-4">
                <Button type="button" variant="outline" onClick={() => setFilterOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => setFilterOpen(false)}>
                  Apply selection
                </Button>
              </div>
            </div>
          </aside>
        </>
      )}

      {clientPanelMounted && (
        <>
          <div
            className={cn(
              "fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300 ease-out motion-reduce:transition-none",
              clientPanelVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            aria-hidden
            onClick={() => setClientModalOpen(false)}
          />
          <aside
            className={cn(
              "fixed inset-y-0 right-0 z-[101] flex w-[min(100vw,22rem)] min-w-0 flex-col border-l border-border bg-card shadow-2xl sm:w-[24rem]",
              "transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              clientPanelVisible ? "translate-x-0" : "translate-x-full"
            )}
            role="dialog"
            aria-modal="true"
            aria-hidden={!clientPanelVisible}
            aria-labelledby="client-project-panel-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-4">
              <div className="min-w-0 flex-1 pr-1">
                <h2
                  id="client-project-panel-title"
                  className="text-base font-semibold leading-tight text-foreground"
                >
                  Select Client Project
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Choose which client&apos;s uploaded tender documents to include as context when drafting
                  responses.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                onClick={() => setClientModalOpen(false)}
                aria-label="Close panel"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4">
              <div className="rounded-lg border border-border bg-muted/15 p-2.5 sm:p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <FolderArchive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-xs font-semibold tracking-tight text-foreground">
                    Client documents (ZIP)
                  </span>
                </div>
                <input
                  ref={clientZipInputRef}
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  className="hidden"
                  onChange={handleClientZipInputChange}
                  disabled={clientZipUploadLocked}
                />
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    if (!clientZipUploadLocked) setClientZipDragActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setClientZipDragActive(false);
                  }}
                  onDrop={handleClientZipDrop}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-2 py-2 transition-colors sm:gap-2.5 sm:px-2.5",
                    clientZipDragActive
                      ? "border-primary/45 bg-primary/5"
                      : "border-muted-foreground/30 bg-background",
                    clientZipUploadLocked && "pointer-events-none cursor-not-allowed opacity-50"
                  )}
                  onClick={() => !clientZipUploadLocked && clientZipInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                    <span className="font-medium text-foreground">Drop ZIP</span> or tap — one archive with
                    tender documents.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 shrink-0 px-2.5 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      clientZipInputRef.current?.click();
                    }}
                    disabled={clientZipUploadLocked}
                  >
                    Browse
                  </Button>
                </div>

                {selectedClientZip && (
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">{selectedClientZip.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {Math.max(1, Math.round(selectedClientZip.size / 1024))} KB
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-green-600 dark:text-green-500">
                      <Check className="h-3 w-3" aria-hidden />
                      {clientZipIngesting ? "…" : "OK"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearSelectedClientZip();
                      }}
                      className={cn(
                        "shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        "disabled:pointer-events-none disabled:opacity-40"
                      )}
                      disabled={clientZipUploadLocked}
                      aria-label="Remove file"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                )}

                {clientZipIngesting && (
                  <div className="mt-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
                    <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>Ingesting…</span>
                      <span>{clientZipProgressPct}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${clientZipProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSubmitClientZip}
                    disabled={clientZipUploadLocked || !selectedClientZip}
                  >
                    {clientZipIngesting ? "Submitting…" : "Submit"}
                  </Button>
                </div>
              </div>

              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                onClick={() => {
                  setClientProject(null);
                  setClientModalOpen(false);
                }}
              >
                <Ban className="h-4 w-4 shrink-0" aria-hidden />
                None (DCK library only)
              </button>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
                <div className="relative shrink-0 border-b border-border bg-background">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:h-4 sm:w-4"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={clientProjectSearch}
                    onChange={(e) => setClientProjectSearch(e.target.value)}
                    placeholder="Search projects…"
                    className="min-h-10 w-full bg-transparent py-2 pl-8 pr-2.5 text-sm outline-none sm:min-h-11 sm:pl-9 sm:pr-3"
                    autoComplete="off"
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-2.5">
                  {clientProjectsLoading ? (
                    <div className="flex min-h-[6rem] flex-col items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                      <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" aria-hidden />
                      <span>Loading projects…</span>
                    </div>
                  ) : clientProjectsError ? (
                    <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                      Could not load client projects. Check your connection and try again.
                    </p>
                  ) : clientProjects.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                      No client projects uploaded yet.
                    </p>
                  ) : filteredClientProjects.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                      No projects match your search.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {filteredClientProjects.map((p, index) => (
                        <li key={clientProjectRowKey(p, index)}>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted sm:gap-3 sm:px-3 sm:py-2.5",
                              clientProject === p.name && "border-primary/40 bg-primary/5"
                            )}
                            onClick={() => {
                              setClientProject(p.name);
                              setClientModalOpen(false);
                            }}
                          >
                            <span className="flex min-w-0 flex-1 items-start gap-2">
                              <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                              <span className="min-w-0 flex-1 truncate font-medium leading-snug text-foreground">
                                {p.name}
                              </span>
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground sm:text-xs">
                              {p.chunks} chunks
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

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
