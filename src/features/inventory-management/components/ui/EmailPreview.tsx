"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmailPreviewProps = {
  to: string;
  subject: string;
  body: string;
  docsLink?: ReactNode;
  editing?: boolean;
  editValue?: string;
  onEditChange?: (value: string) => void;
  className?: string;
};

export function EmailPreview({
  to,
  subject,
  body,
  docsLink = (
    <span className="text-xs text-primary">View document package</span>
  ),
  editing = false,
  editValue,
  onEditChange,
  className,
}: EmailPreviewProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        className
      )}
    >
      <div className="space-y-1 border-b border-border bg-muted/30 px-4 py-3 text-sm sm:px-5">
        <div className="flex gap-2">
          <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">
            To
          </span>
          <span className="min-w-0 text-foreground">{to || "—"}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">
            Subject
          </span>
          <span className="min-w-0 font-medium text-amber-700">{subject || "—"}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">
            Docs
          </span>
          <span className="min-w-0">{docsLink}</span>
        </div>
      </div>
      {editing ? (
        <textarea
          className="min-h-[280px] w-full resize-y border-0 bg-background p-4 text-sm leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
          value={editValue ?? body}
          onChange={(e) => onEditChange?.(e.target.value)}
        />
      ) : (
        <pre className="whitespace-pre-wrap p-4 font-sans text-sm leading-relaxed text-muted-foreground sm:p-5">
          {body}
        </pre>
      )}
    </div>
  );
}
