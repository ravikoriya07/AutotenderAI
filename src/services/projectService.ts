import { apiClient } from "@/lib/apiClient";
import type {
  CreateProjectPayload,
  CreateProjectResponse,
  ListProjectsParams,
  ListProjectsResponse,
  Pagination,
  Project,
} from "@/types/project";

export type EditProjectPayload = {
  opportunity: string;
  due_date?: string;
  status: string;
};

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

export async function editProject(
  jobId: string,
  payload: EditProjectPayload
): Promise<unknown> {
  const { data } = await apiClient.put<unknown>(`/edit-project/${jobId}`, {
    opportunity: payload.opportunity.trim(),
    due_date: payload.due_date?.trim() ?? "N/A",
    status: payload.status,
  });
  return data;
}

export async function deleteProject(jobId: string): Promise<unknown> {
  const { data } = await apiClient.delete<unknown>(`/delete-project/${jobId}`);
  return data;
}

export type ListProjectsResult = {
  projects: Project[];
  pagination: Pagination | null;
};

export async function listProjects(
  params?: ListProjectsParams
): Promise<ListProjectsResult> {
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set("page", String(params.page));
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.start_date) searchParams.set("start_date", params.start_date);
  if (params?.end_date) searchParams.set("end_date", params.end_date);
  if (params?.status) searchParams.set("status", params.status);
  const query = searchParams.toString();
  const url = query ? `/projects?${query}` : "/projects";
  const { data } = await apiClient.get<unknown>(url);
  if (data && typeof data === "object" && "projects" in data) {
    const obj = data as { projects: Project[]; pagination?: Pagination };
    return {
      projects: Array.isArray(obj.projects) ? obj.projects : [],
      pagination: obj.pagination ?? null,
    };
  }
  if (Array.isArray(data)) {
    return { projects: data as Project[], pagination: null };
  }
  return { projects: [], pagination: null };
}
