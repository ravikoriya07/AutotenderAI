/**
 * Project detail tab models — aligned with future Laravel API responses.
 * Supports a canonical `tabs[]` payload and legacy flat `data` keys (normalized client-side).
 */

export type ProjectDetailTabIcon =
  | "overview"
  | "file-text"
  | "scale"
  | "file-warning"
  | "users"
  | "trophy";

export type ProjectDetailFieldFormat = "plain" | "multiline";

export type ProjectDetailField = {
  label: string;
  /** Single line, multiline text, or multiple paragraphs (rendered as stacked <p>). */
  value: string | string[] | null;
  format?: ProjectDetailFieldFormat;
};

export type ProjectDetailSection = {
  id?: string;
  title?: string;
  fields: ProjectDetailField[];
};

export type ProjectDetailFieldsContent = {
  type: "fields";
  title?: string;
  /** Use `sections` for grouped blocks; otherwise top-level `fields`. */
  sections?: ProjectDetailSection[];
  fields?: ProjectDetailField[];
};

export type ProjectDetailStringListContent = {
  type: "string_list";
  title?: string;
  items: string[];
};

export type ProjectDetailRecordListContent = {
  type: "record_list";
  title?: string;
  records: Record<string, string>[];
};

export type ProjectDetailPlaceholderContent = {
  type: "placeholder";
  message: string;
};

export type ProjectDetailTabContent =
  | ProjectDetailFieldsContent
  | ProjectDetailStringListContent
  | ProjectDetailRecordListContent
  | ProjectDetailPlaceholderContent;

export type ProjectDetailTab = {
  id: string;
  label: string;
  icon: ProjectDetailTabIcon;
  content: ProjectDetailTabContent;
};

/** Normalized model consumed by the UI. */
export type ProjectDetailData = {
  /** Resolved from `job_id` or `project_id`. */
  projectId: string;
  /** Optional job/detail fetch status from API (e.g. `completed`). */
  status?: string;
  tabs: ProjectDetailTab[];
};

/** Flat Laravel / API shape — tabs at root with `job_id`. */
export type ProjectDetailFlatApiResponse = {
  job_id?: string;
  project_id?: string;
  status?: string;
  tabs: ProjectDetailTabApi[];
};

/** Wrapped canonical envelope (also supported). */
export type ProjectDetailApiResponse = {
  data: {
    job_id?: string;
    project_id?: string;
    status?: string;
    tabs: ProjectDetailTabApi[];
  };
};

/** Tab content from API/JSON — omit `type`; use fields, items, records, or message. */
export type ProjectDetailTabContentRaw = {
  title?: string;
  fields?: ProjectDetailField[];
  sections?: ProjectDetailSection[];
  items?: string[];
  records?: Record<string, string>[];
  message?: string;
};

export type ProjectDetailTabApi = {
  id: string;
  label: string;
  icon?: ProjectDetailTabIcon | string;
  content: ProjectDetailTabContentRaw;
};

/**
 * Legacy / partial API shape from GET /details/:projectId.
 * Keys are snake_case; absent keys omit tabs or use placeholders.
 */
export type ProjectDetailLegacyData = {
  tender_summary?: Record<string, string | null | undefined>;
  named_suppliers?: Record<string, string | null | undefined>[];
  missing_documents?: string[];
  contract_review?: Record<string, string | null | undefined>;
  overview?: Record<string, string | null | undefined>;
  competitors?: Record<string, string | null | undefined>[];
  competition?: Record<string, string | null | undefined>[];
  [key: string]: unknown;
};

export type ProjectDetailLegacyApiResponse = {
  data: ProjectDetailLegacyData;
};

export type ProjectDetailRawResponse =
  | ProjectDetailFlatApiResponse
  | ProjectDetailApiResponse
  | ProjectDetailLegacyApiResponse;
