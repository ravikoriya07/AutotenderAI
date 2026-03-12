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
  const { data } = await apiClient.get<ListProjectsResponse>("/projects");
  return data;
}
