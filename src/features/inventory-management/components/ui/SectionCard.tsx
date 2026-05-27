import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type SectionCardProps = {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
};

export function SectionCard({
  children,
  className,
  header,
  footer,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        className
      )}
    >
      {header ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          {header}
        </div>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
      {footer ? (
        <div className="border-t border-border bg-muted/30 px-4 py-3 sm:px-5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
