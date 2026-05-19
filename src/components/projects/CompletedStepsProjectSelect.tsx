"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { CompletedStepProject } from "@/services/statsService";
import { useResearchProjectOptional } from "@/contexts/ResearchProjectContext";
import { cn } from "@/lib/utils";

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
  const ctx = useResearchProjectOptional();
  const needsHighlight = ctx?.needsProjectHighlight ?? false;

  const [shaking, setShaking] = useState(false);
  const prevHighlight = useRef(false);

  useEffect(() => {
    const wasHighlighted = prevHighlight.current;
    prevHighlight.current = needsHighlight;
    if (needsHighlight && !wasHighlighted) {
      setShaking(false);
      const id = requestAnimationFrame(() => setShaking(true));
      return () => cancelAnimationFrame(id);
    }
    if (!needsHighlight) {
      setShaking(false);
    }
  }, [needsHighlight]);

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
        onAnimationEnd={() => setShaking(false)}
        className={cn(
          "h-9 min-h-9 min-w-0 w-full flex-1 rounded-md border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground shadow-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 sm:h-8 sm:min-h-0",
          needsHighlight
            ? "border-red-400 ring-2 ring-red-400/50 focus:ring-red-400/70"
            : "border-sidebar-foreground/25 focus:ring-sidebar-foreground/30",
          shaking && "animate-project-select-shake"
        )}
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
