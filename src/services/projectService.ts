import type { AxiosRequestConfig } from "axios";
import { apiClient } from "@/lib/apiClient";

type ProjectRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};
import type {
  CreateProjectPayload,
  CreateProjectResponse,
  ExtractZipResponse,
  ListProjectsParams,
  ListProjectsResponse,
  Pagination,
  Project,
  ResumeInfoResponse,
} from "@/types/project";

export type EditProjectPayload = {
  opportunity: string;
  due_date?: string;
  status: string;
};

export async function createProject(
  payload: CreateProjectPayload
): Promise<CreateProjectResponse> {
  const config: ProjectRequestConfig = { skipGlobalLoader: true };
  const { data } = await apiClient.post<CreateProjectResponse>(
    "/create-project",
    {
      opportunity: payload.opportunity.trim(),
      due_date: payload.due_date?.trim() || "N/A",
      status: payload.status,
    },
    config
  );
  return data;
}

export async function editProject(
  jobId: string,
  payload: EditProjectPayload
): Promise<unknown> {
  const config: ProjectRequestConfig = { skipGlobalLoader: true };
  const { data } = await apiClient.put<unknown>(
    `/edit-project/${jobId}`,
    {
      opportunity: payload.opportunity.trim(),
      due_date: payload.due_date?.trim() ?? "N/A",
      status: payload.status,
    },
    config
  );
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
  params?: ListProjectsParams,
  signal?: AbortSignal
): Promise<ListProjectsResult> {
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set("page", String(params.page));
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.start_date) searchParams.set("start_date", params.start_date);
  if (params?.end_date) searchParams.set("end_date", params.end_date);
  if (params?.status) searchParams.set("status", params.status);
  const query = searchParams.toString();
  const url = query ? `/projects?${query}` : "/projects";
  const config: ProjectRequestConfig = {
    skipGlobalLoader: true,
    ...(signal ? { signal } : {}),
  };
  const { data } = await apiClient.get<unknown>(url, config);
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

export async function extractZip(
  file: File,
  jobId: string
): Promise<ExtractZipResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("job_id", jobId);

  const { data } = await apiClient.post<ExtractZipResponse>(
    "/extract-zip",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return data;
}

export async function getResumeInfo(
  jobId: string,
  signal?: AbortSignal
): Promise<ResumeInfoResponse> {
  const config: ProjectRequestConfig = {
    skipGlobalLoader: true,
    ...(signal ? { signal } : {}),
  };
  const { data } = await apiClient.get<ResumeInfoResponse>(
    `/resume-info/${jobId}`,
    config
  );
  return data;
}

/** GET /project-tree/{job_id} — raw JSON; UI uses `tree[3]` (extract_zip_output). */
export async function fetchProjectTree(
  jobId: string,
  signal?: AbortSignal
): Promise<unknown> {
  const config: ProjectRequestConfig = {
    skipGlobalLoader: true,
    ...(signal ? { signal } : {}),
  };
  const { data } = await apiClient.get<unknown>(
    `/project-tree/${jobId}`,
    config
  );
  return data;
}
