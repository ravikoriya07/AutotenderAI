import { cn } from "@/lib/utils";
import { CHASE_STATUS_CONFIG } from "@/features/inventory-management/config/chaseStatus";
import type { ChaseStatus } from "@/features/inventory-management/types";

type StatusBadgeProps = {
  status: ChaseStatus;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = CHASE_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        color: cfg.color,
        backgroundColor: cfg.background,
        borderColor: cfg.borderColor,
      }}
    >
      {cfg.label}
    </span>
  );
}

export function DataStatusDot({
  status,
}: {
  status: "ready" | "in-progress" | "not-started";
}) {
  const color =
    status === "ready"
      ? "text-[#107C10]"
      : status === "in-progress"
        ? "text-[#C47B00]"
        : "text-[#9BA3BF]";
  return (
    <span className={cn("text-[10px] leading-none", color)} aria-hidden>
      ●
    </span>
  );
}
