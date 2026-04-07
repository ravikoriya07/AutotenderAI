"use client";

import { Loader2 } from "lucide-react";
import type { CompletedStepProject } from "@/services/statsService";

type CompletedStepsProjectSelectProps = {
  projects: CompletedStepProject[];
  loading: boolean;
  value: string;
  onChange: (jobId: string) => void;
};

export function CompletedStepsProjectSelect({
  projects,
  loading,
  value,
  onChange,
}: CompletedStepsProjectSelectProps) {
  const selectValue =
    value && projects.some((p) => p.job_id === value) ? value : "";

  if (loading) {
    return (
      <div
        className="flex h-8 w-full min-w-0 items-center gap-2"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sidebar-foreground/80" />
        <span className="text-xs text-sidebar-foreground/80">
          Loading projects…
        </span>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 shrink-0 items-center gap-1.5">
      <select
        aria-label="Select project"
        value={selectValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={projects.length === 0}
        className="h-9 min-h-9 min-w-0 w-full flex-1 rounded-md border border-sidebar-foreground/25 bg-sidebar px-2 py-1 text-xs text-sidebar-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-sidebar-foreground/30 disabled:cursor-not-allowed disabled:opacity-60 sm:h-8 sm:min-h-0"
      >
        <option value="">
          {projects.length === 0
            ? "No projects available"
            : "Select project"}
        </option>
        {projects.map((p) => (
          <option key={p.job_id} value={p.job_id}>
            {p.project_name}
          </option>
        ))}
      </select>
    </div>
  );
}
