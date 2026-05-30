"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProjectDetailPageContent } from "@/components/projects/ProjectDetailPageContent";
import { Button } from "@/components/ui/Button";

type ProjectDetailRouteClientProps = {
  projectId: string;
};

export function ProjectDetailRouteClient({
  projectId,
}: ProjectDetailRouteClientProps) {
  const router = useRouter();

  return (
    <DashboardLayout
      titleLeading={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 min-h-9 gap-1 px-2 text-muted-foreground hover:text-foreground sm:min-h-0"
          onClick={() => router.push("/projects")}
          aria-label="Back to projects"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Back</span>
        </Button>
      }
      title="Project detail"
      searchPlaceholder="Search your projects"
    >
      <PageContainer>
        <ProjectDetailPageContent projectId={projectId} />
      </PageContainer>
    </DashboardLayout>
  );
}
