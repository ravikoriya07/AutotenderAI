"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Plus, MoreVertical, FileText } from "lucide-react";

const mockDrafts = [
  { id: "1", title: "Joe", words: 4, daysAgo: "5 days ago" },
  {
    id: "2",
    title: "Document - 11 Apr 2025, 10:44",
    words: 0,
    daysAgo: "11 days ago",
  },
];

export default function MyDraftsPage() {
  return (
    <DashboardLayout
      title="My Drafts"
      subtitle="Your private space to keep personal documents secure, and only accessible to you."
    >
      <PageContainer>
        <div className="mb-6 flex flex-wrap gap-4">
          <button className="flex h-32 w-full max-w-[10rem] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-card transition-colors hover:border-primary hover:bg-primary/5 sm:w-40 sm:max-w-none">
            <Plus className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Document</span>
          </button>
          {mockDrafts.map((draft) => (
            <Card
              key={draft.id}
              className="flex h-32 w-full max-w-[10rem] flex-col justify-between p-4 transition-shadow hover:shadow-md sm:w-40 sm:max-w-none"
            >
              <div className="flex items-start justify-between">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <button className="rounded p-1 hover:bg-muted">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
              <div>
                <h3 className="font-medium truncate">{draft.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {draft.words} words · {draft.daysAgo}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
