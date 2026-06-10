"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ScheduleOfWorksView } from "@/components/schedule-of-works/ScheduleOfWorksView";

export default function ScheduleOfWorksPage() {
  return (
    <DashboardLayout
      fullHeight
      title={
        <span className="flex flex-wrap items-center gap-2">
          Schedule of Works
          <span className="inline-flex items-center gap-1 rounded-[10px] border border-teal-700/25 bg-teal-50 px-[7px] py-0.5 text-[10.5px] font-semibold leading-none text-teal-700">
            🌐 EMS Module
          </span>
        </span>
      }
      subtitle="Documents loaded from the EMS are used automatically. Upload here only if documents are not yet in the system."
      searchPlaceholder="Search…"
    >
      <ScheduleOfWorksView />
    </DashboardLayout>
  );
}
