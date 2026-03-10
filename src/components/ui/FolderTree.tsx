"use client";

import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface FolderNode {
  id: string;
  label: string;
  children?: FolderNode[];
}

interface FolderTreeProps {
  nodes: FolderNode[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

function TreeNode({
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
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-sidebar-foreground/10",
          isSelected && "bg-primary/20 text-primary"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (hasChildren) setOpen(!open);
          onSelect?.(node.id);
        }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
            className="p-0.5"
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        {open && hasChildren ? (
          <FolderOpen className="h-4 w-4 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{node.label}</span>
      </div>
      {open && hasChildren && (
        <div>
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
}

export function FolderTree({
  nodes,
  selectedId,
  onSelect,
  className,
}: FolderTreeProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
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
