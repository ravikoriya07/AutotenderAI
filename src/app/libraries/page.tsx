"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { OrganisationLibraryView } from "@/components/library/OrganisationLibraryView";
import { Button } from "@/components/ui/Button";

function LibrariesContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id")?.trim() ?? "";

  if (!jobId) {
    return (
      <p className="text-sm text-muted-foreground">
        Missing job id. Open Library from a project or add{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">?job_id=…</code>{" "}
        to the URL.
      </p>
    );
  }

  return (
    <OrganisationLibraryView jobId={jobId} />
  );
}

function ContentFallback() {
  return (
    <div
      className="flex min-h-[240px] items-center justify-center py-12"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function LibrariesPage() {
  const router = useRouter();

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
      title="Organisation Library"
      searchPlaceholder="Search your library..."
    >
      <PageContainer>
        <Suspense fallback={<ContentFallback />}>
          <LibrariesContent />
        </Suspense>
      </PageContainer>
    </DashboardLayout>
  );
}
