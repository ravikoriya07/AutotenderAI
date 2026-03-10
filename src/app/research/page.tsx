"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ChatPanel } from "@/components/ui/ChatPanel";
import { Clock, Plus, Variable } from "lucide-react";

export default function ResearchPage() {
  return (
    <DashboardLayout>
      <PageContainer>
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold">
              Your Intelligent Research Partner
            </h1>
            <p className="mt-2 text-muted-foreground">
              Ask anything about your documents, answer bank, or the web.
            </p>
          </div>
          <ChatPanel
            placeholder="Ask anything"
            actions={
              <>
                <button className="flex items-center gap-2 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Clock className="h-4 w-4" />
                  Research
                </button>
                <button className="flex items-center gap-2 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Plus className="h-4 w-4" />
                  Source Providers
                </button>
                <button className="flex items-center gap-2 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Variable className="h-4 w-4" />
                  Add Variable
                </button>
                <button className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  Pre
                </button>
              </>
            }
          />
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
