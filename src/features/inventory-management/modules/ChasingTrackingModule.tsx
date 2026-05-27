"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import { Button } from "@/components/ui/Button";
import { ChaseStatusCountBadge } from "@/features/inventory-management/components/chasing/ChaseStatusCountBadge";
import { ChaseStatusSelect } from "@/features/inventory-management/components/chasing/ChaseStatusSelect";
import { ModuleShell } from "@/features/inventory-management/components/layout/ModuleShell";
import {
  CHASE_STATUS_CONFIG,
  CHASE_STATUS_ORDER,
} from "@/features/inventory-management/config/chaseStatus";
import { fetchChaseRecords } from "@/features/inventory-management/services/inventoryManagementService";
import type { ChaseRecord, ChaseStatus } from "@/features/inventory-management/types";

export function ChasingTrackingModule() {
  const [records, setRecords] = useState<ChaseRecord[]>([]);
  const [tradeFilter, setTradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [noteDraftId, setNoteDraftId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    void fetchChaseRecords().then(setRecords);
  }, []);

  const trades = useMemo(
    () => Array.from(new Set(records.map((r) => r.trade))),
    [records]
  );

  const filtered = records.filter((r) => {
    if (tradeFilter !== "all" && r.trade !== tradeFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const statusCounts = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<ChaseStatus, number>>
  );

  const updateStatus = (id: number, status: ChaseStatus) => {
    setRecords((prev) =>
      prev.map((row) => (row.id === id ? { ...row, status } : row))
    );
  };

  const saveNote = (id: number) => {
    setRecords((prev) =>
      prev.map((row) => (row.id === id ? { ...row, notes: noteDraft } : row))
    );
    setNoteDraftId(null);
    setNoteDraft("");
  };

  return (
    <ModuleShell
      contentClassName="p-4 sm:p-6"
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-[#4A5272]"
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
            aria-label="Filter by trade"
          >
            <option value="all">All Trades</option>
            {trades.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-[#4A5272]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            {CHASE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {CHASE_STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
          <div className="flex flex-1 flex-wrap justify-end gap-2">
            {CHASE_STATUS_ORDER.filter((s) => statusCounts[s]).map((status) => (
              <ChaseStatusCountBadge
                key={status}
                status={status}
                count={statusCounts[status] ?? 0}
              />
            ))}
          </div>
          <Button type="button" variant="outline" size="sm">
            Export Excel
          </Button>
        </div>
      }
    >
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-[#F5F6FA] text-left">
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]">
                  Trade
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]">
                  Company / Contact
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]">
                  Sent
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]">
                  Return
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]">
                  Chaser 1
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]">
                  Chaser 2
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]">
                  Status
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-border hover:bg-[#F8F9FF]">
                    <td className="px-3 py-2.5 text-[12.5px] font-medium text-[#1A1A2E]">
                      {r.trade}
                    </td>
                    <td className="px-3 py-2.5 text-[#4A5272]">
                      <span className="block text-[13px] font-semibold text-[#1A1A2E]">
                        {r.company}
                      </span>
                      <span className="block text-[11.5px] text-[#6B7399]">
                        {r.name}
                      </span>
                      {r.notes ? (
                        <span className="mt-0.5 block text-[11px] italic text-[#C47B00]">
                          {r.notes}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] text-[#4A5272]">
                      {r.sentDate}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] font-semibold text-[#C47B00]">
                      {r.returnDate}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] text-[#4A5272]">
                      {r.chase1 || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] text-[#4A5272]">
                      {r.chase2 || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <ChaseStatusSelect
                        value={r.status}
                        onChange={(status) => updateStatus(r.id, status)}
                        aria-label={`Status for ${r.company}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-[#4A5272]"
                          onClick={() => {
                            setNoteDraftId(r.id);
                            setNoteDraft(r.notes);
                          }}
                        >
                          Note
                        </Button>
                        {r.whatsapp ? (
                          <Button
                            type="button"
                            size="sm"
                            className="border border-[rgba(18,140,74,0.25)] bg-[#E6F9EE] text-[#128C4A] hover:bg-[#E6F9EE]"
                          >
                            WA
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[#0F6CBD]"
                        >
                          Email
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {noteDraftId === r.id ? (
                    <tr className="border-b border-border">
                      <td colSpan={8} className="bg-[#FFF8E6] px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Add a note..."
                            className="h-9 min-w-[200px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveNote(r.id)}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setNoteDraftId(null);
                              setNoteDraft("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ModuleShell>
  );
}
