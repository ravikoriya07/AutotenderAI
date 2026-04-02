"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { OrganisationLibraryView } from "@/components/library/OrganisationLibraryView";

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
    <OrganisationLibraryView jobId={jobId} showProjectDropdown={false} />
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
  return (
    <DashboardLayout
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
