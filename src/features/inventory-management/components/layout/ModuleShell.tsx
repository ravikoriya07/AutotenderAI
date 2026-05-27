"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ModuleShellProps = {
  sidebar?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/** Two-column module body: optional internal sidebar + scrollable main. */
export function ModuleShell({
  sidebar,
  toolbar,
  footer,
  children,
  className,
  contentClassName,
}: ModuleShellProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {toolbar ? (
        <div className="shrink-0 border-b border-border bg-card px-4 py-2.5 sm:px-5">
          {toolbar}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {sidebar}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-border bg-card">{footer}</div>
      ) : null}
    </div>
  );
}
