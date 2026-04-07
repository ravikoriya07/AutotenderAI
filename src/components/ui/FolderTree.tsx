"use client";

import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  Eye,
} from "lucide-react";
import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  FileManagerItemIcon,
  getFileManagerIconKind,
} from "@/components/library/FileManagerItemIcon";

export interface FolderNode {
  id: string;
  label: string;
  children?: FolderNode[];
  /** When set to `file`, node is a leaf file. */
  kind?: "folder" | "file";
  /** Byte size for files when known. */
  size?: number;
  /** Server path for project-action API (e.g. extract_zip_output/file.pdf). */
  storagePath?: string;
}

interface FolderTreeProps {
  nodes: FolderNode[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  /** Folders with children start expanded (e.g. Quantity take-off full tree). */
  defaultExpandAll?: boolean;
  /** Use library PDF-style badge for file leaves when `"pdf"`. */
  fileLeafIcon?: "default" | "pdf";
  /** Optional view action on file rows (icon on the right). */
  onViewFile?: (node: FolderNode) => void;
}

const TreeNode = memo(function TreeNode({
  node,
  selectedId,
  onSelect,
  level = 0,
  defaultExpandAll,
  fileLeafIcon,
  onViewFile,
}: {
  node: FolderNode;
  selectedId?: string;
  onSelect?: (id: string) => void;
  level?: number;
  defaultExpandAll?: boolean;
  fileLeafIcon?: "default" | "pdf";
  onViewFile?: (node: FolderNode) => void;
}) {
  const isFile = node.kind === "file";
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const expandable = !isFile && hasChildren;
  const [open, setOpen] = useState(
    () => Boolean(defaultExpandAll && expandable)
  );
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
          "flex w-full min-w-0 max-w-full cursor-pointer items-center gap-2 overflow-x-hidden rounded px-2 py-2 text-sm hover:bg-sidebar-foreground/10 sm:py-1.5",
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
        {isFile && fileLeafIcon === "pdf" ? (
          <span className="inline-flex shrink-0 items-center self-center">
            <FileManagerItemIcon kind={getFileManagerIconKind(node.label, false)} />
          </span>
        ) : isFile ? (
          <File className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : open && hasChildren ? (
          <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <Folder className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 text-sm leading-snug",
            isFile
              ? "break-words [overflow-wrap:anywhere] sm:truncate sm:overflow-hidden sm:text-ellipsis sm:whitespace-nowrap sm:leading-normal"
              : "truncate whitespace-nowrap"
          )}
          title={node.label}
        >
          {node.label}
        </span>
        {isFile && onViewFile ? (
          <button
            type="button"
            className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-foreground/10 hover:text-foreground sm:min-h-0 sm:min-w-0 sm:p-1"
            aria-label={`View ${node.label}`}
            title="View"
            onClick={(e) => {
              e.stopPropagation();
              onViewFile(node);
            }}
          >
            <Eye className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        ) : null}
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
              defaultExpandAll={defaultExpandAll}
              fileLeafIcon={fileLeafIcon}
              onViewFile={onViewFile}
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
  defaultExpandAll,
  fileLeafIcon,
  onViewFile,
}: FolderTreeProps) {
  return (
    <div className={cn("w-full min-w-0 max-w-full space-y-0.5", className)}>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
          defaultExpandAll={defaultExpandAll}
          fileLeafIcon={fileLeafIcon}
          onViewFile={onViewFile}
        />
      ))}
    </div>
  );
}
