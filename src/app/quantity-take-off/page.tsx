"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { QuantityTakeOffView } from "@/components/quantity-take-off/QuantityTakeOffView";
import { Button } from "@/components/ui/Button";
import { useResearchProject } from "@/contexts/ResearchProjectContext";

export default function QuantityTakeOffPage() {
  const router = useRouter();
  const { selectedProjectJobId } = useResearchProject();

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
      title="Quantity take-off"
      subtitle="Browse drawing files for the selected project."
      searchPlaceholder="Search…"
    >
      <PageContainer className="flex min-h-0 flex-1 flex-col !bg-background">
        <QuantityTakeOffView jobId={selectedProjectJobId} />
      </PageContainer>
    </DashboardLayout>
  );
}
