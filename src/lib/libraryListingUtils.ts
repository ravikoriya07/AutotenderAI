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
