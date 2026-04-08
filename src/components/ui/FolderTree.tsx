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
  /** When set, file names are clickable and call this (no separate “view” icon). */
  onViewFile?: (node: FolderNode) => void;
  /** `"light"` uses muted hovers for light panels; `"sidebar"` is for dark `bg-sidebar` overlays. */
  variant?: "default" | "light" | "sidebar";
}

const rowHover =
  "hover:bg-sidebar-foreground/10" as const;
const rowHoverLight = "hover:bg-muted/90" as const;
const rowHoverSidebar = "hover:bg-sidebar-foreground/10" as const;

const TreeNode = memo(function TreeNode({
  node,
  selectedId,
  onSelect,
  level = 0,
  defaultExpandAll,
  fileLeafIcon,
  onViewFile,
  variant = "default",
}: {
  node: FolderNode;
  selectedId?: string;
  onSelect?: (id: string) => void;
  level?: number;
  defaultExpandAll?: boolean;
  fileLeafIcon?: "default" | "pdf";
  onViewFile?: (node: FolderNode) => void;
  variant?: "default" | "light" | "sidebar";
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

  const rowHoverClass =
    variant === "light"
      ? rowHoverLight
      : variant === "sidebar"
        ? rowHoverSidebar
        : rowHover;
  const rowTextClass =
    variant === "sidebar"
      ? "text-sidebar-foreground"
      : "text-foreground";

  return (
    <div className="w-full min-w-0 max-w-full select-none">
      <div
        className={cn(
          "flex w-full min-w-0 max-w-full cursor-pointer items-center gap-2 overflow-x-hidden rounded px-2 py-2 text-sm sm:py-1.5",
          rowTextClass,
          rowHoverClass,
          isSelected && "bg-primary/20 text-primary"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleRowClick}
      >
        {expandable ? (
          <button
            type="button"
            onClick={handleChevronClick}
            className={cn("shrink-0 rounded p-0.5", rowHoverClass)}
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
          <File
            className={cn(
              "h-4 w-4 shrink-0",
              variant === "sidebar"
                ? "text-sidebar-foreground/55"
                : "text-muted-foreground"
            )}
            aria-hidden
          />
        ) : open && hasChildren ? (
          <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <Folder className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {isFile && onViewFile ? (
          <button
            type="button"
            className={cn(
              "min-w-0 flex-1 text-left text-sm leading-snug hover:underline hover:underline-offset-2",
              "break-words [overflow-wrap:anywhere] sm:truncate sm:overflow-hidden sm:text-ellipsis sm:whitespace-nowrap sm:leading-normal"
            )}
            title={node.label}
            onClick={(e) => {
              e.stopPropagation();
              onViewFile(node);
            }}
          >
            {node.label}
          </button>
        ) : (
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
        )}
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
              variant={variant}
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
  variant = "default",
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
          variant={variant}
        />
      ))}
    </div>
  );
}
