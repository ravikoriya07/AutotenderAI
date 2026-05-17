"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MyDraftsEditorView } from "@/components/bid-writing/MyDraftsEditorView";
import {
  deleteBidDraft,
  fetchBidDraft,
  fetchBidDrafts,
  fetchPastBids,
} from "@/lib/bid-writing/bidWritingApi";
import {
  draftListDateLabel,
  DRAFTS_UPDATED_EVENT,
  mapBidDraftSummaryToRecord,
  normalizeDraftSources,
  normalizeWebSources,
} from "@/lib/bid-writing/draftUtils";
import { buildSourceLabelMapFromLibrary } from "@/lib/bid-writing/sourceReferences";
import type { DraftRecord, PastBid } from "@/lib/bid-writing/types";

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
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [libraryBids, setLibraryBids] = useState<PastBid[]>([]);

  const sourceLabelBySeq = useMemo(
    () => buildSourceLabelMapFromLibrary(libraryBids),
    [libraryBids]
  );

  const draftFetchSeqRef = useRef(0);
  /** Ignore detail-load errors while clearing selection (e.g. after delete). */
  const suppressDraftDetailErrorsRef = useRef(false);

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
    void fetchPastBids()
      .then((data) => {
        if (!cancelled) setLibraryBids(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setLibraryBids([]);
      });
    return () => { cancelled = true; };
  }, []);

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
        if (suppressDraftDetailErrorsRef.current) return;
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
    suppressDraftDetailErrorsRef.current = true;
    draftFetchSeqRef.current += 1;
    setActiveDraftId(null);
    setActiveDraftLoading(false);
    setActiveDraftLoadError(null);
    pushDraftToUrl(null);
  }, [pushDraftToUrl]);

  const confirmDeleteDraft = useCallback(
    async (draft: { id: string; title: string }) => {
      const result = await Swal.fire({
        title: "Delete this draft?",
        html: `<span class="text-sm text-gray-500"><strong>${draft.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong> will be permanently removed.</span>`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, delete",
        cancelButtonText: "Cancel",
        confirmButtonColor: "hsl(0 84% 60%)",
        cancelButtonColor: "#6b7280",
        reverseButtons: true,
        focusCancel: true,
        customClass: {
          popup: "!rounded-2xl !shadow-2xl",
          title: "!text-base !font-semibold",
          htmlContainer: "!text-sm !text-gray-500",
          confirmButton: "!rounded-lg !text-sm !font-medium !px-4 !py-2",
          cancelButton: "!rounded-lg !text-sm !font-medium !px-4 !py-2",
        },
      });
      if (!result.isConfirmed) return;

      setDeletingDraftId(draft.id);
      const wasActive = activeDraftId === draft.id;
      if (wasActive) {
        clearDraftSelection();
      }
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      setDraftsTotal((t) => Math.max(0, t - 1));
      try {
        await deleteBidDraft(draft.id);
        const { rows, total } = await refreshDraftList();
        setDrafts(rows);
        setDraftsTotal(total);
        setDraftsError(false);
        window.dispatchEvent(new Event(DRAFTS_UPDATED_EVENT));
        toast.success("Draft deleted");
      } catch (err) {
        console.error("[MyDrafts] Failed to delete draft:", err);
        let msg = "Could not delete draft";
        if (err && typeof err === "object" && "response" in err) {
          const data = (err as {
            response?: { data?: { message?: string; detail?: string; error?: string } };
          }).response?.data;
          const fromApi = data?.message || data?.detail || data?.error;
          if (typeof fromApi === "string" && fromApi.trim()) msg = fromApi.trim();
        } else if (err instanceof Error && err.message) {
          msg = err.message;
        }
        toast.error(msg);
      } finally {
        setDeletingDraftId(null);
      }
    },
    [activeDraftId, clearDraftSelection, refreshDraftList]
  );

  useEffect(() => {
    if (draftsLoading) return;

    const urlDraftId = searchParams?.get("draft_id")?.trim() || null;

    if (deletingDraftId && urlDraftId === deletingDraftId) {
      return;
    }

    if (!urlDraftId) {
      suppressDraftDetailErrorsRef.current = false;
      if (activeDraftId !== null) {
        draftFetchSeqRef.current += 1;
        setActiveDraftId(null);
        setActiveDraftLoading(false);
        setActiveDraftLoadError(null);
      }
      return;
    }

    const draftInList = drafts.some((d) => d.id === urlDraftId);
    if (!draftInList) {
      suppressDraftDetailErrorsRef.current = true;
      draftFetchSeqRef.current += 1;
      setActiveDraftId(null);
      setActiveDraftLoading(false);
      setActiveDraftLoadError(null);
      router.replace("/my-drafts", { scroll: false });
      return;
    }

    suppressDraftDetailErrorsRef.current = false;

    if (activeDraftId === urlDraftId && !activeDraftLoadError) return;

    setActiveDraftId(urlDraftId);
    const seq = ++draftFetchSeqRef.current;
    loadDraftDetail(urlDraftId, seq);
  }, [
    draftsLoading,
    searchParams,
    activeDraftId,
    activeDraftLoadError,
    loadDraftDetail,
    drafts,
    router,
    deletingDraftId,
  ]);

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
      sourceLabelBySeq={sourceLabelBySeq}
      onSelectDraft={selectDraft}
      onClearDraftSelection={clearDraftSelection}
      onRetryDraftLoad={() => {
        if (!activeDraftId) return;
        const seq = ++draftFetchSeqRef.current;
        loadDraftDetail(activeDraftId, seq);
      }}
      deletingDraftId={deletingDraftId}
      onDeleteDraft={(draft) => void confirmDeleteDraft(draft)}
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
