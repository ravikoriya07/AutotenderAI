"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { OrganisationLibraryView } from "@/components/library/OrganisationLibraryView";

/** Organisation Library uses a fixed project tree job for the sidebar + listing. */
const PROJECT_LIBRARY_JOB_ID =
  "71918f2f-33b8-47e8-9e0f-6fcb553bb46e";

export default function LibraryPage() {
  return (
    <DashboardLayout
      title="Organisation Library"
      searchPlaceholder="Search your library..."
    >
      <PageContainer>
        <OrganisationLibraryView jobId={PROJECT_LIBRARY_JOB_ID} />
      </PageContainer>
    </DashboardLayout>
  );
}
