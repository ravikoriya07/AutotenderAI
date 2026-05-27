export type TradeDataStatus = "ready" | "in-progress" | "not-started";

export type InventoryTrade = {
  id: string;
  label: string;
  dataStatus: TradeDataStatus;
};

export type TradeDocument = {
  name: string;
  type: string;
};

export type InventoryContact = {
  id: number;
  company: string;
  name: string;
  email: string;
  tel: string;
  area: string;
  trades: string[];
};

export type ChaseStatus =
  | "sent"
  | "acknowledged"
  | "quote-received"
  | "declined"
  | "more-time"
  | "no-response"
  | "query"
  | "bad-contact";

export type ChaseRecord = {
  id: number;
  trade: string;
  company: string;
  name: string;
  email: string;
  whatsapp: boolean;
  sentDate: string;
  status: ChaseStatus;
  chase1: string;
  chase2: string;
  notes: string;
  returnDate: string;
};

export type QuoteRecord = {
  company: string;
  file: string;
  date: string;
  value: number;
  contact: string;
  email: string;
};

export type InboxMonitorItem = {
  id: string;
  company: string;
  subject: string;
  from: string;
  received: string;
  filed: boolean;
  trade: string;
};

export type QuoteAnalysisResult = {
  lowest: QuoteRecord;
  second?: QuoteRecord;
  exclusions: string[];
};

export type ContractorHistoryRow = {
  proj: string;
  trade: string;
  quoted: number | null;
  lowest: number | null;
  status: string;
  response: string;
};

export type ContractorStat = {
  id: number;
  company: string;
  trades: string[];
  region: string;
  status: "preferred" | "approved" | string;
  history: ContractorHistoryRow[];
};

export type ProjectDetailsFormValues = {
  projectName: string;
  client: string;
  projectReference: string;
  siteAddress: string;
  budget: string;
  stage: string;
  startOnSite: string;
  completion: string;
  duration: string;
  globalReturnDate: string;
  contractForm: string;
  employersAgent: string;
  architect: string;
  worksGeneral: string;
  worksMechanical: string;
  worksElectrical: string;
  worksFabric: string;
};

export type EnquirySendLogEntry = {
  id: string;
  trade: string;
  company: string;
  contact: string;
  sentAt: string;
};
