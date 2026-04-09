import type { FolderNode } from "@/components/ui/FolderTree";

export function buildIdMap(nodes: FolderNode[]): Map<string, FolderNode> {
  const m = new Map<string, FolderNode>();
  const walk = (list: FolderNode[]) => {
    for (const n of list) {
      m.set(n.id, n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return m;
}

/**
 * Path string for POST /project-action `paths`.
 * Prefer label chain from the tree root so paths always match the UI hierarchy
 * (e.g. `extract_zip_output/3. Drawings`). `storagePath` alone can be missing or
 * incomplete for folders and would drop or break bulk download.
 */
export function nodeToProjectActionPath(
  node: FolderNode,
  treeRoots: FolderNode[]
): string | null {
  const chain = findPathToNode(treeRoots, node.id);
  if (chain && chain.length > 0) {
    return chain.map((n) => n.label).join("/");
  }
  const sp = node.storagePath?.trim().replace(/^\/+/, "");
  return sp || null;
}

/** Path from tree root to the node with `targetId` (inclusive). */
export function findPathToNode(
  nodes: FolderNode[],
  targetId: string,
  ancestors: FolderNode[] = []
): FolderNode[] | null {
  for (const n of nodes) {
    if (n.id === targetId) return [...ancestors, n];
    if (n.children?.length) {
      const found = findPathToNode(n.children, targetId, [...ancestors, n]);
      if (found) return found;
    }
  }
  return null;
}

export function normalizeProjectPathForMatch(s: string): string {
  return s
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

/**
 * Find a tree node whose `nodeToProjectActionPath` matches `projectPath`
 * (e.g. `extract_zip_output/doc.pdf`). Falls back to `storagePath` / suffix match on files.
 */
export function findNodeIdByProjectPath(
  treeRoots: FolderNode[],
  projectPath: string
): string | null {
  const target = normalizeProjectPathForMatch(projectPath);
  if (!target) return null;

  const walk = (nodes: FolderNode[]): string | null => {
    for (const n of nodes) {
      const p = nodeToProjectActionPath(n, treeRoots);
      if (p && normalizeProjectPathForMatch(p) === target) return n.id;
      if (n.kind === "file" && n.storagePath?.trim()) {
        const sp = normalizeProjectPathForMatch(n.storagePath);
        if (sp === target) return n.id;
      }
      if (n.children?.length) {
        const found = walk(n.children);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(treeRoots);
}

/** For Library deep-link: folder to show in listing + file row to highlight. */
export function findParentFolderIdForFilePath(
  treeRoots: FolderNode[],
  projectPath: string
): { fileId: string | null; parentId: string | null } {
  const fileId = findNodeIdByProjectPath(treeRoots, projectPath);
  if (!fileId) return { fileId: null, parentId: null };
  return parentIdsForFileNode(treeRoots, fileId);
}

function parentIdsForFileNode(
  treeRoots: FolderNode[],
  fileId: string
): { fileId: string | null; parentId: string | null } {
  const chain = findPathToNode(treeRoots, fileId);
  if (!chain || chain.length === 0)
    return { fileId, parentId: null };
  if (chain.length === 1) return { fileId, parentId: null };
  return {
    fileId,
    parentId: chain[chain.length - 2]!.id,
  };
}

/**
 * Match file by label only (e.g. `original_file_name` from API). First match wins.
 */
export function findFileNodeIdByLabel(
  treeRoots: FolderNode[],
  fileLabel: string
): string | null {
  const t = fileLabel.trim().toLowerCase();
  if (!t) return null;
  let found: string | null = null;
  const walk = (nodes: FolderNode[]) => {
    for (const n of nodes) {
      if (n.kind === "file" && n.label.trim().toLowerCase() === t) {
        found = n.id;
        return;
      }
      if (n.children?.length) walk(n.children);
    }
  };
  walk(treeRoots);
  return found;
}

/**
 * API may send a truncated `original_file_path` (no extension) while the real file path
 * starts with that prefix (e.g. prefix + " Phase3.pdf").
 */
export function findFileNodeByPathPrefixAndLabel(
  treeRoots: FolderNode[],
  pathPrefix: string,
  fileLabel: string
): string | null {
  const pref = normalizeProjectPathForMatch(pathPrefix);
  const label = fileLabel.trim().toLowerCase();
  if (!pref || !label) return null;

  const walk = (nodes: FolderNode[]): string | null => {
    for (const n of nodes) {
      if (n.kind === "file") {
        const full = nodeToProjectActionPath(n, treeRoots);
        if (!full) continue;
        const nf = normalizeProjectPathForMatch(full);
        if (n.label.trim().toLowerCase() === label && nf.startsWith(pref)) {
          return n.id;
        }
      }
      if (n.children?.length) {
        const inner = walk(n.children);
        if (inner) return inner;
      }
    }
    return null;
  };
  return walk(treeRoots);
}

function fileLabelMatchesExpected(
  fileLabel: string,
  expectedName: string
): boolean {
  return (
    fileLabel.trim().toLowerCase() === expectedName.trim().toLowerCase()
  );
}

/**
 * Resolve Research → Library deep link: exact file path, then prefix+name (truncated API paths),
 * then filename-only.
 *
 * Important: `findNodeIdByProjectPath` matches folders too. A truncated API path can equal a
 * folder's label chain — we must only treat **file** nodes as exact hits, and when `fileName`
 * is provided it must match the file label (so `text/data/foo.txt` + `name=bar.pdf` does not
 * highlight the .txt row).
 */
export function resolveLibraryDeepLinkFile(
  treeRoots: FolderNode[],
  filePath: string,
  fileName: string
): { fileId: string | null; parentId: string | null } {
  const pathTrim = filePath.trim();
  const nameTrim = fileName.trim();
  const idMap = buildIdMap(treeRoots);

  if (pathTrim) {
    const exact = findNodeIdByProjectPath(treeRoots, pathTrim);
    if (exact) {
      const node = idMap.get(exact);
      if (node?.kind === "file") {
        const nameOk =
          !nameTrim || fileLabelMatchesExpected(node.label, nameTrim);
        if (nameOk) return parentIdsForFileNode(treeRoots, exact);
      }
    }
  }

  if (pathTrim && nameTrim) {
    const byPrefix = findFileNodeByPathPrefixAndLabel(
      treeRoots,
      pathTrim,
      nameTrim
    );
    if (byPrefix) return parentIdsForFileNode(treeRoots, byPrefix);
  }

  if (nameTrim) {
    const byLabel = findFileNodeIdByLabel(treeRoots, nameTrim);
    if (byLabel) return parentIdsForFileNode(treeRoots, byLabel);
  }

  return { fileId: null, parentId: null };
}
