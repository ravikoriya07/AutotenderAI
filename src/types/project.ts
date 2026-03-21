export type CreateProjectPayload = {
  opportunity: string;
  due_date?: string;
  status: string;
};

export type CreateProjectResponse = {
  status: string;
  job_id: string;
  project: {
    id: string;
    opportunity: string;
    due_date: string;
    status: string;
  };
};

export type Project = {
  id: string;
  job_id?: string;
  opportunity: string;
  dueDate: string;
  status: string;
};

export type ExtractZipResponse = {
  job_id: string;
  status: string;
  zip_path: string;
  extracted_dir: string;
};

export type Pagination = {
  total_items: number;
  total_pages: number;
  current_page: number;
  limit: number | "all";
};

export type ListProjectsParams = {
  page?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
};

export type ListProjectsResponse =
  | Project[]
  | { projects: Project[]; pagination: Pagination };

export type ApiErrorDetail = {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
};

export type ApiErrorResponse = {
  detail: ApiErrorDetail[];
};
