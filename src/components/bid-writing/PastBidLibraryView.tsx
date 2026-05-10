"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  FileText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PastBid } from "@/lib/bid-writing/types";
import { fetchPastBids } from "@/lib/bid-writing/bidWritingApi";

type GroupFilter = "all" | "won" | "lost" | "other";

const TIER_KEYS = ["high_quality", "medium_quality", "other"] as const;

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
    return { label: "Waiting", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  return { label: outcome || "Other", className: "bg-muted text-muted-foreground" };
}

interface PastBidLibraryViewProps {
  /** When false, hides inner nav links (e.g. embedded). Default true. */
  showInnerNav?: boolean;
}

export function PastBidLibraryView({ showInnerNav = true }: PastBidLibraryViewProps) {
  const [bids, setBids] = useState<PastBid[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchPastBids()
      .then((data) => {
        if (!cancelled) setBids(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [activeGroup, setActiveGroup] = useState<GroupFilter>("all");
  const [tiers, setTiers] = useState<Record<(typeof TIER_KEYS)[number], boolean>>({
    high_quality: true,
    medium_quality: true,
    other: true,
  });
  const [query, setQuery] = useState("");
  const [drawerBid, setDrawerBid] = useState<PastBid | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = bids;
    if (activeGroup === "won") list = list.filter((b) => b.group === "won");
    if (activeGroup === "lost") list = list.filter((b) => b.group === "lost");
    if (activeGroup === "other") list = list.filter((b) => b.group === "other");
    list = list.filter((b) => tiers[(b.quality_tier as typeof TIER_KEYS[number])] ?? tiers.other);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.project.toLowerCase().includes(q) ||
          (b.outcome_notes ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [bids, activeGroup, tiers, query]);

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
      {/* Filters sidebar */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-b border-border bg-card lg:w-64 lg:border-b-0 lg:border-r",
          mobileFiltersOpen ? "max-lg:flex" : "max-lg:hidden",
          "lg:flex"
        )}
      >
        {showInnerNav && (
          <div className="flex shrink-0 flex-col gap-2 border-b border-border p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <FileText className="h-4 w-4 text-primary-foreground" aria-hidden />
              </div>
              <span className="text-sm font-semibold">Bid writing</span>
            </div>
            <Link
              href="/my-drafts"
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Back to Chat
            </Link>
          </div>
        )}

        <div className="px-4 pb-2 pt-2 lg:pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            View
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
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
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  activeGroup === id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Quality tier
          </p>
          <div className="mt-2 space-y-2">
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

        <div className="mt-auto border-t border-border p-4 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">{stats.total}</strong> sample bids
          </p>
          <p className="mt-1">
            <strong className="text-foreground">{stats.won}</strong> won ·{" "}
            <strong className="text-foreground">{stats.lost}</strong> lost ·{" "}
            <strong className="text-foreground">{stats.other}</strong> other
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="lg:hidden rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              onClick={() => setMobileFiltersOpen((v) => !v)}
            >
              Filters
            </button>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Past Bid Library
              </h1>
              <p className="text-sm text-muted-foreground">
                {loadError
                  ? "Could not load bids."
                  : bids.length === 0
                    ? "Loading bid data…"
                    : `Showing ${filtered.length} of ${bids.length} Qdrant-mapped bids (mock data)`}
              </p>
            </div>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="sticky top-0 z-10 hidden grid-cols-[48px_minmax(0,1fr)_100px_120px_100px_140px] gap-2 border-b border-border bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <div>#</div>
            <div>Project</div>
            <div>Type</div>
            <div>Submitted</div>
            <div>Outcome</div>
            <div className="text-right">Quality</div>
          </div>

          {loadError ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center text-sm text-destructive">
              Failed to load library data.
            </div>
          ) : bids.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
              Loading bid data…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
              No bids match the current filters.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((bid, idx) => {
                const badge = outcomeBadge(bid.group, bid.outcome);
                const sc = bid.quality_score_pct;
                return (
                  <li key={bid.seq}>
                    <button
                      type="button"
                      onClick={() => setDrawerBid(bid)}
                      className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/60 md:grid-cols-[48px_minmax(0,1fr)_100px_120px_100px_140px] md:items-center md:gap-2"
                    >
                      <span className="text-xs text-muted-foreground md:text-sm">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 font-medium text-foreground">
                        {bid.project}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {bid.bid_type || "—"}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(bid.submitted)}
                      </span>
                      <span>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </span>
                      <div className="flex items-center justify-end gap-2 md:justify-end">
                        {sc !== null ? (
                          <>
                            <div className="hidden h-2 w-20 overflow-hidden rounded-full bg-muted sm:block">
                              <div
                                className={cn("h-full rounded-full", scoreBarBg(sc))}
                                style={{ width: `${Math.min(sc, 100)}%` }}
                              />
                            </div>
                            <span className={cn("text-sm font-medium tabular-nums", scoreColor(sc))}>
                              {sc.toFixed(1)}%
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
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

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:z-50",
          drawerBid ? "opacity-100" : "pointer-events-none invisible opacity-0"
        )}
        onClick={closeDrawer}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-xl transition-transform duration-300 ease-out",
          drawerBid ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!drawerBid}
      >
        {drawerBid && (
          <>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-4">
              <h2 className="text-base font-semibold leading-snug text-foreground">
                {drawerBid.project}
              </h2>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm">
              <DetailBody bid={drawerBid} />
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function DetailBody({ bid }: { bid: PastBid }) {
  const sc = bid.quality_score_pct;
  const tierLabel =
    bid.quality_tier === "high_quality"
      ? "High Quality (≥60%)"
      : bid.quality_tier === "medium_quality"
        ? "Medium Quality (40–59%)"
        : "Other / Unknown";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className={cn("text-3xl font-bold tabular-nums", scoreColor(sc))}>
              {sc !== null ? `${sc.toFixed(1)}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              Quality score · {tierLabel}
            </p>
          </div>
        </div>
        {sc !== null && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", scoreBarBg(sc))}
              style={{ width: `${Math.min(sc, 100)}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
        <FileText className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          In Qdrant library —{" "}
          <span className="text-muted-foreground">{bid.qdrant_project_name}</span>
        </span>
      </div>

      <dl className="space-y-3">
        <DetailRow label="Outcome" value={bid.outcome || "—"} />
        <DetailRow label="Submitted" value={formatDate(bid.submitted)} />
        <DetailRow label="Bid type" value={bid.bid_type || "—"} />
        <DetailRow label="Price / Quality split" value={bid.price_quality_split || "—"} />
        {bid.value_gbp ? (
          <DetailRow
            label="Contract value"
            value={`£${Number(bid.value_gbp).toLocaleString("en-GB")}`}
          />
        ) : null}
      </dl>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Quality questions
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(bid.questions ?? []).length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            bid.questions!.map((q) => (
              <span
                key={q}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
              >
                {q}
              </span>
            ))
          )}
        </div>
      </div>

      {bid.outcome_notes ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Notes
          </p>
          <p
            className="mt-2 rounded-lg border border-border bg-background p-3 text-sm leading-relaxed text-foreground"
            dangerouslySetInnerHTML={{ __html: escHtml(bid.outcome_notes).replace(/\n/g, "<br/>") }}
          />
        </div>
      ) : null}

      <Link
        href="/my-drafts"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Return to bid writing
      </Link>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{value}</dd>
    </div>
  );
}
