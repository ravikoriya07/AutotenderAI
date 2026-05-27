import {
  CHASE_STATUS_CONFIG,
  chaseStatusChipLabel,
} from "@/features/inventory-management/config/chaseStatus";
import type { ChaseStatus } from "@/features/inventory-management/types";

type ChaseStatusCountBadgeProps = {
  status: ChaseStatus;
  count: number;
};

export function ChaseStatusCountBadge({ status, count }: ChaseStatusCountBadgeProps) {
  const cfg = CHASE_STATUS_CONFIG[status];

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{
        color: cfg.color,
        backgroundColor: cfg.background,
        borderColor: cfg.borderColor,
      }}
    >
      {count} {chaseStatusChipLabel(status)}
    </span>
  );
}
