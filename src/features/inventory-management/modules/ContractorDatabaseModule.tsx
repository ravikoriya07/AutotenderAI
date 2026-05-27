"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AddContactForm } from "@/features/inventory-management/components/contractor-database/AddContactForm";
import { ContactDetailPanel } from "@/features/inventory-management/components/contractor-database/ContactDetailPanel";
import { ContractorFilterToolbar } from "@/features/inventory-management/components/contractor-database/ContractorFilterToolbar";
import { ContractorSelectionBar } from "@/features/inventory-management/components/contractor-database/ContractorSelectionBar";
import { ContractorTable } from "@/features/inventory-management/components/contractor-database/ContractorTable";
import { ContractorTradeHeader } from "@/features/inventory-management/components/contractor-database/ContractorTradeHeader";
import { ContractorOverview } from "@/features/inventory-management/components/contractor-overview/ContractorOverview";
import { ContractorSidebar } from "@/features/inventory-management/components/contractor-overview/ContractorSidebar";
import { SlideoverPanel } from "@/features/inventory-management/components/ui/SlideoverPanel";
import { useInventoryWorkflow } from "@/features/inventory-management/context/InventoryWorkflowContext";
import {
  extractContactAreas,
  filterContacts,
  sortContacts,
  type ContactSortColumn,
} from "@/features/inventory-management/lib/contractorContacts";
import {
  getTradeViewTitle,
  isAllContractorsView,
} from "@/features/inventory-management/lib/contractorDatabase";
import type { AddContactFormValues } from "@/features/inventory-management/schemas/add-contact";
import { fetchContactsByTrade, fetchInventoryTrades } from "@/features/inventory-management/services/inventoryManagementService";
import { ALL_CONTRACTORS_ID } from "@/features/inventory-management/types/contractor-database";
import type { InventoryContact, InventoryTrade } from "@/features/inventory-management/types";

type PanelState =
  | { mode: "closed" }
  | { mode: "detail"; contactId: number }
  | { mode: "add" };

let nextLocalContactId = -1;

export function ContractorDatabaseModule() {
  const {
    activeTradeId,
    setActiveTradeId,
    selectedContactIds,
    toggleContactSelection,
    selectMultipleContacts,
    deselectContactIds,
  } = useInventoryWorkflow();

  const [trades, setTrades] = useState<InventoryTrade[]>([]);
  const [contacts, setContacts] = useState<InventoryContact[]>([]);
  const [localContacts, setLocalContacts] = useState<InventoryContact[]>([]);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [sortColumn, setSortColumn] = useState<ContactSortColumn>("company");
  const [sortAscending, setSortAscending] = useState(true);
  const [panel, setPanel] = useState<PanelState>({ mode: "closed" });

  const showOverview = isAllContractorsView(activeTradeId);

  const loadContacts = useCallback(async (tradeId: string | null) => {
    if (isAllContractorsView(tradeId)) {
      setContacts([]);
      return;
    }
    setContacts(await fetchContactsByTrade(tradeId));
  }, []);

  useEffect(() => {
    void fetchInventoryTrades().then(setTrades);
  }, []);

  useEffect(() => {
    void loadContacts(activeTradeId);
    setSearch("");
    setAreaFilter("all");
    setSelectedOnly(false);
    setPanel({ mode: "closed" });
    setLocalContacts([]);
  }, [activeTradeId, loadContacts]);

  const tradeContacts = useMemo(
    () => [...contacts, ...localContacts],
    [contacts, localContacts]
  );

  const areas = useMemo(
    () => extractContactAreas(tradeContacts),
    [tradeContacts]
  );

  const filtered = useMemo(() => {
    const filteredList = filterContacts(tradeContacts, {
      search,
      area: areaFilter,
      selectedOnly,
      selectedIds: selectedContactIds,
    });
    return sortContacts(filteredList, sortColumn, sortAscending);
  }, [
    tradeContacts,
    search,
    areaFilter,
    selectedOnly,
    selectedContactIds,
    sortColumn,
    sortAscending,
  ]);

  const activeTrade = trades.find((t) => t.id === activeTradeId);
  const tradeSelectedCount = tradeContacts.filter((c) =>
    selectedContactIds.has(c.id)
  ).length;
  const tradeTitle = getTradeViewTitle(
    activeTradeId ?? ALL_CONTRACTORS_ID,
    activeTrade?.label
  );

  const panelContact =
    panel.mode === "detail"
      ? tradeContacts.find((c) => c.id === panel.contactId)
      : undefined;

  const handleSort = (column: ContactSortColumn) => {
    if (sortColumn === column) {
      setSortAscending((prev) => !prev);
      return;
    }
    setSortColumn(column);
    setSortAscending(true);
  };

  const handleSelectAll = () => {
    selectMultipleContacts(filtered.map((c) => c.id));
  };

  const handleClear = () => {
    deselectContactIds(tradeContacts.map((c) => c.id));
    setSearch("");
    setAreaFilter("all");
    setSelectedOnly(false);
  };

  const handleClearSelection = () => {
    deselectContactIds(tradeContacts.map((c) => c.id));
  };

  const handleAddContact = (values: AddContactFormValues) => {
    if (!activeTradeId || showOverview) return;
    const contact: InventoryContact = {
      id: nextLocalContactId--,
      company: values.company,
      name: values.name ?? "",
      tel: values.tel ?? "",
      email: values.email ?? "",
      area: values.area ?? "",
      trades: [activeTradeId],
    };
    setLocalContacts((prev) => [...prev, contact]);
    setPanel({ mode: "closed" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ContractorSidebar
          trades={trades}
          activeId={activeTradeId}
          selectedContactIds={selectedContactIds}
          onSelect={(id) => setActiveTradeId(id)}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {showOverview ? (
            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6">
              <ContractorOverview
                selectedContactIds={selectedContactIds}
                onTradeSelect={setActiveTradeId}
              />
            </div>
          ) : (
            <>
              <ContractorTradeHeader
                title={tradeTitle}
                subtitle={`${tradeContacts.length} companies · ${tradeSelectedCount} selected`}
                selectedCount={tradeSelectedCount}
                onAddContact={() => setPanel({ mode: "add" })}
              />
              <ContractorFilterToolbar
                search={search}
                onSearchChange={setSearch}
                areaFilter={areaFilter}
                onAreaFilterChange={setAreaFilter}
                areas={areas}
                selectedOnly={selectedOnly}
                onSelectedOnlyChange={setSelectedOnly}
                onSelectAll={handleSelectAll}
                onClear={handleClear}
              />
              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-3.5 sm:px-5">
                <ContractorTable
                  contacts={filtered}
                  selectedIds={selectedContactIds}
                  sortColumn={sortColumn}
                  sortAscending={sortAscending}
                  onSort={handleSort}
                  onToggleSelect={toggleContactSelection}
                  onView={(contact) =>
                    setPanel({ mode: "detail", contactId: contact.id })
                  }
                />
              </div>
              <ContractorSelectionBar
                selectedCount={tradeSelectedCount}
                onClear={handleClearSelection}
              />
            </>
          )}
        </div>
      </div>

      <SlideoverPanel
        open={panel.mode === "add"}
        title="Add New Contact"
        onClose={() => setPanel({ mode: "closed" })}
      >
        <AddContactForm
          onSave={handleAddContact}
          onCancel={() => setPanel({ mode: "closed" })}
        />
      </SlideoverPanel>

      <SlideoverPanel
        open={panel.mode === "detail" && !!panelContact}
        title={panelContact?.company ?? "Contact"}
        onClose={() => setPanel({ mode: "closed" })}
      >
        {panelContact ? (
          <ContactDetailPanel
            contact={panelContact}
            selected={selectedContactIds.has(panelContact.id)}
            onToggleSelection={() => toggleContactSelection(panelContact.id)}
          />
        ) : null}
      </SlideoverPanel>
    </div>
  );
}
