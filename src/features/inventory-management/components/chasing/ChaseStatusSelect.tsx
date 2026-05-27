"use client";

import {
  CHASE_STATUS_CONFIG,
  CHASE_STATUS_ORDER,
} from "@/features/inventory-management/config/chaseStatus";
import type { ChaseStatus } from "@/features/inventory-management/types";

type ChaseStatusSelectProps = {
  value: ChaseStatus;
  onChange: (status: ChaseStatus) => void;
  "aria-label"?: string;
};

export function ChaseStatusSelect({
  value,
  onChange,
  "aria-label": ariaLabel,
}: ChaseStatusSelectProps) {
  const cfg = CHASE_STATUS_CONFIG[value];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ChaseStatus)}
      aria-label={ariaLabel}
      className="h-8 max-w-full cursor-pointer rounded-md border px-2 text-xs font-medium"
      style={{
        color: cfg.color,
        backgroundColor: cfg.background,
        borderColor: cfg.borderColor,
      }}
    >
      {CHASE_STATUS_ORDER.map((status) => (
        <option key={status} value={status}>
          {CHASE_STATUS_CONFIG[status].label}
        </option>
      ))}
    </select>
  );
}
