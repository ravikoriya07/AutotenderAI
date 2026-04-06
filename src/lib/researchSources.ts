import { basenameFromStoragePath } from "@/lib/downloadFilename";

export type ResearchSourceFile = {
  id: string;
  label: string;
  path: string;
  /** When true, `path` is an http(s) URL — open instead of project download. */
  isExternalUrl: boolean;
};

/** Derive number of sources from API `contexts` (shape varies by backend). */
export function countResearchSources(contexts: unknown): number {
  if (contexts == null) return 0;
  if (Array.isArray(contexts)) return contexts.length;
  if (typeof contexts === "object") {
    const o = contexts as Record<string, unknown>;
    if (Array.isArray(o.sources)) return o.sources.length;
    if (Array.isArray(o.documents)) return o.documents.length;
    if (Array.isArray(o.contexts)) return o.contexts.length;
    if (Array.isArray(o.files)) return o.files.length;
    if (typeof o.count === "number" && Number.isFinite(o.count)) {
      return Math.max(0, Math.floor(o.count));
    }
  }
  return 0;
}

function extractRawSourceArray(contexts: unknown): unknown[] {
  if (Array.isArray(contexts)) return contexts;
  if (contexts && typeof contexts === "object") {
    const o = contexts as Record<string, unknown>;
    if (Array.isArray(o.sources)) return o.sources;
    if (Array.isArray(o.documents)) return o.documents;
    if (Array.isArray(o.contexts)) return o.contexts;
    if (Array.isArray(o.files)) return o.files;
  }
  return [];
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function normalizeOneSource(item: unknown, index: number): ResearchSourceFile | null {
  if (typeof item === "string") {
    const raw = item.trim();
    if (!raw) return null;
    const external = isHttpUrl(raw);
    return {
      id: `src-${index}`,
      label: external ? raw : basenameFromStoragePath(raw),
      path: raw,
      isExternalUrl: external,
    };
  }
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const meta =
    o.metadata && typeof o.metadata === "object"
      ? (o.metadata as Record<string, unknown>)
      : null;
  const pathCandidates = [
    o.path,
    o.file,
    o.file_path,
    o.storage_path,
    o.storagePath,
    o.uri,
    o.url,
    meta?.path,
    meta?.file,
    meta?.file_path,
    meta?.storage_path,
  ];
  const pathRaw = pathCandidates.find(
    (x): x is string => typeof x === "string" && x.trim().length > 0
  );
  if (!pathRaw) return null;
  const path = pathRaw.trim();
  const external = isHttpUrl(path);
  const nameCandidates = [
    o.file_name,
    o.filename,
    meta?.file_name,
    meta?.filename,
    meta?.name,
    meta?.title,
    o.name,
    o.title,
    o.label,
  ];
  const named = nameCandidates.find(
    (x): x is string => typeof x === "string" && x.trim().length > 0
  );
  const label =
    (named?.trim() || (external ? path : basenameFromStoragePath(path))) ||
    "Source";
  const idRaw = o.id;
  const id =
    typeof idRaw === "string" && idRaw.trim()
      ? idRaw.trim()
      : typeof idRaw === "number" && Number.isFinite(idRaw)
        ? `src-${idRaw}`
        : `src-${index}`;
  return { id, label, path, isExternalUrl: external };
}

/** Map API `contexts` into rows suitable for UI + project download paths. */
export function normalizeResearchSources(contexts: unknown): ResearchSourceFile[] {
  const raw = extractRawSourceArray(contexts);
  const out: ResearchSourceFile[] = [];
  for (let i = 0; i < raw.length; i++) {
    const one = normalizeOneSource(raw[i], i);
    if (one) out.push(one);
  }
  return out;
}

/** Same key as the research sources sidebar uses to group chunks by file. */
export function researchSourceGroupingKey(file: ResearchSourceFile): string {
  const p = file.path.trim().toLowerCase().replace(/\\/g, "/");
  return p || file.id;
}

export type GroupedResearchSource = {
  key: string;
  file: ResearchSourceFile;
  count: number;
};

export function groupResearchSourceFiles(
  files: ResearchSourceFile[]
): GroupedResearchSource[] {
  const m = new Map<string, ResearchSourceFile[]>();
  for (const f of files) {
    const k = researchSourceGroupingKey(f);
    const arr = m.get(k) ?? [];
    arr.push(f);
    m.set(k, arr);
  }
  return [...m.entries()].map(([key, arr]) => ({
    key,
    file: arr[0],
    count: arr.length,
  }));
}

/**
 * Count that matches the sidebar: **unique files** when contexts parse to paths.
 * Falls back to raw reference count when nothing parses.
 */
export function countUniqueResearchSourceFiles(contexts: unknown): number {
  const files = normalizeResearchSources(contexts);
  if (files.length === 0) {
    return countResearchSources(contexts);
  }
  return groupResearchSourceFiles(files).length;
}

/** Total reference rows (chunks); can exceed unique file count. */
export function countResearchSourceReferences(contexts: unknown): number {
  return Math.max(
    countResearchSources(contexts),
    normalizeResearchSources(contexts).length
  );
}

/** Legacy aggregate for “how many raw items”; prefer `countUniqueResearchSourceFiles` for badges. */
export function displayResearchSourceCount(contexts: unknown): number {
  return countResearchSourceReferences(contexts);
}
