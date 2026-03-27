"use client";

import { File, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

export type FileManagerIconKind = "folder" | "pdf" | "word" | "excel" | "file";

export function getFileManagerIconKind(
  label: string,
  isFolder: boolean
): FileManagerIconKind {
  if (isFolder) return "folder";
  const parts = label.split(".");
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() ?? "" : "";
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "word";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "excel";
  return "file";
}

export function getItemTypeLabel(kind: FileManagerIconKind): string {
  switch (kind) {
    case "folder":
      return "Folder";
    case "pdf":
      return "PDF";
    case "word":
      return "Word";
    case "excel":
      return "Excel";
    default:
      return "File";
  }
}

export function FileManagerItemIcon({
  kind,
  className,
}: {
  kind: FileManagerIconKind;
  className?: string;
}) {
  if (kind === "folder") {
    return (
      <Folder
        className={cn("h-5 w-5 shrink-0 text-muted-foreground", className)}
        aria-hidden
      />
    );
  }
  if (kind === "pdf") {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e11d48] text-[10px] font-bold leading-none text-white",
          className
        )}
        aria-hidden
      >
        PDF
      </span>
    );
  }
  if (kind === "word") {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#2b579a] text-sm font-bold leading-none text-white",
          className
        )}
        aria-hidden
      >
        W
      </span>
    );
  }
  if (kind === "excel") {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#217346] text-sm font-bold leading-none text-white",
          className
        )}
        aria-hidden
      >
        X
      </span>
    );
  }
  return (
    <File
      className={cn("h-5 w-5 shrink-0 text-muted-foreground", className)}
      aria-hidden
    />
  );
}
