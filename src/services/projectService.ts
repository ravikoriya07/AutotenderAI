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

function normalizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const jobId = String(row.job_id ?? row.id ?? "").trim();
  if (!jobId) return null;

  return {
    id: jobId,
    job_id: jobId,
    opportunity: String(row.opportunity ?? ""),
    dueDate: String(row.dueDate ?? row.due_date ?? "N/A"),
    status: String(row.status ?? ""),
  };
}

function normalizeProjects(raw: unknown): Project[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeProject).filter(Boolean) as Project[];
}

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
    const obj = data as { projects: unknown; pagination?: Pagination };
    return {
      projects: normalizeProjects(obj.projects),
      pagination: obj.pagination ?? null,
    };
  }
  if (Array.isArray(data)) {
    return { projects: normalizeProjects(data), pagination: null };
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

export type ProjectActionType = "download" | "delete" | "archive";

export type ProjectActionResult =
  | {
      kind: "blob";
      blob: Blob;
      contentDisposition?: string;
      contentType?: string;
    }
  | { kind: "json"; data: unknown };

function getResponseHeader(
  headers: { get?: (name: string) => unknown; [key: string]: unknown },
  name: string
): string | undefined {
  if (typeof headers.get === "function") {
    const v = headers.get(name);
    if (typeof v === "string" && v) return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  }
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) {
      const val = headers[k];
      if (typeof val === "string") return val;
      if (Array.isArray(val) && typeof val[0] === "string") return val[0];
    }
  }
  return undefined;
}

/** POST /project-action/{job_id}?action_type=… — body `{ paths: [] }` (empty = whole project). */
export async function postProjectAction(
  jobId: string,
  actionType: ProjectActionType,
  paths: string[],
  signal?: AbortSignal
): Promise<ProjectActionResult> {
  const trimmed = jobId.trim();
  const isDownload = actionType === "download";
  const config: ProjectRequestConfig = {
    skipGlobalLoader: true,
    params: { action_type: actionType },
    ...(isDownload
      ? {
          responseType: "blob" as const,
          // Avoid implying we only accept JSON; binary responses stay as blob.
          headers: { Accept: "*/*" },
        }
      : {}),
    ...(signal ? { signal } : {}),
  };
  const res = await apiClient.post<Blob | unknown>(
    `/project-action/${encodeURIComponent(trimmed)}`,
    { paths },
    config
  );
  if (isDownload) {
    const blob = res.data instanceof Blob ? res.data : new Blob();
    const contentDisposition = getResponseHeader(
      res.headers as { get?: (name: string) => unknown; [key: string]: unknown },
      "content-disposition"
    );
    const contentType = getResponseHeader(
      res.headers as { get?: (name: string) => unknown; [key: string]: unknown },
      "content-type"
    );
    return { kind: "blob", blob, contentDisposition, contentType };
  }
  return { kind: "json", data: res.data };
}

/**
 * Map URL `path` (e.g. `pdfs/...` from quantity take-off) to `file_path` for GET /view-file.
 * API expects project-relative paths like `drawing/pdfs/...`.
 */
export function toViewFileApiPath(pathFromUrl: string): string {
  const p = pathFromUrl.trim().replace(/^\/+/, "");
  if (!p) return p;
  if (p.startsWith("drawing/")) return p;
  return `drawing/${p}`;
}

export type FetchViewFileResult = {
  blob: Blob;
  contentType?: string;
};

/** GET /view-file/{job_id}?file_path=...&view_original=... — PDF (or binary) for inline viewing. */
export async function fetchViewFile(
  jobId: string,
  filePath: string,
  options?: { viewOriginal?: boolean; signal?: AbortSignal }
): Promise<FetchViewFileResult> {
  const trimmed = jobId.trim();
  const fp = filePath.trim();
  const config: ProjectRequestConfig = {
    skipGlobalLoader: true,
    responseType: "blob",
    headers: { Accept: "*/*" },
    params: {
      file_path: fp,
      view_original: options?.viewOriginal ?? true,
    },
    ...(options?.signal ? { signal: options.signal } : {}),
  };
  const res = await apiClient.get<Blob>(
    `/view-file/${encodeURIComponent(trimmed)}`,
    config
  );
  const blob = res.data instanceof Blob ? res.data : new Blob();
  const contentType = getResponseHeader(
    res.headers as { get?: (name: string) => unknown; [key: string]: unknown },
    "content-type"
  );
  return { blob, contentType };
}
