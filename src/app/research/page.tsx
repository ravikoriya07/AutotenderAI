"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import {
  ChevronLeft,
  Plus,
  Send,
  ChevronDown,
  Variable,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_SESSIONS = [
  "How does EQUANS Regrema...",
  "Bid strategy for framework...",
  "Compliance requirements...",
];

function ResearchSidebar({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
}) {
  return (
    <aside
      className={cn(
        "hidden flex-col border-r border-border bg-[#f9fafb] transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-14" : "w-[260px]"
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-border px-3">
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="p-3">
            <Button variant="outline" className="w-full justify-center" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              LAST WEEK
            </p>
            <ul className="space-y-1">
              {MOCK_SESSIONS.map((label, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-muted"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </aside>
  );
}

function ResearchInputCard({
  value,
  onChange,
  onSend,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="w-full max-w-3xl rounded-2xl border border-border bg-card p-4 shadow-sm">
      <textarea
        placeholder="Ask anything"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        className="min-h-[120px] w-full resize-none rounded-md border-0 bg-transparent px-1 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
        rows={4}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
          >
            Research
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Source Providers
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Variable className="h-4 w-4" />
            Add Variable
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
            <Crown className="h-3.5 w-3.5" />
            Pro
          </span>
          <button
            type="button"
            onClick={onSend}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (inputValue.trim()) {
      setInputValue("");
    }
  };

  return (
    <DashboardLayout
      title="Research"
      subtitle="Your intelligent research partner."
    >
      <div className="flex min-h-[calc(100vh-4rem)]">
        <ResearchSidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
        <PageContainer className="flex flex-1 flex-col items-center justify-start overflow-auto pt-8 pb-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4">
            <h1 className="text-center text-2xl font-semibold text-foreground">
              Your Intelligent Research Partner
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Ask anything about your documents, answer bank, or the web.
            </p>
            <div className="mt-8 w-full">
              <ResearchInputCard
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSend}
              />
            </div>
          </div>
        </PageContainer>
      </div>
    </DashboardLayout>
  );
}
