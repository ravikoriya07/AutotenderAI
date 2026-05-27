export const ALL_CONTRACTORS_ID = "__all__" as const;
export const DB_TRADE_PREFIX = "__db__" as const;

export type ContractorOverviewStats = {
  tradeCategories: number;
  totalContractors: number;
  selectedForEnquiry: number;
};

export type ContractorTradeCategory = {
  dbKey: string;
  label: string;
  companyCount: number;
  projectTradeId: string | null;
  selectedCount: number;
  progressPercent: number;
};

export type ContractorTradeGroup = {
  title: string;
  tradeCount: number;
  contractorCount: number;
  trades: ContractorTradeCategory[];
};

export type ContractorOverviewData = {
  stats: ContractorOverviewStats;
  groups: ContractorTradeGroup[];
  maxCompanyCount: number;
};

export type ContractorSidebarTradeItem = {
  id: string;
  label: string;
  companyCount: number;
  selectedCount: number;
};
