"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  FileText,
  Flag,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PastBid } from "@/lib/bid-writing/types";
import {
  fetchBidLibraryJobStatus,
  fetchPastBids,
  submitBidLibraryScores,
  updateFrameworkStatus,
  uploadBidLibraryZip,
} from "@/lib/bid-writing/bidWritingApi";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "react-toastify";

type GroupFilter = "all" | "won" | "lost" | "other";

const TIER_KEYS = ["high_quality", "medium_quality", "other"] as const;

/** 7-column grid: # | Project | Type | Submitted | Outcome | Quality Score | Framework */
const COL = "grid-cols-[36px_minmax(0,1fr)_110px_116px_82px_154px_80px]";

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(d: string | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function scoreColor(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-amber-500";
  return "text-muted-foreground";
}

function scoreBarBg(score: number | null) {
  if (score === null) return "bg-muted";
  if (score >= 60) return "bg-primary";
  if (score >= 40) return "bg-amber-500";
  return "bg-muted-foreground/40";
}

const MAX_QUALITY_SCORE = 100;

type SubmittedQuestionScore = {
  question: string;
  score: number;
  displayScore: string;
};

/** Allow digits and a single optional decimal while typing (e.g. 65, 65.5). */
function sanitizeQualityScoreInput(raw: string): string {
  let next = raw.replace(/[^\d.]/g, "");
  const dotIndex = next.indexOf(".");
  if (dotIndex !== -1) {
    const intPart = next.slice(0, dotIndex);
    const decPart = next.slice(dotIndex + 1).replace(/\./g, "").slice(0, 1);
    next = decPart.length > 0 ? `${intPart}.${decPart}` : `${intPart}.`;
  }
  if (next.startsWith(".")) next = `0${next}`;
  if (next.length > 0 && !next.endsWith(".")) {
    const parsed = Number(next);
    if (Number.isFinite(parsed) && parsed > MAX_QUALITY_SCORE) {
      return String(MAX_QUALITY_SCORE);
    }
  }
  return next;
}

function validateQualityScoreInput(
  raw: string
): { ok: true; value: number; displayScore: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter a score" };
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, message: "Enter a valid number (e.g. 65 or 65.5)" };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { ok: false, message: "Enter a valid number" };
  }
  if (value < 0) {
    return { ok: false, message: "Minimum score is 0" };
  }
  if (value > MAX_QUALITY_SCORE) {
    return { ok: false, message: "Maximum score is 100" };
  }
  const displayScore = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return { ok: true, value, displayScore };
}

function qualityTierFromScore(score: number): PastBid["quality_tier"] {
  if (score >= 60) return "high_quality";
  if (score >= 40) return "medium_quality";
  return "other";
}

function applyQualityScoreToBid(bid: PastBid, newAverageScore: number): PastBid {
  return {
    ...bid,
    quality_score_pct: newAverageScore,
    quality_tier: qualityTierFromScore(newAverageScore),
  };
}

function outcomeBadge(group: PastBid["group"], outcome: string) {
  if (group === "won")
    return { label: outcome || "Won", className: "bg-primary/15 text-primary" };
  if (group === "lost")
    return { label: "Lost", className: "bg-destructive/15 text-destructive" };
  if (outcome === "Waiting Outcome")
    return {
      label: "Waiting",
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  return { label: outcome || "Other", className: "bg-muted text-muted-foreground" };
}

interface PastBidLibraryViewProps {
  /** When false, hides inner nav links (e.g. embedded). Default true. */
  showInnerNav?: boolean;
}

export function PastBidLibraryView({ showInnerNav = true }: PastBidLibraryViewProps) {
  const [bids, setBids] = useState<PastBid[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [activeGroup, setActiveGroup] = useState<GroupFilter>("all");
  const [tiers, setTiers] = useState<Record<(typeof TIER_KEYS)[number], boolean>>({
    high_quality: true,
    medium_quality: true,
    other: true,
  });
  const [query, setQuery] = useState("");
  const [drawerBid, setDrawerBid] = useState<PastBid | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [frameworkBids, setFrameworkBids] = useState<Set<number>>(new Set());
  const [frameworkOnly, setFrameworkOnly] = useState(false);
  /** Seqs whose toggle is currently awaiting an API response. */
  const [frameworkLoading, setFrameworkLoading] = useState<Set<number>>(new Set());

  // Upload bid modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadProjectName, setUploadProjectName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "polling">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadFileRef = useRef<HTMLInputElement>(null);
  const uploadCancelRef = useRef(false);
  const uploadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPastBids()
      .then((data) => {
        if (cancelled) return;
        setBids(data);
        // Seed framework toggle state from API's is_framework field
        setFrameworkBids(
          new Set(data.filter((b) => b.is_framework).map((b) => b.seq))
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[PastBidLibrary] Failed to load bids:", err);
        setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cancel any in-flight upload when component unmounts
  useEffect(() => {
    return () => {
      uploadCancelRef.current = true;
      uploadAbortRef.current?.abort();
    };
  }, []);

  const uploadBusy = uploadPhase !== "idle";
  const canSubmit =
    uploadProjectName.trim().length > 0 && uploadFile !== null && !uploadBusy;

  function openUploadModal() {
    setUploadProjectName("");
    setUploadFile(null);
    setUploadPhase("idle");
    setUploadError(null);
    setUploadOpen(true);
  }

  function closeUploadModal() {
    if (uploadBusy) return;
    uploadCancelRef.current = true;
    uploadAbortRef.current?.abort();
    setUploadOpen(false);
    setUploadProjectName("");
    setUploadFile(null);
    setUploadPhase("idle");
    setUploadError(null);
  }

  async function handleUploadSubmit() {
    if (!canSubmit || !uploadFile) return;
    setUploadError(null);
    uploadCancelRef.current = false;

    const ac = new AbortController();
    uploadAbortRef.current = ac;

    setUploadPhase("uploading");
    let jobId: string;
    try {
      const result = await uploadBidLibraryZip(
        uploadProjectName.trim(),
        uploadFile,
        { signal: ac.signal }
      );
      jobId = result.job_id;
    } catch (err) {
      if (uploadCancelRef.current) return;
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error && err.message.trim() ? err.message.trim() : "Upload failed";
      setUploadError(msg);
      setUploadPhase("idle");
      toast.error(msg);
      return;
    }

    setUploadPhase("polling");

    while (!uploadCancelRef.current) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      if (uploadCancelRef.current) break;

      let status: { status: string; error?: string };
      try {
        status = await fetchBidLibraryJobStatus(jobId);
      } catch (err) {
        if (uploadCancelRef.current) return;
        const msg =
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : "Failed to check job status";
        setUploadError(msg);
        setUploadPhase("idle");
        toast.error(msg);
        return;
      }

      if (status.status === "completed") {
        try {
          const fresh = await fetchPastBids();
          setBids(fresh);
          setFrameworkBids(
            new Set(fresh.filter((b) => b.is_framework).map((b) => b.seq))
          );
        } catch {
          // Non-fatal: listing may be stale
        }
        setUploadPhase("idle");
        setUploadOpen(false);
        toast.success("Bid uploaded and indexed successfully.");
        return;
      }

      if (status.status === "failed") {
        const msg = status.error?.trim() || "Ingestion failed. Please try again.";
        setUploadError(msg);
        setUploadPhase("idle");
        toast.error(msg);
        return;
      }
      // still running — keep polling
    }
  }

  const toggleFramework = useCallback(
    async (seq: number) => {
      if (frameworkLoading.has(seq)) return; // guard against double-click

      const wasFramework = frameworkBids.has(seq);
      const nextValue = !wasFramework;

      // 1. Optimistic update — toggle immediately so the UI feels instant
      setFrameworkBids((prev) => {
        const next = new Set(prev);
        if (wasFramework) next.delete(seq);
        else next.add(seq);
        return next;
      });

      // 2. Mark this seq as in-flight
      setFrameworkLoading((prev) => new Set([...prev, seq]));

      try {
        const result = await updateFrameworkStatus(seq, nextValue);

        // 3. Sync with confirmed server state (server is source of truth)
        setFrameworkBids((prev) => {
          const next = new Set(prev);
          if (result.is_framework) next.add(result.seq);
          else next.delete(result.seq);
          return next;
        });

        toast.success(
          result.is_framework
            ? "Marked as framework bid."
            : "Removed from framework bids."
        );
      } catch (err) {
        console.error("[PastBidLibrary] Failed to update framework status:", err);

        // 4. Revert on failure
        setFrameworkBids((prev) => {
          const next = new Set(prev);
          if (wasFramework) next.add(seq);
          else next.delete(seq);
          return next;
        });

        toast.error("Failed to update framework status. Please try again.");
      } finally {
        // 5. Clear loading marker regardless of outcome
        setFrameworkLoading((prev) => {
          const next = new Set(prev);
          next.delete(seq);
          return next;
        });
      }
    },
    [frameworkBids, frameworkLoading]
  );

  const handleQualityScoresSubmitted = useCallback((seq: number, newAverageScore: number) => {
    setBids((prev) =>
      prev.map((b) => (b.seq === seq ? applyQualityScoreToBid(b, newAverageScore) : b))
    );
    setDrawerBid((prev) =>
      prev?.seq === seq ? applyQualityScoreToBid(prev, newAverageScore) : prev
    );
  }, []);

  const filtered = useMemo(() => {
    let list = bids;
    if (activeGroup === "won") list = list.filter((b) => b.group === "won");
    if (activeGroup === "lost") list = list.filter((b) => b.group === "lost");
    if (activeGroup === "other") list = list.filter((b) => b.group === "other");
    list = list.filter(
      (b) => tiers[(b.quality_tier as (typeof TIER_KEYS)[number])] ?? tiers.other
    );
    if (frameworkOnly) list = list.filter((b) => frameworkBids.has(b.seq));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.project.toLowerCase().includes(q) ||
          (b.outcome_notes ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [bids, activeGroup, tiers, query, frameworkOnly, frameworkBids]);

  const stats = useMemo(() => {
    const won = bids.filter((b) => b.group === "won").length;
    const lost = bids.filter((b) => b.group === "lost").length;
    const other = bids.filter((b) => b.group === "other").length;
    return { won, lost, other, total: bids.length };
  }, [bids]);

  const closeDrawer = useCallback(() => setDrawerBid(null), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDrawer]);

  const tierLabel: Record<string, string> = {
    high_quality: "High (≥60%)",
    medium_quality: "Medium (40–59%)",
    other: "Other / Unknown",
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row lg:overflow-hidden">

      {/* ── Left filter sidebar ───────────────────────────────────────── */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-b border-border bg-card lg:w-56 lg:border-b-0 lg:border-r",
          mobileFiltersOpen ? "max-lg:flex" : "max-lg:hidden",
          "lg:flex"
        )}
      >
        {showInnerNav && (
          <div className="flex shrink-0 flex-col gap-1.5 border-b border-border p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <FileText className="h-4 w-4 text-primary-foreground" aria-hidden />
              </div>
              <span className="text-sm font-semibold">Bid writing</span>
            </div>
            <Link
              href="/my-drafts/chat"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Back to Chat
            </Link>
          </div>
        )}

        <nav className="flex flex-1 flex-col overflow-y-auto py-3">
          {/* VIEW */}
          <div className="px-3">
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              View
            </p>
            {(
              [
                ["all", "All Bids"],
                ["won", "Won"],
                ["lost", "Lost"],
                ["other", "Other"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveGroup(id)}
                className={cn(
                  "flex w-full items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  activeGroup === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* QUALITY TIER */}
          <div className="mt-4 px-3">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Quality Tier
            </p>
            <div className="space-y-2 px-2">
              {TIER_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={tiers[key]}
                    onChange={(e) =>
                      setTiers((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="rounded border-border"
                  />
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      key === "high_quality" && "bg-primary",
                      key === "medium_quality" && "bg-amber-500",
                      key === "other" && "bg-muted-foreground"
                    )}
                  />
                  {tierLabel[key]}
                </label>
              ))}
            </div>
          </div>

          {/* FRAMEWORK */}
          <div className="mt-4 px-3">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Framework
            </p>
            <label className="flex cursor-pointer items-center gap-2 px-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={frameworkOnly}
                onChange={(e) => setFrameworkOnly(e.target.checked)}
                className="rounded border-border"
              />
              <span className="h-2 w-2 rounded bg-primary/70" />
              Framework only
            </label>
          </div>
        </nav>

        {/* Stats footer */}
        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">{stats.total}</strong> Qdrant-mapped bids
          </p>
          <p className="mt-0.5">
            <strong className="text-foreground">{stats.won}</strong> won ·{" "}
            <strong className="text-foreground">{stats.lost}</strong> lost ·{" "}
            <strong className="text-foreground">{stats.other}</strong> other
          </p>
          <p className="mt-0.5">
            <strong className="text-foreground">{frameworkBids.size}</strong> marked as
            framework
          </p>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────────────── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">

        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-5 py-3.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              onClick={() => setMobileFiltersOpen((v) => !v)}
            >
              Filters
            </button>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Past Bid Library
              </h1>
              <p className="text-xs text-muted-foreground">
                {loadError
                  ? "Could not load bids."
                  : bids.length === 0
                    ? "Loading bid data…"
                    : `Showing ${filtered.length} of ${bids.length} Qdrant-mapped bids`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openUploadModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Upload Bid
            </button>
            <div className="relative w-44 sm:w-56">
              <BookOpen className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">

          {/* Column headers — desktop only */}
          <div
            className={cn(
              "sticky top-0 z-10 hidden border-b border-border bg-card/95 backdrop-blur-sm md:grid md:items-center",
              "gap-3 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground",
              COL
            )}
          >
            <div>#</div>
            <div>Project</div>
            <div>Type</div>
            <div>Submitted</div>
            <div>Outcome</div>
            <div>Quality Score</div>
            <div className="text-center">Framework</div>
          </div>

          {/* States */}
          {loadError ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-sm text-destructive">
              Failed to load library data.
            </div>
          ) : bids.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-sm text-muted-foreground">
              Loading bid data…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-sm text-muted-foreground">
              No bids match the current filters.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((bid, idx) => {
                const badge = outcomeBadge(bid.group, bid.outcome);
                const sc = bid.quality_score_pct;
                const isFw = frameworkBids.has(bid.seq);
                return (
                  <li key={bid.seq}>

                    {/* Desktop row */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setDrawerBid(bid)}
                      onKeyDown={(e) => e.key === "Enter" && setDrawerBid(bid)}
                      className={cn(
                        "hidden cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40 md:grid",
                        COL,
                        drawerBid?.seq === bid.seq && "bg-muted/30"
                      )}
                    >
                      {/* # */}
                      <span className="text-xs text-muted-foreground">{idx + 1}</span>

                      {/* Project */}
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {bid.project}
                      </span>

                      {/* Type */}
                      <span className="truncate text-xs text-muted-foreground">
                        {bid.bid_type || "—"}
                      </span>

                      {/* Submitted */}
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(bid.submitted)}
                      </span>

                      {/* Outcome badge */}
                      <span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </span>

                      {/* Quality score bar + % */}
                      <div className="flex items-center gap-2">
                        {sc !== null ? (
                          <>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn("h-full rounded-full", scoreBarBg(sc))}
                                style={{ width: `${Math.min(sc, 100)}%` }}
                              />
                            </div>
                            <span
                              className={cn(
                                "whitespace-nowrap text-xs font-semibold tabular-nums",
                                scoreColor(sc)
                              )}
                            >
                              {sc.toFixed(1)}%
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>

                      {/* Framework toggle — stop click so it doesn't open drawer */}
                      <div
                        className="flex justify-center"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const isLoading = frameworkLoading.has(bid.seq);
                          return (
                            <button
                              type="button"
                              onClick={() => void toggleFramework(bid.seq)}
                              disabled={isLoading}
                              className={cn(
                                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                isLoading
                                  ? "cursor-not-allowed opacity-60"
                                  : "cursor-pointer",
                                isFw ? "bg-primary" : "bg-muted-foreground/30"
                              )}
                              role="switch"
                              aria-checked={isFw}
                              aria-busy={isLoading}
                              aria-label="Mark as framework bid"
                            >
                              {isLoading ? (
                                <Loader2 className="mx-auto h-3 w-3 animate-spin text-white" />
                              ) : (
                                <span
                                  className={cn(
                                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition-transform duration-200",
                                    isFw ? "translate-x-4" : "translate-x-0"
                                  )}
                                />
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Mobile card */}
                    <button
                      type="button"
                      onClick={() => setDrawerBid(bid)}
                      className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 md:hidden"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-snug text-foreground">
                          {bid.project}
                        </span>
                        <span
                          className={cn(
                            "ml-1 mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{bid.bid_type || "—"}</span>
                        <span>·</span>
                        <span>{formatDate(bid.submitted)}</span>
                        {sc !== null && (
                          <>
                            <span>·</span>
                            <span className={cn("font-semibold", scoreColor(sc))}>
                              {sc.toFixed(1)}%
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Upload Bid modal ─────────────────────────────────────────── */}
      <Modal
        open={uploadOpen}
        onClose={closeUploadModal}
        title="Upload Bid"
      >
        <div className="space-y-4">

          {/* Project name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Project Name <span className="text-destructive" aria-hidden>*</span>
            </label>
            <input
              type="text"
              value={uploadProjectName}
              onChange={(e) => setUploadProjectName(e.target.value)}
              disabled={uploadBusy}
              placeholder="e.g. London Borough of Haringey — Repairs 2024"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {/* ZIP file */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              ZIP File <span className="text-destructive" aria-hidden>*</span>
            </label>
            <input
              ref={uploadFileRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                setUploadFile(f);
                setUploadError(null);
              }}
            />
            <button
              type="button"
              disabled={uploadBusy}
              onClick={() => uploadFileRef.current?.click()}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-60",
                uploadFile
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                  : "border-border bg-muted/40 hover:border-primary/40 hover:bg-muted/60"
              )}
            >
              {uploadFile ? (
                <>
                  <FileText className="h-8 w-8 text-primary" aria-hidden />
                  <span className="max-w-full truncate font-medium text-foreground">
                    {uploadFile.name}
                  </span>
                  <span className="text-xs text-muted-foreground">Click to change file</span>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground/50" aria-hidden />
                  <span className="text-muted-foreground">
                    Click to select a{" "}
                    <strong className="font-semibold text-foreground">.zip</strong> file
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Error message */}
          {uploadError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {uploadError}
            </p>
          )}

          {/* In-progress status */}
          {uploadBusy && (
            <div className="flex items-center gap-2.5 rounded-lg bg-primary/10 px-3 py-2.5 text-sm text-primary">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              {uploadPhase === "uploading"
                ? "Uploading file…"
                : "Processing bid data, please wait…"}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={uploadBusy}
              onClick={closeUploadModal}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void handleUploadSubmit()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadBusy ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-4 w-4 shrink-0" aria-hidden />
              )}
              {uploadPhase === "uploading"
                ? "Uploading…"
                : uploadPhase === "polling"
                  ? "Processing…"
                  : "Upload Bid"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Drawer backdrop ───────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:z-50",
          drawerBid ? "opacity-100" : "pointer-events-none invisible opacity-0"
        )}
        onClick={closeDrawer}
        aria-hidden
      />

      {/* ── Detail drawer ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out sm:max-w-md",
          drawerBid ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!drawerBid}
      >
        {drawerBid && (
          <>
            {/* Drawer header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold leading-snug text-foreground">
                {drawerBid.project}
              </h2>
              <button
                type="button"
                onClick={closeDrawer}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer scrollable body */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <DetailBody
                bid={drawerBid}
                isFramework={frameworkBids.has(drawerBid.seq)}
                isToggling={frameworkLoading.has(drawerBid.seq)}
                onToggleFramework={() => void toggleFramework(drawerBid.seq)}
                onScoresSubmitted={handleQualityScoresSubmitted}
              />
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/* ─── Detail drawer body ─────────────────────────────────────────────────── */

function DetailBody({
  bid,
  isFramework,
  isToggling,
  onToggleFramework,
  onScoresSubmitted,
}: {
  bid: PastBid;
  isFramework: boolean;
  isToggling: boolean;
  onToggleFramework: () => void;
  onScoresSubmitted: (seq: number, newAverageScore: number) => void;
}) {
  const questions = bid.questions ?? [];
  const [questionScores, setQuestionScores] = useState<Record<number, string>>({});
  const [questionErrors, setQuestionErrors] = useState<Record<number, string>>({});
  const [submittedScores, setSubmittedScores] = useState<SubmittedQuestionScore[] | null>(
    null
  );
  const [submittingScores, setSubmittingScores] = useState(false);

  useEffect(() => {
    setQuestionScores({});
    setQuestionErrors({});
    setSubmittedScores(null);
  }, [bid.seq]);

  const updateQuestionScore = (index: number, raw: string) => {
    const sanitized = sanitizeQualityScoreInput(raw);
    setQuestionScores((prev) => ({ ...prev, [index]: sanitized }));
    setQuestionErrors((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const validateQuestionAtIndex = (index: number, raw: string): string | null => {
    const normalized = raw.endsWith(".") ? raw.slice(0, -1) : raw;
    if (normalized !== raw) {
      setQuestionScores((prev) => ({ ...prev, [index]: normalized }));
    }
    const result = validateQualityScoreInput(normalized);
    if (!result.ok) return result.message;
    return null;
  };

  const handleQuestionBlur = (index: number) => {
    const raw = questionScores[index] ?? "";
    if (!raw.trim()) return;
    const message = validateQuestionAtIndex(index, raw);
    if (message) {
      setQuestionErrors((prev) => ({ ...prev, [index]: message }));
    }
  };

  const handleSubmitScores = () => {
    if (questions.length === 0 || submittingScores) return;

    const nextErrors: Record<number, string> = {};
    const nextSubmitted: SubmittedQuestionScore[] = [];

    questions.forEach((question, index) => {
      const raw = (questionScores[index] ?? "").trim();
      const normalized = raw.endsWith(".") ? raw.slice(0, -1) : raw;
      const result = validateQualityScoreInput(normalized);
      if (!result.ok) {
        nextErrors[index] = result.message;
        return;
      }
      nextSubmitted.push({
        question,
        score: result.value,
        displayScore: result.displayScore,
      });
    });

    if (Object.keys(nextErrors).length > 0) {
      setQuestionErrors(nextErrors);
      toast.error("Please fix the highlighted scores before submitting.");
      return;
    }

    const payload = Object.fromEntries(
      nextSubmitted.map((entry) => [entry.question, entry.score])
    );

    setSubmittingScores(true);
    void submitBidLibraryScores(bid.seq, payload)
      .then((result) => {
        setQuestionErrors({});
        setSubmittedScores(nextSubmitted);
        onScoresSubmitted(result.seq, result.new_average_score);
        toast.success(result.message?.trim() || "Quality score successfully updated");
      })
      .catch((err) => {
        console.error("[PastBidLibrary] Failed to submit quality scores:", err);
        const msg =
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : "Failed to submit quality scores. Please try again.";
        toast.error(msg);
      })
      .finally(() => {
        setSubmittingScores(false);
      });
  };

  const sc = bid.quality_score_pct;
  const tierLabel =
    bid.quality_tier === "high_quality"
      ? "High Quality (≥60%)"
      : bid.quality_tier === "medium_quality"
        ? "Medium Quality (40–59%)"
        : "Other / Unknown";

  return (
    <div className="space-y-4 px-5 py-5 pb-8">

      {/* Quality score card */}
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <div className={cn("text-3xl font-bold tabular-nums leading-none", scoreColor(sc))}>
          {sc !== null ? `${sc.toFixed(1)}%` : "—"}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Quality Score · {tierLabel}
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          {sc !== null && (
            <div
              className={cn("h-full rounded-full", scoreBarBg(sc))}
              style={{ width: `${Math.min(sc, 100)}%` }}
            />
          )}
        </div>
      </div>

      {/* Qdrant library badge */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
          <Check className="h-3 w-3 text-primary-foreground" aria-hidden />
        </div>
        <div className="min-w-0 text-xs">
          <span className="font-semibold text-primary">In Qdrant library</span>
          <span className="mx-1.5 text-muted-foreground">—</span>
          <span className="break-all text-muted-foreground">{bid.qdrant_project_name}</span>
        </div>
      </div>

      {/* Framework bid toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Flag className="h-4 w-4 text-primary" aria-hidden />
          Framework bid
        </div>
        <button
          type="button"
          onClick={onToggleFramework}
          disabled={isToggling}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isToggling ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            isFramework ? "bg-primary" : "bg-muted-foreground/30"
          )}
          role="switch"
          aria-checked={isFramework}
          aria-busy={isToggling}
          aria-label="Framework bid"
        >
          {isToggling ? (
            <Loader2 className="mx-auto h-4 w-4 animate-spin text-white" />
          ) : (
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200",
                isFramework ? "translate-x-5" : "translate-x-0"
              )}
            />
          )}
        </button>
      </div>

      {/* Detail fields */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <DetailField label="Outcome" value={bid.outcome || "—"} />
        <DetailField label="Submitted" value={formatDate(bid.submitted)} />
        <DetailField label="Bid Type" value={bid.bid_type || "—"} />
        <DetailField
          label="Price / Quality Split"
          value={bid.price_quality_split || "—"}
        />
        {bid.value_gbp ? (
          <DetailField
            label="Contract Value"
            value={`£${Number(bid.value_gbp).toLocaleString("en-GB")}`}
          />
        ) : null}
      </dl>

      {/* Quality questions */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Quality Questions
        </p>
        <div className="mt-2 space-y-2">
          {questions.length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            questions.map((q, index) => {
              const error = questionErrors[index];
              return (
                <div key={`${q}-${index}`}>
                  <div
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5",
                      error ? "border-destructive/50" : "border-border"
                    )}
                  >
                    <label
                      htmlFor={`question-score-${bid.seq}-${index}`}
                      className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground"
                    >
                      {q}
                    </label>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <input
                        id={`question-score-${bid.seq}-${index}`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="—"
                        value={questionScores[index] ?? ""}
                        onChange={(e) => updateQuestionScore(index, e.target.value)}
                        onBlur={() => handleQuestionBlur(index)}
                        aria-invalid={Boolean(error)}
                        aria-describedby={
                          error ? `question-score-error-${bid.seq}-${index}` : undefined
                        }
                        className={cn(
                          "h-8 w-[4.5rem] rounded-md border bg-background px-2 text-right text-sm tabular-nums text-foreground",
                          "placeholder:text-muted-foreground/60",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                          error
                            ? "border-destructive focus-visible:ring-destructive/30"
                            : "border-border focus-visible:ring-primary/30"
                        )}
                        aria-label={`Score for ${q}`}
                      />
                      <span className="text-xs font-medium text-muted-foreground">%</span>
                    </div>
                  </div>
                  {error ? (
                    <p
                      id={`question-score-error-${bid.seq}-${index}`}
                      className="mt-1 px-1 text-xs text-destructive"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {questions.length > 0 ? (
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={submittingScores}
            onClick={handleSubmitScores}
          >
            {submittingScores ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Submitting…
              </>
            ) : (
              "Submit scores"
            )}
          </Button>
        ) : null}

        {submittedScores && submittedScores.length > 0 ? (
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Submitted question scores
            </p>
            <ul className="mt-2 space-y-2">
              {submittedScores.map((entry, index) => (
                <li
                  key={`${entry.question}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-sm text-foreground">{entry.question}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">
                    {entry.displayScore}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Notes */}
      {bid.outcome_notes ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Notes
          </p>
          <div
            className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-foreground"
            dangerouslySetInnerHTML={{
              __html: escHtml(bid.outcome_notes).replace(/\n/g, "<br/>"),
            }}
          />
        </div>
      ) : null}

      <Link
        href="/my-drafts/chat"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Return to bid writing
      </Link>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm leading-snug text-foreground [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}
