"use client";

import { Suspense, useEffect, useLayoutEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { OrganisationLibraryView } from "@/components/library/OrganisationLibraryView";
import { Button } from "@/components/ui/Button";
import { useResearchProject } from "@/contexts/ResearchProjectContext";

/**
 * `job_id` in the URL (e.g. Research → Library) must seed context, but we must **not**
 * re-apply the URL on every `selectedProjectJobId` change — that was resetting the header
 * dropdown whenever it differed from `?job_id=` (user could never switch projects).
 *
 * - URL → context: only when `job_id` **query** changes (`useLayoutEffect`).
 * - Context → URL: when the user picks another project and the query is stale (`useEffect`).
 */
function LibraryOrganisationSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedProjectJobId, setSelectedProjectJobId } = useResearchProject();
  const jobFromUrl = searchParams.get("job_id")?.trim() ?? "";

  useLayoutEffect(() => {
    if (!jobFromUrl) return;
    setSelectedProjectJobId(jobFromUrl);
  }, [jobFromUrl, setSelectedProjectJobId]);

  useEffect(() => {
    const id = selectedProjectJobId.trim();
    if (!id) return;
    if (jobFromUrl === id) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("job_id", id);
    const qs = next.toString();
    router.replace(qs ? `/library?${qs}` : "/library", { scroll: false });
  }, [selectedProjectJobId, jobFromUrl, router, searchParams]);

  const jobId = selectedProjectJobId.trim() || jobFromUrl;

  return <OrganisationLibraryView jobId={jobId} />;
}

export default function LibraryPage() {
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
      title="Organisation Library"
      searchPlaceholder="Search your library..."
    >
      <PageContainer>
        <Suspense
          fallback={
            <div
              className="flex min-h-[40vh] items-center justify-center"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <LibraryOrganisationSection />
        </Suspense>
      </PageContainer>
    </DashboardLayout>
  );
}
