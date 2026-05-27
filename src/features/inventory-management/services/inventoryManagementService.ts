import {
  MOCK_CHASE_RECORDS,
  MOCK_CONTRACTOR_STATS,
  MOCK_QUOTES,
  MOCK_INBOX_ITEMS,
  MOCK_STANDARD_DOCS,
  MOCK_TRADE_DOCS,
  MOCK_TRADES,
  DEFAULT_PROJECT_DETAILS,
} from "@/features/inventory-management/data/mock-data";
import {
  buildContractorOverview,
  getContactsForTradeId,
} from "@/features/inventory-management/lib/contractorDatabase";
import type { ContractorOverviewData } from "@/features/inventory-management/types/contractor-database";
import { ALL_CONTRACTORS_ID } from "@/features/inventory-management/types/contractor-database";
import type {
  ChaseRecord,
  ContractorStat,
  InventoryContact,
  InventoryTrade,
  ProjectDetailsFormValues,
  QuoteRecord,
  InboxMonitorItem,
  TradeDocument,
} from "@/features/inventory-management/types";

/** Service layer — swap implementations for API calls without touching UI modules. */

export async function fetchInventoryTrades(): Promise<InventoryTrade[]> {
  return MOCK_TRADES;
}

export async function fetchStandardDocuments(): Promise<string[]> {
  return MOCK_STANDARD_DOCS;
}

export async function fetchTradeDocuments(
  tradeId: string
): Promise<TradeDocument[]> {
  return MOCK_TRADE_DOCS[tradeId] ?? [];
}

export async function fetchContactsByTrade(
  tradeId: string | null
): Promise<InventoryContact[]> {
  if (!tradeId || tradeId === ALL_CONTRACTORS_ID) return [];
  return getContactsForTradeId(tradeId);
}

export async function fetchContractorOverview(
  selectedContactIds: Set<number>
): Promise<ContractorOverviewData> {
  return buildContractorOverview(selectedContactIds);
}

export async function fetchChaseRecords(): Promise<ChaseRecord[]> {
  return MOCK_CHASE_RECORDS;
}

export async function fetchQuotesByTrade(
  tradeId: string
): Promise<QuoteRecord[]> {
  return MOCK_QUOTES[tradeId] ?? [];
}

export async function fetchInboxMonitorItems(): Promise<InboxMonitorItem[]> {
  return MOCK_INBOX_ITEMS;
}

export async function fetchContractorStats(): Promise<ContractorStat[]> {
  return MOCK_CONTRACTOR_STATS;
}

export async function fetchProjectDetails(): Promise<ProjectDetailsFormValues> {
  return DEFAULT_PROJECT_DETAILS;
}

export async function saveProjectDetails(
  values: ProjectDetailsFormValues
): Promise<ProjectDetailsFormValues> {
  // Placeholder for POST /inventory/project-details
  void values;
  return values;
}
