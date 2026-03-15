import { apiClient } from "@/lib/apiClient";
import type {
  CreateProjectPayload,
  CreateProjectResponse,
  ListProjectsResponse,
} from "@/types/project";

export async function createProject(
  payload: CreateProjectPayload
): Promise<CreateProjectResponse> {
  const { data } = await apiClient.post<CreateProjectResponse>(
    "/create-project",
    {
      opportunity: payload.opportunity.trim(),
      due_date: payload.due_date?.trim() || "N/A",
      status: payload.status,
    }
  );
  return data;
}

export async function listProjects(): Promise<ListProjectsResponse> {
  const { data } = await apiClient.get<unknown>("/projects");
  if (Array.isArray(data)) return data as ListProjectsResponse;
  if (data && typeof data === "object" && "projects" in data && Array.isArray((data as { projects: unknown }).projects)) {
    return (data as { projects: ListProjectsResponse }).projects;
  }
  return [];
}
