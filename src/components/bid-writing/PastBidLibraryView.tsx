"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  FileText,
  Flag,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PastBid } from "@/lib/bid-writing/types";
import { fetchPastBids, updateFrameworkStatus } from "@/lib/bid-writing/bidWritingApi";
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
          <div className="relative w-44 shrink-0 sm:w-56">
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
}: {
  bid: PastBid;
  isFramework: boolean;
  isToggling: boolean;
  onToggleFramework: () => void;
}) {
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
      <dl className="space-y-3.5">
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
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(bid.questions ?? []).length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            bid.questions!.map((q) => (
              <span
                key={q}
                className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
              >
                {q}
              </span>
            ))
          )}
        </div>
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
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}
