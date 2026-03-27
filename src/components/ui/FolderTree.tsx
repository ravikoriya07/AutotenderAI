"use client";

import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
} from "lucide-react";
import { memo, useState } from "react";
import { cn } from "@/lib/utils";

export interface FolderNode {
  id: string;
  label: string;
  children?: FolderNode[];
  /** When set to `file`, node is a leaf file. */
  kind?: "folder" | "file";
  /** Byte size for files when known. */
  size?: number;
}

interface FolderTreeProps {
  nodes: FolderNode[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

const TreeNode = memo(function TreeNode({
  node,
  selectedId,
  onSelect,
  level = 0,
}: {
  node: FolderNode;
  selectedId?: string;
  onSelect?: (id: string) => void;
  level?: number;
}) {
  const isFile = node.kind === "file";
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const expandable = !isFile && hasChildren;
  const [open, setOpen] = useState(false);
  const isSelected = selectedId === node.id;

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(node.id);
    if (expandable) setOpen((o) => !o);
  };

  const handleRowClick = () => {
    onSelect?.(node.id);
    if (expandable) setOpen((o) => !o);
  };

  return (
    <div className="w-full min-w-0 max-w-full select-none">
      <div
        className={cn(
          "flex w-full min-w-0 max-w-full cursor-pointer items-center gap-1 overflow-hidden rounded px-2 py-1.5 text-sm hover:bg-sidebar-foreground/10",
          isSelected && "bg-primary/20 text-primary"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleRowClick}
      >
        {expandable ? (
          <button
            type="button"
            onClick={handleChevronClick}
            className="shrink-0 rounded p-0.5 hover:bg-sidebar-foreground/10"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" aria-hidden />
        )}
        {isFile ? (
          <File className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : open && hasChildren ? (
          <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <Folder className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span
          className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
          title={node.label}
        >
          {node.label}
        </span>
      </div>
      {open && hasChildren && (
        <div className="min-w-0 max-w-full overflow-hidden">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function FolderTree({
  nodes,
  selectedId,
  onSelect,
  className,
}: FolderTreeProps) {
  return (
    <div className={cn("w-full min-w-0 max-w-full space-y-0.5", className)}>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
