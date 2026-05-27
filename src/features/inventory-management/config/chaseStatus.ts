import type { CSSProperties } from "react";
import type { ChaseStatus } from "@/features/inventory-management/types";

/** Legacy STATUS_CFG from inventory_management.html */
export type ChaseStatusConfig = {
  label: string;
  color: string;
  background: string;
  borderColor: string;
};

export const CHASE_STATUS_CONFIG: Record<ChaseStatus, ChaseStatusConfig> = {
  sent: {
    label: "Sent — Awaiting Response",
    color: "#0F6CBD",
    background: "#EFF6FC",
    borderColor: "rgba(15, 108, 189, 0.16)",
  },
  acknowledged: {
    label: "Acknowledged",
    color: "#0D7377",
    background: "#EBF7F7",
    borderColor: "rgba(13, 115, 119, 0.16)",
  },
  "quote-received": {
    label: "Quote Received",
    color: "#107C10",
    background: "#EFF8EF",
    borderColor: "rgba(16, 124, 16, 0.16)",
  },
  declined: {
    label: "Declined",
    color: "#C42B1C",
    background: "#FDF2F2",
    borderColor: "rgba(196, 43, 28, 0.16)",
  },
  "more-time": {
    label: "More Time Requested",
    color: "#C47B00",
    background: "#FFF8E6",
    borderColor: "rgba(196, 123, 0, 0.16)",
  },
  "no-response": {
    label: "No Response",
    color: "#C42B1C",
    background: "#FDF2F2",
    borderColor: "rgba(196, 43, 28, 0.16)",
  },
  query: {
    label: "Query Raised",
    color: "#5B3DA8",
    background: "#F4F0FB",
    borderColor: "rgba(91, 61, 168, 0.16)",
  },
  "bad-contact": {
    label: "Bad Contact Details",
    color: "#9BA3BF",
    background: "#F5F6FA",
    borderColor: "rgba(155, 163, 191, 0.25)",
  },
};

export const CHASE_STATUS_ORDER: ChaseStatus[] = [
  "sent",
  "acknowledged",
  "quote-received",
  "declined",
  "more-time",
  "no-response",
  "query",
  "bad-contact",
];

/** Short label for toolbar count chips (legacy uses first word of label). */
export function chaseStatusChipLabel(status: ChaseStatus): string {
  return CHASE_STATUS_CONFIG[status].label.split(" ")[0] ?? status;
}

export function getChaseStatusStyle(status: ChaseStatus): CSSProperties {
  const cfg = CHASE_STATUS_CONFIG[status];
  return {
    color: cfg.color,
    backgroundColor: cfg.background,
    borderColor: cfg.borderColor,
  };
}
