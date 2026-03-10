"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Upload, Trash2, Check } from "lucide-react";

const extractionOptions = [
  "Critical Bid Decision Information",
  "Commissioner's Priorities (Requirements)",
  "Compliance (Non-Negotiables)",
  "Statistics",
  "Dates & Timelines",
  "Bid Questions",
  "Custom Extraction",
];

const summaryOptions = [
  "Two pages",
  "One page",
  "Half-page",
  "Paragraph",
  "Custom Summary",
];

export default function ExtractPage() {
  return (
    <DashboardLayout
      title="Extract"
      subtitle="Extract key information from one or more sources in your library, uploaded files, or text you already have into a single output. You can select or upload up to 20 files per extraction."
    >
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <Tabs
              tabs={[
                {
                  id: "library",
                  label: "Library",
                  content: (
                    <p className="text-sm text-muted-foreground">
                      Select from your library
                    </p>
                  ),
                },
                {
                  id: "upload",
                  label: "File Upload",
                  content: (
                    <div className="space-y-4">
                      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-8">
                        <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                        <p className="mb-2 text-sm font-medium">
                          Drag and drop your files here
                        </p>
                        <p className="mb-4 text-center text-xs text-muted-foreground">
                          pdf, docx, doc, xls, xlsx, ppt, pptx, csv, txt, rtf, msg,
                          eml, xml, and html files. 200 pages per file.
                        </p>
                        <Button>
                          <Upload className="mr-2 h-4 w-4" />
                          BROWSE FILES
                        </Button>
                      </div>
                      <div className="rounded-lg border bg-card p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              A3. Instructions for Tendering.pdf
                            </p>
                            <p className="text-sm text-muted-foreground">
                              322 KB | 7530 words
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-sm text-green-600">
                              <Check className="h-4 w-4" />
                              File ready
                            </span>
                            <button className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  id: "paste",
                  label: "Paste Text",
                  content: (
                    <textarea
                      placeholder="Paste your text here..."
                      className="min-h-[200px] w-full rounded-md border bg-background p-3 text-sm"
                    />
                  ),
                },
              ]}
              defaultTab="upload"
            />
          </Card>

          <Card className="p-6">
            <Tabs
              tabs={[
                {
                  id: "actions",
                  label: "Actions",
                  content: (
                    <div className="space-y-6">
                      <div>
                        <h3 className="mb-3 text-sm font-medium">
                          Choose Extraction
                        </h3>
                        <p className="mb-4 text-xs text-muted-foreground">
                          Select which type of extraction you would like to
                          perform on your text.
                        </p>
                        <div className="mb-4">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Key Information
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {extractionOptions.map((opt) => (
                              <button
                                key={opt}
                                className="flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-xs transition-colors hover:border-primary hover:bg-primary/5"
                              >
                                <Check className="h-3 w-3 text-green-600" />
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="mb-4">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Summaries
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {summaryOptions.map((opt) => (
                              <button
                                key={opt}
                                className="rounded-full border bg-card px-3 py-1.5 text-xs transition-colors hover:border-primary hover:bg-primary/5"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Key Terms
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button className="flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-xs">
                              <Check className="h-3 w-3 text-green-600" />
                              Default Shred
                            </button>
                            <button className="rounded-full border bg-card px-3 py-1.5 text-xs">
                              Custom Shred
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  id: "history",
                  label: "History",
                  content: (
                    <p className="text-sm text-muted-foreground">
                      Extraction history
                    </p>
                  ),
                },
              ]}
              defaultTab="actions"
            />
          </Card>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
