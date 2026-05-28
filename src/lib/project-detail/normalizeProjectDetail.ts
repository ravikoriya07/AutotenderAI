import { inferTabContent } from "@/lib/project-detail/inferTabContent";
import { recordToFields } from "@/lib/project-detail/recordToFields";
import type {
  ProjectDetailData,
  ProjectDetailLegacyData,
  ProjectDetailRawResponse,
  ProjectDetailTab,
  ProjectDetailTabApi,
  ProjectDetailTabContent,
  ProjectDetailTabIcon,
} from "@/types/project-detail";

const DEFAULT_TAB_ORDER: Array<{
  id: string;
  label: string;
  icon: ProjectDetailTabIcon;
  legacyKey?: string;
}> = [
  { id: "overview", label: "Overview", icon: "overview", legacyKey: "overview" },
  {
    id: "tender_summary",
    label: "Tender Summary",
    icon: "file-text",
    legacyKey: "tender_summary",
  },
  {
    id: "contract_review",
    label: "Contract Review",
    icon: "scale",
    legacyKey: "contract_review",
  },
  {
    id: "missing_documents",
    label: "Missing Documents",
    icon: "file-warning",
    legacyKey: "missing_documents",
  },
  {
    id: "named_suppliers",
    label: "Named Suppliers",
    icon: "users",
    legacyKey: "named_suppliers",
  },
  {
    id: "competition",
    label: "Competition",
    icon: "trophy",
    legacyKey: "competitors",
  },
];

type TabsPayload = {
  jobId?: string;
  projectId?: string;
  status?: string;
  tabs: ProjectDetailTabApi[];
};

function extractTabsPayload(
  payload: ProjectDetailRawResponse
): TabsPayload | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;

  if (Array.isArray(root.tabs)) {
    return {
      jobId:
        typeof root.job_id === "string" ? root.job_id : undefined,
      projectId:
        typeof root.project_id === "string" ? root.project_id : undefined,
      status: typeof root.status === "string" ? root.status : undefined,
      tabs: root.tabs as ProjectDetailTabApi[],
    };
  }

  const data = root.data;
  if (data && typeof data === "object" && Array.isArray((data as TabsPayload).tabs)) {
    const nested = data as TabsPayload & Record<string, unknown>;
    return {
      jobId:
        typeof nested.job_id === "string" ? nested.job_id : undefined,
      projectId:
        typeof nested.project_id === "string" ? nested.project_id : undefined,
      status:
        typeof nested.status === "string"
          ? nested.status
          : typeof root.status === "string"
            ? root.status
            : undefined,
      tabs: nested.tabs,
    };
  }

  return null;
}

function isLegacyPayload(
  payload: ProjectDetailRawResponse
): payload is { data: ProjectDetailLegacyData } {
  const tabsPayload = extractTabsPayload(payload);
  if (tabsPayload) return false;
  return (
    payload != null &&
    typeof payload === "object" &&
    "data" in payload &&
    payload.data != null &&
    typeof payload.data === "object" &&
    !Array.isArray((payload.data as { tabs?: unknown }).tabs)
  );
}

function legacyValueToContent(
  _key: string,
  value: unknown,
  label: string
): ProjectDetailTabContent {
  if (value == null) {
    return {
      type: "placeholder",
      message: `${label} — content coming soon.`,
    };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return {
        type: "placeholder",
        message: `No ${label.toLowerCase()} recorded for this project.`,
      };
    }
    if (typeof value[0] === "string") {
      return {
        type: "string_list",
        title: label,
        items: value as string[],
      };
    }
    if (typeof value[0] === "object" && value[0] !== null) {
      return {
        type: "record_list",
        title: label,
        records: (value as Record<string, string>[]).map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [k, v == null ? "" : String(v)])
          )
        ),
      };
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const fields = recordToFields(
      value as Record<string, string | null | undefined>
    );
    if (fields.length === 0) {
      return {
        type: "placeholder",
        message: `${label} — content coming soon.`,
      };
    }
    return { type: "fields", title: label, fields };
  }

  return {
    type: "placeholder",
    message: `${label} — content coming soon.`,
  };
}

function normalizeLegacyPayload(
  projectId: string,
  legacy: ProjectDetailLegacyData
): ProjectDetailData {
  const tabs: ProjectDetailTab[] = DEFAULT_TAB_ORDER.map((def) => {
    const raw =
      legacy[def.legacyKey ?? def.id] ??
      (def.id === "competition" ? legacy.competition : undefined);

    return {
      id: def.id,
      label: def.label,
      icon: def.icon,
      content: legacyValueToContent(def.legacyKey ?? def.id, raw, def.label),
    };
  });

  return { projectId, tabs };
}

function normalizeCanonicalPayload(
  fallbackProjectId: string,
  payload: TabsPayload
): ProjectDetailData {
  const order = new Map(DEFAULT_TAB_ORDER.map((t, i) => [t.id, i]));

  const resolvedId =
    payload.jobId ?? payload.projectId ?? fallbackProjectId;

  const tabs = [...payload.tabs]
    .map((tab) => ({
      id: tab.id,
      label: tab.label,
      icon: (tab.icon ?? "file-text") as ProjectDetailTabIcon,
      content: inferTabContent(tab.content, tab.label),
    }))
    .sort((a, b) => {
      const ai = order.get(a.id) ?? 999;
      const bi = order.get(b.id) ?? 999;
      return ai - bi;
    });

  return {
    projectId: resolvedId,
    status: payload.status,
    tabs,
  };
}

export function normalizeProjectDetailResponse(
  projectId: string,
  payload: ProjectDetailRawResponse
): ProjectDetailData {
  const tabsPayload = extractTabsPayload(payload);
  if (tabsPayload) {
    return normalizeCanonicalPayload(projectId, tabsPayload);
  }

  if (isLegacyPayload(payload)) {
    return normalizeLegacyPayload(projectId, payload.data);
  }

  return normalizeLegacyPayload(projectId, {});
}
