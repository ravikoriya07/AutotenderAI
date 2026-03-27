"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FilePlus, Pencil, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function IdeatorPage() {
  const [useLibrary, setUseLibrary] = useState(false);
  const [useCreative, setUseCreative] = useState(true);
  const [useInternet, setUseInternet] = useState(false);
  const [saveTo, setSaveTo] = useState<"latest" | "new">("latest");

  return (
    <DashboardLayout title="Ideator">
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <Textarea
              placeholder="What do you want to write about?"
              className="min-h-[140px] resize-none"
            />
            <div className="mt-4 flex flex-wrap gap-4">
              <button className="flex items-center gap-2 text-sm text-primary hover:underline">
                <FilePlus className="h-4 w-4" />
                Add Context
              </button>
              <button className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Pencil className="h-4 w-4" />
                Modify Ideas
              </button>
            </div>
            <div className="mt-6">
              <p className="mb-2 text-sm text-muted-foreground">Use:</p>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useLibrary}
                    onChange={(e) => setUseLibrary(e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-sm">Library AI</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useCreative}
                    onChange={(e) => setUseCreative(e.target.checked)}
                    className="rounded border-input text-primary"
                  />
                  <span className="text-sm">Creative AI</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useInternet}
                    onChange={(e) => setUseInternet(e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-sm">Internet AI</span>
                </label>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <Input
              placeholder="Enter a custom idea"
              className="mb-6"
            />
            <div className="mb-6">
              <p className="mb-3 text-sm font-medium">
                Where would you like to save this content?
              </p>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="saveTo"
                  checked={saveTo === "latest"}
                  onChange={() => setSaveTo("latest")}
                  className="text-primary"
                />
                <span className="text-sm">
                  Latest document (Document - 17 Ap...)
                </span>
              </label>
              <label className="mt-2 flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="saveTo"
                  checked={saveTo === "new"}
                  onChange={() => setSaveTo("new")}
                  className="text-primary"
                />
                <span className="text-sm">New draft</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button>
                SYNTHESISE IDEAS
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline">
                GENERATE PARAGRAPHS
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
