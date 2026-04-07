"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { QuantityTakeOffDrawingViewer } from "@/components/quantity-take-off/QuantityTakeOffDrawingViewer";
import { Button } from "@/components/ui/Button";

function ViewerSuspenseFallback() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center rounded-lg border border-border/80 bg-muted/20"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function QuantityTakeOffDrawingViewPage() {
  const router = useRouter();

  return (
    <DashboardLayout
      titleLeading={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 min-h-9 gap-1 px-2 text-muted-foreground hover:text-foreground sm:min-h-0"
          onClick={() => router.push("/quantity-take-off")}
          aria-label="Back to quantity take-off"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Back</span>
        </Button>
      }
      title="Drawing viewer"
      subtitle="View a drawing PDF from your project."
      searchPlaceholder="Search…"
    >
      <PageContainer>
        <Suspense fallback={<ViewerSuspenseFallback />}>
          <QuantityTakeOffDrawingViewer />
        </Suspense>
      </PageContainer>
    </DashboardLayout>
  );
}
