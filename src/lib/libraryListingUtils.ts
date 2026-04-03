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
