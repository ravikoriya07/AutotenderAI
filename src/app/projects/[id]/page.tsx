"use client";

import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProjectDetailPageContent } from "@/components/projects/ProjectDetailPageContent";
import { Button } from "@/components/ui/Button";

export default function ProjectDetailRoutePage() {
  const router = useRouter();
  const params = useParams();
  const raw = params.id;
  const projectId = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";

  return (
    <DashboardLayout
      titleLeading={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/projects")}
          aria-label="Back to projects"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          Back
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
