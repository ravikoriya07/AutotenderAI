import type { FolderNode } from "@/components/ui/FolderTree";

function safeSegment(s: string): string {
  return s.replace(/\s+/g, " ").trim() || "item";
}

function pickName(o: Record<string, unknown>): string {
  const n =
    o.name ??
    o.label ??
    o.filename ??
    o.file_name ??
    o.path ??
    o.title;
  if (typeof n === "string" && n.length > 0) return n;
  if (typeof n === "number") return String(n);
  return "Unknown";
}

function pickSize(o: Record<string, unknown>): number | undefined {
  if (typeof o.size === "number" && Number.isFinite(o.size)) return o.size;
  if (typeof o.file_size === "number" && Number.isFinite(o.file_size))
    return o.file_size;
  if (typeof o.bytes === "number" && Number.isFinite(o.bytes)) return o.bytes;
  return undefined;
}

function isExplicitFile(o: Record<string, unknown>): boolean {
  const t = String(o.type ?? o.kind ?? "").toLowerCase();
  return t === "file" || t === "blob";
}

function isExplicitFolder(o: Record<string, unknown>): boolean {
  const t = String(o.type ?? o.kind ?? "").toLowerCase();
  return (
    t === "folder" ||
    t === "directory" ||
    t === "dir" ||
    t === "tree"
  );
}

function looksLikeFileName(name: string): boolean {
  return /\.[a-z0-9]{1,8}$/i.test(name.trim());
}

function isLeafFile(
  o: Record<string, unknown>,
  childrenRaw: unknown,
  name: string
): boolean {
  if (isExplicitFile(o)) return true;
  if (isExplicitFolder(o)) return false;
  if (Array.isArray(childrenRaw) && childrenRaw.length > 0) return false;
  if (Array.isArray(childrenRaw) && childrenRaw.length === 0) return false;
  if (pickSize(o) != null) return true;
  if (childrenRaw == null && looksLikeFileName(name)) return true;
  return false;
}

/**
 * Normalizes one API node into a FolderNode. IDs are stable for the session
 * under a given parent path prefix.
 */
export function normalizeTreeNode(
  raw: unknown,
  parentPath: string,
  index: number
): FolderNode | null {
  if (raw == null) return null;

  if (typeof raw === "string") {
    const label = raw;
    const id = `${parentPath}/s-${index}-${encodeURIComponent(safeSegment(label))}`;
    return { id, label, kind: "file" };
  }

  if (typeof raw !== "object") return null;

  const o = raw as Record<string, unknown>;
  const name = pickName(o);
  const id = `${parentPath}/n-${index}-${encodeURIComponent(safeSegment(name))}`;
  const childrenRaw = o.children;
  const size = pickSize(o);
  const storagePath =
    typeof o.path === "string" && o.path.trim().length > 0
      ? o.path.trim().replace(/^\/+/, "")
      : undefined;

  if (isLeafFile(o, childrenRaw, name)) {
    return { id, label: name, kind: "file", size, storagePath };
  }

  const childList = Array.isArray(childrenRaw) ? childrenRaw : [];
  const children: FolderNode[] = [];
  childList.forEach((child, i) => {
    const n = normalizeTreeNode(child, id, i);
    if (n) children.push(n);
  });

  return {
    id,
    label: name,
    kind: "folder",
    children: children.length > 0 ? children : undefined,
    storagePath,
  };
}

/**
 * GET /project-tree/{job_id} → use only `tree[3]` (extract_zip_output branch).
 */
export function folderNodesFromProjectTreeResponse(api: unknown): FolderNode[] {
  if (!api || typeof api !== "object") return [];
  const o = api as Record<string, unknown>;
  const tree = o.tree;
  if (!Array.isArray(tree) || tree.length < 4) return [];
  const root = normalizeTreeNode(tree[3], "root", 0);
  return root ? [root] : [];
}

export function collectTreeStats(nodes: FolderNode[]): {
  totalBytes: number;
  fileCount: number;
} {
  let totalBytes = 0;
  let fileCount = 0;
  const walk = (list: FolderNode[]) => {
    for (const n of list) {
      if (n.kind === "file") {
        fileCount += 1;
        totalBytes += n.size ?? 0;
      }
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return { totalBytes, fileCount };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v < 10 && u > 0 ? v.toFixed(1) : Math.round(v)} ${units[u]}`;
}
