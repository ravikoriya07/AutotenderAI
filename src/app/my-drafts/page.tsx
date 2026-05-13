"use client";

import { Suspense, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MyDraftsChatView } from "@/components/bid-writing/MyDraftsChatView";
import { MyDraftsEditorView } from "@/components/bid-writing/MyDraftsEditorView";
import type { DraftRecord } from "@/lib/bid-writing/types";

type View = "chat" | "editor";

const INITIAL_DRAFTS: DraftRecord[] = [
  {
    id: "1",
    title: "Document - 11 Apr 2025, 10:44",
    content: "",
    createdAt: "11 Apr 2025",
  },
];

export default function MyDraftsPage() {
  const [view, setView] = useState<View>("chat");
  const [drafts, setDrafts] = useState<DraftRecord[]>(INITIAL_DRAFTS);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  function openEditor(draftId?: string) {
    setActiveDraftId(draftId ?? null);
    setView("editor");
  }

  function handleSaveDraftFromAssistant(title: string, body: string) {
    const id = `draft_${Date.now()}`;
    setDrafts((prev) => [
      {
        id,
        title,
        content: body,
        createdAt: new Date().toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...prev,
    ]);
    setActiveDraftId(id);
  }

  return (
    <DashboardLayout title="My Drafts" fullHeight>
      {/* Suspense is required by Next.js App Router for useSearchParams() */}
      <Suspense fallback={null}>
        {view === "chat" ? (
          <MyDraftsChatView
            drafts={drafts}
            onOpenEditor={(id) => openEditor(id)}
            onSaveDraftFromAssistant={handleSaveDraftFromAssistant}
          />
        ) : (
          <MyDraftsEditorView
            drafts={drafts}
            setDrafts={setDrafts}
            activeDraftId={activeDraftId}
            setActiveDraftId={setActiveDraftId}
            onBackToChat={() => setView("chat")}
          />
        )}
      </Suspense>
    </DashboardLayout>
  );
}
