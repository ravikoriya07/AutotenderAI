import { nodeToProjectActionPath } from "@/lib/libraryListingUtils";
import { folderNodesFromProjectTreeResponse } from "@/lib/projectTreeNormalize";
import { fetchProjectTree, postProjectAction } from "@/services/projectService";
import type { FolderNode } from "@/components/ui/FolderTree";
import {
  blobLooksLikeZipFamily,
  fallbackDownloadFilename,
  parseContentDispositionFilename,
} from "@/lib/downloadFilename";

/**
 * Contexts from Neo4j/query often use absolute worker paths like
 * `/workspace/Job_outputs/job_<uuid>/text/data/foo.txt`.
 * POST /project-action expects paths relative to the job output root (e.g. `text/data/foo.txt`),
 * and the Library uses the **label chain** under `extract_zip_output` from GET /project-tree.
 */
export function jobOutputAbsolutePathToProjectRelative(storagePath: string): string {
  const p = storagePath.trim().replace(/\\/g, "/");
  const m = /\/Job_outputs\/job_[^/]+\/(.+)$/i.exec(p);
  if (m?.[1]) return m[1];
  return p.replace(/^\/+/, "");
}

function normalizePathKey(s: string): string {
  return decodeURIComponent(s)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function walkFiles(nodes: FolderNode[]): FolderNode[] {
  const out: FolderNode[] = [];
  const w = (list: FolderNode[]) => {
    for (const n of list) {
      if (n.kind === "file") out.push(n);
      if (n.children?.length) w(n.children);
    }
  };
  w(nodes);
  return out;
}

/**
 * Map a context `file` path to the same path string the Library sends to POST /project-action
 * (label chain under extract_zip_output), using GET /project-tree.
 */
export async function resolveProjectActionPathFromContextPath(
  jobId: string,
  contextPath: string,
  signal?: AbortSignal
): Promise<string | null> {
  const trimmedJob = jobId.trim();
  if (!trimmedJob) return null;

  const rel = normalizePathKey(jobOutputAbsolutePathToProjectRelative(contextPath));
  const basename = rel.split("/").pop() ?? "";

  let rawTree: unknown;
  try {
    rawTree = await fetchProjectTree(trimmedJob, signal);
  } catch {
    return null;
  }

  const treeNodes = folderNodesFromProjectTreeResponse(rawTree);
  if (!treeNodes.length) return null;

  const files = walkFiles(treeNodes);
  const scored: { path: string; score: number }[] = [];

  for (const node of files) {
    const actionPath = nodeToProjectActionPath(node, treeNodes);
    if (!actionPath) continue;

    const ap = normalizePathKey(actionPath);
    const sp = node.storagePath ? normalizePathKey(node.storagePath) : "";
    const label = normalizePathKey(node.label);

    let score = 0;
    if (rel && sp && rel === sp) score = 100;
    else if (rel && sp && (sp.endsWith("/" + rel) || sp.endsWith(rel))) score = 92;
    else if (rel && sp && (rel.endsWith("/" + sp) || rel.endsWith(sp))) score = 88;
    else if (rel && ap.endsWith("/" + rel)) score = 82;
    else if (rel && ap.endsWith(rel)) score = 78;
    else if (basename && label === basename) score = 55;
    else if (basename && ap.endsWith("/" + basename)) score = 50;

    if (score > 0) scored.push({ path: actionPath, score });
  }

  if (!scored.length) return null;

  scored.sort(
    (a, b) => b.score - a.score || b.path.length - a.path.length
  );

  const top = scored[0]!;
  const tied = scored.filter((s) => s.score === top.score);
  if (tied.length > 1 && top.score <= 55) {
    return null;
  }

  return top.path;
}

async function attemptProjectDownload(
  jobId: string,
  path: string
): Promise<boolean> {
  const trimmed = path.trim();
  if (!trimmed) return false;

  try {
    const result = await postProjectAction(jobId, "download", [trimmed]);
    if (result.kind !== "blob" || result.blob.size <= 0) return false;

    const ct = (result.contentType ?? "").toLowerCase();
    const zipLike = await blobLooksLikeZipFamily(result.blob);
    const probablyJsonError =
      ct.includes("application/json") ||
      (!zipLike &&
        result.blob.size < 65536 &&
        (await result.blob.slice(0, 1).text()) === "{");
    if (probablyJsonError) {
      try {
        const text = await result.blob.text();
        console.log("project-action download error body", text);
      } catch (e) {
        console.log("project-action download error (read failed)", e);
      }
      return false;
    }

    const fallbackZip = `library-${jobId}.zip`;
    const filename =
      parseContentDispositionFilename(result.contentDisposition) ??
      (fallbackDownloadFilename(trimmed, result.contentType, zipLike) ||
        fallbackZip);
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.log("project-action download request failed", e);
    return false;
  }
}

/**
 * Download a single file using the same path contract as the Library listing.
 * Context paths from research are resolved via GET /project-tree when a direct path fails.
 */
export async function downloadProjectStoragePath(
  jobId: string,
  storagePath: string,
  signal?: AbortSignal
): Promise<boolean> {
  const effectiveJobId = jobId.trim();
  const raw = storagePath.trim();
  if (!effectiveJobId || !raw) return false;

  const directRel = jobOutputAbsolutePathToProjectRelative(raw);

  if (await attemptProjectDownload(effectiveJobId, directRel)) return true;

  const resolved = await resolveProjectActionPathFromContextPath(
    effectiveJobId,
    raw,
    signal
  );
  if (!resolved || resolved === directRel) return false;

  return attemptProjectDownload(effectiveJobId, resolved);
}

export function isLikelyProjectStoragePath(path: string): boolean {
  const t = path.trim();
  if (!t || /^https?:\/\//i.test(t)) return false;
  return true;
}
