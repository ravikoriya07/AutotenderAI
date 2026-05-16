"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MyDraftsChatView } from "@/components/bid-writing/MyDraftsChatView";
import { fetchBidDrafts } from "@/lib/bid-writing/bidWritingApi";

function MyDraftsChatPageContent() {
  const [draftCount, setDraftCount] = useState(0);

  const refreshDraftCount = useCallback(() => {
    void fetchBidDrafts()
      .then(({ total }) => setDraftCount(total))
      .catch((err) => {
        console.error("[MyDraftsChat] Failed to load draft count:", err);
      });
  }, []);

  useEffect(() => {
    refreshDraftCount();
  }, [refreshDraftCount]);

  function handleDraftSaved() {
    refreshDraftCount();
  }

  return (
    <MyDraftsChatView draftCount={draftCount} onDraftSaved={handleDraftSaved} />
  );
}

export default function MyDraftsChatPage() {
  return (
    <DashboardLayout title="My Drafts" fullHeight>
      <Suspense fallback={null}>
        <MyDraftsChatPageContent />
      </Suspense>
    </DashboardLayout>
  );
}
