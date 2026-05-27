import overviewBundle from "@/features/inventory-management/data/contractor-overview.generated.json";
import contactsDbBundle from "@/features/inventory-management/data/contractor-contacts-db.generated.json";
import { MOCK_CONTACTS } from "@/features/inventory-management/data/mock-data";
import {
  ALL_CONTRACTORS_ID,
  DB_TRADE_PREFIX,
  type ContractorOverviewData,
  type ContractorTradeCategory,
  type ContractorTradeGroup,
} from "@/features/inventory-management/types/contractor-database";
import type { InventoryContact } from "@/features/inventory-management/types";

type OverviewBundle = {
  tradeDbMap: Record<string, string>;
  stats: { tradeCategories: number; totalContractors: number };
  groups: Array<{
    title: string;
    tradeCount: number;
    contractorCount: number;
    trades: Array<{
      dbKey: string;
      label: string;
      companyCount: number;
      projectTradeId: string | null;
    }>;
  }>;
};

const overview = overviewBundle as OverviewBundle;
const contactsByDbKey = contactsDbBundle as Record<string, InventoryContact[]>;

export const CONTRACTOR_TRADE_DB_MAP = overview.tradeDbMap;

export function isAllContractorsView(tradeId: string | null): boolean {
  return tradeId === ALL_CONTRACTORS_ID || tradeId === null;
}

export function resolveContractorDbKey(tradeId: string): string | null {
  if (tradeId === ALL_CONTRACTORS_ID) return null;
  if (tradeId.startsWith(DB_TRADE_PREFIX)) {
    return tradeId.slice(DB_TRADE_PREFIX.length);
  }
  const mapped = CONTRACTOR_TRADE_DB_MAP[tradeId];
  return mapped ?? null;
}

export function toContractorTradeId(
  dbKey: string,
  projectTradeId: string | null
): string {
  if (projectTradeId) return projectTradeId;
  return `${DB_TRADE_PREFIX}${dbKey}`;
}

export function getContactsForTradeId(tradeId: string): InventoryContact[] {
  const dbKey = resolveContractorDbKey(tradeId);
  if (dbKey && contactsByDbKey[dbKey]?.length) {
    return contactsByDbKey[dbKey];
  }
  return MOCK_CONTACTS.filter((c) => c.trades.includes(tradeId));
}

export function getAllContractorContacts(): InventoryContact[] {
  return Object.values(contactsByDbKey).flat();
}

export function getProjectTradeCompanyCount(tradeId: string): number {
  const dbKey = CONTRACTOR_TRADE_DB_MAP[tradeId];
  if (dbKey && contactsByDbKey[dbKey]) {
    return contactsByDbKey[dbKey].length;
  }
  return MOCK_CONTACTS.filter((c) => c.trades.includes(tradeId)).length;
}

export function countSelectedForDbKey(
  dbKey: string,
  selectedIds: Set<number>
): number {
  const contacts = contactsByDbKey[dbKey];
  if (!contacts?.length) return 0;
  return contacts.filter((c) => selectedIds.has(c.id)).length;
}

export function countSelectedForProjectTrade(
  tradeId: string,
  selectedIds: Set<number>
): number {
  const dbKey = CONTRACTOR_TRADE_DB_MAP[tradeId];
  if (dbKey) return countSelectedForDbKey(dbKey, selectedIds);
  return MOCK_CONTACTS.filter(
    (c) => c.trades.includes(tradeId) && selectedIds.has(c.id)
  ).length;
}

export function buildContractorOverview(
  selectedContactIds: Set<number>
): ContractorOverviewData {
  const maxCompanyCount = Math.max(
    0,
    ...overview.groups.flatMap((g) =>
      g.trades.map((t) => t.companyCount)
    )
  );

  const groups: ContractorTradeGroup[] = overview.groups.map((group) => ({
    title: group.title,
    tradeCount: group.tradeCount,
    contractorCount: group.contractorCount,
    trades: group.trades.map((trade): ContractorTradeCategory => {
      const selectedCount = countSelectedForDbKey(
        trade.dbKey,
        selectedContactIds
      );
      return {
        dbKey: trade.dbKey,
        label: trade.label,
        companyCount: trade.companyCount,
        projectTradeId: trade.projectTradeId,
        selectedCount,
        progressPercent:
          maxCompanyCount > 0
            ? Math.round((trade.companyCount / maxCompanyCount) * 100)
            : 0,
      };
    }),
  }));

  const selectedForEnquiry = getAllContractorContacts().filter((c) =>
    selectedContactIds.has(c.id)
  ).length;

  return {
    stats: {
      tradeCategories: overview.stats.tradeCategories,
      totalContractors: overview.stats.totalContractors,
      selectedForEnquiry,
    },
    groups,
    maxCompanyCount,
  };
}

export function getTradeViewTitle(
  tradeId: string,
  projectTradeLabel?: string
): string {
  if (tradeId === ALL_CONTRACTORS_ID) return "All Contractors";
  if (tradeId.startsWith(DB_TRADE_PREFIX)) {
    return tradeId.slice(DB_TRADE_PREFIX.length);
  }
  return projectTradeLabel ?? tradeId;
}
