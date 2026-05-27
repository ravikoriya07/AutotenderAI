"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/Button";
import { ModuleShell } from "@/features/inventory-management/components/layout/ModuleShell";
import { EmailPreview } from "@/features/inventory-management/components/ui/EmailPreview";
import { TradeList } from "@/features/inventory-management/components/ui/TradeList";
import { useInventoryWorkflow } from "@/features/inventory-management/context/InventoryWorkflowContext";
import {
  fetchContactsByTrade,
  fetchInventoryTrades,
} from "@/features/inventory-management/services/inventoryManagementService";
import type { InventoryContact, InventoryTrade } from "@/features/inventory-management/types";
import { cn } from "@/lib/utils";

function buildEmailBody(
  contact: InventoryContact,
  projectName: string,
  returnDate: string,
  includeWorks: boolean,
  worksSnippet: string
): string {
  const works = includeWorks
    ? `\n\nWorks summary:\n${worksSnippet}\n`
    : "";
  return `Dear ${contact.name},

We are inviting you to submit a quotation for the ${projectName} project.

Please return your quotation by ${returnDate}.${works}

Kind regards,
DCK Construction`;
}

export function EnquiryGenerationModule() {
  const {
    projectDetails,
    activeTradeId,
    setActiveTradeId,
    enquiryReturnDate,
    setEnquiryReturnDate,
    enquiryFolderLink,
    setEnquiryFolderLink,
    includeWorksSummary,
    setIncludeWorksSummary,
    sentEnquiries,
    markEnquirySent,
    addSendLogEntry,
    sendLog,
  } = useInventoryWorkflow();

  const [trades, setTrades] = useState<InventoryTrade[]>([]);
  const [contacts, setContacts] = useState<InventoryContact[]>([]);
  const [activeContactId, setActiveContactId] = useState<number | null>(null);
  const [subView, setSubView] = useState<"compose" | "log">("compose");
  const [editing, setEditing] = useState(false);
  const [emailBodyOverride, setEmailBodyOverride] = useState<string | null>(null);

  useEffect(() => {
    void fetchInventoryTrades().then((list) => {
      setTrades(list);
      if (!activeTradeId && list[0]) setActiveTradeId(list[0].id);
    });
  }, [activeTradeId, setActiveTradeId]);

  const loadContacts = useCallback(async () => {
    if (!activeTradeId) return;
    const list = await fetchContactsByTrade(activeTradeId);
    setContacts(list);
    if (list[0] && activeContactId == null) setActiveContactId(list[0].id);
  }, [activeTradeId, activeContactId]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const activeContact = contacts.find((c) => c.id === activeContactId);
  const activeTrade = trades.find((t) => t.id === activeTradeId);

  const worksSnippet = [
    projectDetails.worksGeneral,
    projectDetails.worksMechanical,
    projectDetails.worksElectrical,
  ]
    .filter(Boolean)
    .join("\n");

  const generatedBody = activeContact
    ? buildEmailBody(
        activeContact,
        projectDetails.projectName,
        enquiryReturnDate,
        includeWorksSummary,
        worksSnippet
      )
    : "";

  const displayBody = emailBodyOverride ?? generatedBody;

  const subject = activeTrade
    ? `DCK Construction Ltd – Tender Enquiry – ${projectDetails.client} – ${projectDetails.projectName} – ${activeTrade.label}`
    : "";

  const isActiveSent = activeContact
    ? sentEnquiries.has(activeContact.id)
    : false;

  const sendEmail = () => {
    if (!activeContact || !activeTrade || isActiveSent) return;
    markEnquirySent(activeContact.id);
    addSendLogEntry({
      trade: activeTrade.label,
      company: activeContact.company,
      contact: activeContact.name,
      sentAt: new Date().toLocaleString("en-GB"),
    });
    toast.success(`Enquiry sent to ${activeContact.company}`);
    setEmailBodyOverride(null);
    setEditing(false);
  };

  const composePanel = (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <TradeList
        trades={trades}
        activeId={activeTradeId}
        onSelect={(id) => {
          setActiveTradeId(id);
          setActiveContactId(null);
          setEmailBodyOverride(null);
        }}
        title="Trades"
        className="h-full min-h-0"
      />
      <div className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-border bg-card lg:w-64 lg:border-r">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">{activeTrade?.label ?? "Select a trade"}</p>
          <p className="text-xs text-muted-foreground">{contacts.length} contacts</p>
        </div>
        <div className="shrink-0 space-y-3 border-b border-border bg-muted/20 p-3">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Return Date
            <input
              className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              value={enquiryReturnDate}
              onChange={(e) => setEnquiryReturnDate(e.target.value)}
            />
          </label>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Folder Link
            <input
              className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-primary"
              value={enquiryFolderLink}
              onChange={(e) => setEnquiryFolderLink(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-primary"
              checked={includeWorksSummary}
              onChange={(e) => setIncludeWorksSummary(e.target.checked)}
            />
            Include Works Summary
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {contacts.map((c) => {
            const sent = sentEnquiries.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveContactId(c.id);
                  setEmailBodyOverride(null);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5 text-left text-sm transition-colors",
                  activeContactId === c.id
                    ? "border-l-2 border-l-primary bg-primary/5"
                    : "hover:bg-muted/50"
                )}
              >
                <span>
                  <span className="block font-medium">{c.company}</span>
                  <span className="text-xs text-muted-foreground">{c.name}</span>
                </span>
                <span
                  className={cn(
                    "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                    sent
                      ? "border border-green-600/25 bg-green-50 text-green-700"
                      : "bg-muted px-2 py-0.5 text-muted-foreground"
                  )}
                >
                  {sent ? "✓" : "Pending"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="shrink-0 border-t border-border p-3">
          {contacts.length > 0 &&
          contacts.every((c) => sentEnquiries.has(c.id)) ? (
            <Button type="button" className="w-full" disabled>
              ✓ All Sent
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full"
              disabled={contacts.length === 0}
              onClick={() => {
                if (
                  !confirm(
                    `Send ${contacts.length} individual emails via Outlook?`
                  )
                ) {
                  return;
                }
                contacts.forEach((c) => {
                  if (!sentEnquiries.has(c.id)) {
                    markEnquirySent(c.id);
                    addSendLogEntry({
                      trade: activeTrade?.label ?? "",
                      company: c.company,
                      contact: c.name,
                      sentAt: new Date().toLocaleString("en-GB"),
                    });
                  }
                });
                toast.success(`Queued ${contacts.length} enquiries`);
              }}
            >
              Send All {contacts.length} via Outlook
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {activeContact?.company ?? "Select a contact"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeContact
                ? `${activeContact.name} · ${activeContact.email}`
                : "Choose a contact to preview the email"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!activeContact}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Done Editing" : "Edit Email"}
            </Button>
            {isActiveSent ? (
              <Button
                type="button"
                size="sm"
                disabled
                className="cursor-default border border-green-600/25 bg-green-50 text-green-700 hover:bg-green-50"
              >
                ✓ Sent
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={!activeContact}
                onClick={sendEmail}
              >
                Send This Email →
              </Button>
            )}
          </div>
        </div>
        <EmailPreview
          to={
            activeContact
              ? `${activeContact.name} <${activeContact.email}>`
              : ""
          }
          subject={subject}
          body={displayBody}
          docsLink={
            <Link
              href="/inventory-management/document-abstraction"
              className="text-xs text-primary hover:underline"
            >
              View document package
            </Link>
          }
          editing={editing}
          editValue={displayBody}
          onEditChange={setEmailBodyOverride}
        />
      </div>
    </div>
  );

  return (
    <ModuleShell
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      toolbar={
        <div className="flex gap-1">
          {(["compose", "log"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSubView(tab)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                subView === tab
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {tab === "compose" ? "Compose & Send" : "Send Log"}
            </button>
          ))}
        </div>
      }
    >
      {subView === "compose" ? (
        composePanel
      ) : sendLog.length === 0 ? (
        <p className="overflow-y-auto p-4 py-16 text-center text-sm text-muted-foreground sm:p-6">
          No emails sent yet
        </p>
      ) : (
        <ul className="space-y-2 overflow-y-auto p-4 sm:p-6">
          {sendLog.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg border border-border bg-card px-4 py-3 text-sm"
            >
              <span className="font-medium">{entry.company}</span>
              <span className="text-muted-foreground"> · {entry.trade}</span>
              <div className="text-xs text-muted-foreground">
                {entry.contact} — {entry.sentAt}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ModuleShell>
  );
}
