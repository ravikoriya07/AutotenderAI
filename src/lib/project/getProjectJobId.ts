import type { Project } from "@/types/project";

type ProjectIdentifier = Pick<Project, "id" | "job_id">;

/** Canonical job id used for API calls and `/projects/[id]` routes. */
export function getProjectJobId(project: ProjectIdentifier): string {
  return (project.job_id ?? project.id ?? "").trim();
}

export function getProjectDetailPath(project: ProjectIdentifier): string {
  const jobId = getProjectJobId(project);
  return jobId ? `/projects/${encodeURIComponent(jobId)}` : "/projects";
}
