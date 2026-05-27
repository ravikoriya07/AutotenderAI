"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_PROJECT_DETAILS } from "@/features/inventory-management/data/mock-data";
import { ALL_CONTRACTORS_ID } from "@/features/inventory-management/types/contractor-database";
import type {
  EnquirySendLogEntry,
  ProjectDetailsFormValues,
} from "@/features/inventory-management/types";

type InventoryWorkflowContextValue = {
  projectDetails: ProjectDetailsFormValues;
  setProjectDetails: (values: ProjectDetailsFormValues) => void;
  activeTradeId: string | null;
  setActiveTradeId: (id: string | null) => void;
  selectedContactIds: Set<number>;
  toggleContactSelection: (id: number) => void;
  selectMultipleContacts: (ids: number[]) => void;
  deselectContactIds: (ids: number[]) => void;
  clearContactSelection: () => void;
  enquiryReturnDate: string;
  setEnquiryReturnDate: (v: string) => void;
  enquiryFolderLink: string;
  setEnquiryFolderLink: (v: string) => void;
  includeWorksSummary: boolean;
  setIncludeWorksSummary: (v: boolean) => void;
  sentEnquiries: Set<number>;
  markEnquirySent: (contactId: number) => void;
  sendLog: EnquirySendLogEntry[];
  addSendLogEntry: (entry: Omit<EnquirySendLogEntry, "id">) => void;
};

const InventoryWorkflowContext =
  createContext<InventoryWorkflowContextValue | null>(null);

export function InventoryWorkflowProvider({ children }: { children: ReactNode }) {
  const [projectDetails, setProjectDetails] =
    useState<ProjectDetailsFormValues>(DEFAULT_PROJECT_DETAILS);
  const [activeTradeId, setActiveTradeId] = useState<string | null>(
    ALL_CONTRACTORS_ID
  );
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(
    () => new Set()
  );
  const [enquiryReturnDate, setEnquiryReturnDate] = useState(
    DEFAULT_PROJECT_DETAILS.globalReturnDate
  );
  const [enquiryFolderLink, setEnquiryFolderLink] = useState(
    "https://dck.sharepoint.com/:f:/s/LBH40CR"
  );
  const [includeWorksSummary, setIncludeWorksSummary] = useState(true);
  const [sentEnquiries, setSentEnquiries] = useState<Set<number>>(() => new Set());
  const [sendLog, setSendLog] = useState<EnquirySendLogEntry[]>([]);

  const toggleContactSelection = useCallback((id: number) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectMultipleContacts = useCallback((ids: number[]) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const deselectContactIds = useCallback((ids: number[]) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const clearContactSelection = useCallback(() => {
    setSelectedContactIds(new Set());
  }, []);

  const markEnquirySent = useCallback((contactId: number) => {
    setSentEnquiries((prev) => new Set(prev).add(contactId));
  }, []);

  const addSendLogEntry = useCallback((entry: Omit<EnquirySendLogEntry, "id">) => {
    setSendLog((prev) => [
      {
        ...entry,
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
      ...prev,
    ]);
  }, []);

  const value = useMemo(
    () => ({
      projectDetails,
      setProjectDetails,
      activeTradeId,
      setActiveTradeId,
      selectedContactIds,
      toggleContactSelection,
      selectMultipleContacts,
      deselectContactIds,
      clearContactSelection,
      enquiryReturnDate,
      setEnquiryReturnDate,
      enquiryFolderLink,
      setEnquiryFolderLink,
      includeWorksSummary,
      setIncludeWorksSummary,
      sentEnquiries,
      markEnquirySent,
      sendLog,
      addSendLogEntry,
    }),
    [
      projectDetails,
      activeTradeId,
      selectedContactIds,
      toggleContactSelection,
      selectMultipleContacts,
      deselectContactIds,
      clearContactSelection,
      enquiryReturnDate,
      enquiryFolderLink,
      includeWorksSummary,
      sentEnquiries,
      markEnquirySent,
      sendLog,
      addSendLogEntry,
    ]
  );

  return (
    <InventoryWorkflowContext.Provider value={value}>
      {children}
    </InventoryWorkflowContext.Provider>
  );
}

export function useInventoryWorkflow(): InventoryWorkflowContextValue {
  const ctx = useContext(InventoryWorkflowContext);
  if (!ctx) {
    throw new Error(
      "useInventoryWorkflow must be used within InventoryWorkflowProvider"
    );
  }
  return ctx;
}
