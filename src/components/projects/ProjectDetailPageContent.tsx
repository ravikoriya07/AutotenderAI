"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DetailTabContent } from "@/components/projects/detail/DetailTabContent";
import { ProjectDetailTabs } from "@/components/projects/detail/ProjectDetailTabs";
import { useProjectDetail } from "@/hooks/useProjectDetail";

type ProjectDetailPageContentProps = {
  projectId: string;
};

export function ProjectDetailPageContent({
  projectId,
}: ProjectDetailPageContentProps) {
  const { detail, loading, error, reload } = useProjectDetail(projectId);
  const [activeTabId, setActiveTabId] = useState("");

  useEffect(() => {
    if (detail?.tabs.length) {
      setActiveTabId(detail.tabs[0]!.id);
    } else {
      setActiveTabId("");
    }
  }, [detail]);

  const activeTab = useMemo(
    () => detail?.tabs.find((t) => t.id === activeTabId),
    [detail, activeTabId]
  );

  if (loading) {
    return (
      <Card className="flex min-h-[280px] items-center justify-center border-border bg-card p-8 shadow-sm">
        <Loader2
          className="h-8 w-8 animate-spin text-primary"
          aria-label="Loading project details"
        />
      </Card>
    );
  }

  if (error || !detail?.tabs.length) {
    return (
      <Card className="flex flex-col gap-3 border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        <p>{error ?? "No project detail data available."}</p>
        {projectId.trim() ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            Try again
          </Button>
        ) : null}
      </Card>
    );
  }

  return (
    <Card
      key={projectId}
      className="overflow-hidden border-border bg-card p-0 text-card-foreground shadow-sm"
    >
      <ProjectDetailTabs
        tabs={detail.tabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
      />
      <div className="p-4 sm:p-6">
        {activeTab ? (
          <DetailTabContent content={activeTab.content} />
        ) : null}
      </div>
    </Card>
  );
}
