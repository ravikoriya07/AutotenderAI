"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MyDraftsEditorView } from "@/components/bid-writing/MyDraftsEditorView";
import { fetchBidDraft, fetchBidDrafts } from "@/lib/bid-writing/bidWritingApi";
import {
  draftListDateLabel,
  DRAFTS_UPDATED_EVENT,
  mapBidDraftSummaryToRecord,
  normalizeDraftSources,
  normalizeWebSources,
} from "@/lib/bid-writing/draftUtils";
import type { DraftRecord } from "@/lib/bid-writing/types";

function mergeDraftListWithCachedDetail(rows: DraftRecord[], prev: DraftRecord[]): DraftRecord[] {
  const prevById = new Map(prev.map((d) => [d.id, d]));
  return rows.map((r) => {
    const old = prevById.get(r.id);
    if (!old) return r;
    const hadDetail =
      old.content.trim() !== "" || old.sources != null || old.web_sources != null;
    if (!hadDetail) return r;
    return {
      ...r,
      content: old.content,
      sources: old.sources,
      web_sources: old.web_sources,
    };
  });
}

function draftContentFromDetail(detail: { content?: string; text?: string }): string {
  if (typeof detail.content === "string") return detail.content;
  if (typeof detail.text === "string") return detail.text;
  return "";
}

function MyDraftsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [draftsTotal, setDraftsTotal] = useState(0);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [draftsError, setDraftsError] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftLoading, setActiveDraftLoading] = useState(false);
  const [activeDraftLoadError, setActiveDraftLoadError] = useState<string | null>(null);

  const draftFetchSeqRef = useRef(0);

  const refreshDraftList = useCallback(async () => {
    const { drafts: apiDrafts, total } = await fetchBidDrafts();
    const rows = apiDrafts.map((d) => mapBidDraftSummaryToRecord(d));
    return { rows, total };
  }, []);

  useEffect(() => {
    const sessionId = searchParams?.get("session_id");
    if (sessionId) {
      router.replace(`/my-drafts/chat?session_id=${encodeURIComponent(sessionId)}`);
    }
  }, [searchParams, router]);

  useEffect(() => {
    let cancelled = false;
    setDraftsLoading(true);
    setDraftsError(false);
    void refreshDraftList()
      .then(({ rows, total }) => {
        if (cancelled) return;
        setDrafts((prev) => mergeDraftListWithCachedDetail(rows, prev));
        setDraftsTotal(total);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[MyDrafts] Failed to load drafts list:", err);
        setDrafts([]);
        setDraftsTotal(0);
        setDraftsError(true);
      })
      .finally(() => {
        if (!cancelled) setDraftsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshDraftList]);

  useEffect(() => {
    function onDraftsUpdated() {
      void refreshDraftList()
        .then(({ rows, total }) => {
          setDrafts((prev) => mergeDraftListWithCachedDetail(rows, prev));
          setDraftsTotal(total);
          setDraftsError(false);
        })
        .catch((err) => {
          console.error("[MyDrafts] Failed to refresh drafts after save:", err);
        });
    }
    window.addEventListener(DRAFTS_UPDATED_EVENT, onDraftsUpdated);
    return () => window.removeEventListener(DRAFTS_UPDATED_EVENT, onDraftsUpdated);
  }, [refreshDraftList]);

  const loadDraftDetail = useCallback((draftId: string, seq: number) => {
    setActiveDraftLoading(true);
    setActiveDraftLoadError(null);
    void fetchBidDraft(draftId)
      .then((detail) => {
        if (seq !== draftFetchSeqRef.current) return;
        const record: DraftRecord = {
          id: detail.id,
          title: detail.title,
          content: draftContentFromDetail(detail),
          createdAt: draftListDateLabel(detail.created_at, detail.updated_at),
          sources: normalizeDraftSources(detail.sources),
          web_sources: normalizeWebSources(detail.web_sources),
        };
        setDrafts((prev) => {
          const idx = prev.findIndex((d) => d.id === detail.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...record };
            return next;
          }
          return [record, ...prev];
        });
      })
      .catch((err) => {
        if (seq !== draftFetchSeqRef.current) return;
        console.error("[MyDrafts] Failed to load draft:", err);
        setActiveDraftLoadError("Could not load this draft.");
        toast.error("Could not load draft");
      })
      .finally(() => {
        if (seq === draftFetchSeqRef.current) setActiveDraftLoading(false);
      });
  }, []);

  const pushDraftToUrl = useCallback(
    (draftId: string | null) => {
      if (draftId) {
        const params = new URLSearchParams();
        params.set("draft_id", draftId);
        router.replace(`/my-drafts?${params.toString()}`, { scroll: false });
      } else {
        router.replace("/my-drafts", { scroll: false });
      }
    },
    [router]
  );

  const selectDraft = useCallback(
    (draftId: string) => {
      setActiveDraftId(draftId);
      pushDraftToUrl(draftId);
      const seq = ++draftFetchSeqRef.current;
      loadDraftDetail(draftId, seq);
    },
    [loadDraftDetail, pushDraftToUrl]
  );

  const clearDraftSelection = useCallback(() => {
    draftFetchSeqRef.current += 1;
    setActiveDraftId(null);
    setActiveDraftLoading(false);
    setActiveDraftLoadError(null);
    pushDraftToUrl(null);
  }, [pushDraftToUrl]);

  useEffect(() => {
    if (draftsLoading) return;

    const urlDraftId = searchParams?.get("draft_id")?.trim() || null;
    if (!urlDraftId) {
      return;
    }

    if (activeDraftId === urlDraftId && !activeDraftLoadError) return;

    setActiveDraftId(urlDraftId);
    const seq = ++draftFetchSeqRef.current;
    loadDraftDetail(urlDraftId, seq);
  }, [draftsLoading, searchParams, activeDraftId, activeDraftLoadError, loadDraftDetail]);

  function handleBackToChat() {
    router.push("/my-drafts/chat");
  }

  return (
    <MyDraftsEditorView
      drafts={drafts}
      setDrafts={setDrafts}
      draftsLoading={draftsLoading}
      draftsError={draftsError}
      draftsTotal={draftsTotal}
      activeDraftId={activeDraftId}
      activeDraftLoading={activeDraftLoading}
      activeDraftLoadError={activeDraftLoadError}
      onSelectDraft={selectDraft}
      onClearDraftSelection={clearDraftSelection}
      onRetryDraftLoad={() => {
        if (!activeDraftId) return;
        const seq = ++draftFetchSeqRef.current;
        loadDraftDetail(activeDraftId, seq);
      }}
      onBackToChat={handleBackToChat}
    />
  );
}

export default function MyDraftsPage() {
  return (
    <DashboardLayout title="My Drafts" fullHeight>
      <Suspense fallback={null}>
        <MyDraftsPageContent />
      </Suspense>
    </DashboardLayout>
  );
}
