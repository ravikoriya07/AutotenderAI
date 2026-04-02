"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { OrganisationLibraryView } from "@/components/library/OrganisationLibraryView";

export default function LibraryPage() {
  const [activeJobId, setActiveJobId] = useState("");

  return (
    <DashboardLayout
      title="Organisation Library"
      searchPlaceholder="Search your library..."
    >
      <PageContainer>
        <OrganisationLibraryView
          jobId={activeJobId}
          onProjectJobIdChange={setActiveJobId}
        />
      </PageContainer>
    </DashboardLayout>
  );
}
