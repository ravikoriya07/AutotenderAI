"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Upload, Trash2, Check } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import { extractZip } from "@/services/projectService";
import { ProcessingPipeline } from "@/components/extract/pipeline/ProcessingPipeline";
import { cn } from "@/lib/utils";

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

export function ExtractPageContent({ jobId }: { jobId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [extractedDir, setExtractedDir] = useState<string | null>(null);
  /** From `/extract-zip` when returned; falls back to page `jobId` */
  const [activeJobId, setActiveJobId] = useState(jobId);
  const [pipelineAutoRunToken, setPipelineAutoRunToken] = useState(0);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const prevJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevJobIdRef.current === null) {
      prevJobIdRef.current = jobId;
      return;
    }
    if (prevJobIdRef.current === jobId) return;
    prevJobIdRef.current = jobId;
    setActiveJobId(jobId);
    setExtractedDir(null);
    setSelectedFile(null);
    setUploaded(false);
    setPipelineAutoRunToken(0);
    setPipelineBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [jobId]);

  const handlePipelineProcessingChange = useCallback((busy: boolean) => {
    setPipelineBusy(busy);
  }, []);

  const uploadLocked = uploading || pipelineBusy;

  async function handleFileUpload(file: File) {
    if (!jobId) {
      toast.error("Missing project job id. Open Extract from Project listing.");
      return;
    }
    setUploading(true);
    setUploaded(false);
    try {
      const result = await extractZip(file, jobId);
      setUploaded(true);
      setActiveJobId(result.job_id ?? jobId);
      setExtractedDir(result.extracted_dir ?? null);
      // Lock upload UI before the pipeline effect runs (avoids a gap after uploading ends).
      if (result.extracted_dir) {
        setPipelineBusy(true);
      }
      setPipelineAutoRunToken((t) => t + 1);
      toast.success("File extracted successfully.");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        toast.error(String(err.response.data.detail));
      } else {
        toast.error("Failed to extract file.");
      }
    } finally {
      setUploading(false);
    }
  }

  function handleBrowseClick() {
    if (!jobId) {
      toast.error("Missing project job id. Open Extract from Project listing.");
      return;
    }
    fileInputRef.current?.click();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploaded(false);
    setExtractedDir(null);
    setPipelineAutoRunToken(0);
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setUploaded(false);
    setExtractedDir(null);
    setPipelineAutoRunToken(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!jobId) {
      toast.error("Missing project job id. Open Extract from Project listing.");
      return;
    }
    if (!selectedFile) {
      toast.error("Please select a file before submitting.");
      return;
    }
    await handleFileUpload(selectedFile);
  }

  const actionsHistoryTabs = (
    <Tabs
      tabs={[
        {
          id: "actions",
          label: "Actions",
          content: (
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-medium">Choose Extraction</h3>
                <p className="mb-4 text-xs text-muted-foreground">
                  Select which type of extraction you would like to perform on
                  your text.
                </p>
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Key Information
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {extractionOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
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
                        type="button"
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
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-xs"
                    >
                      <Check className="h-3 w-3 text-green-600" />
                      Default Shred
                    </button>
                    <button
                      type="button"
                      className="rounded-full border bg-card px-3 py-1.5 text-xs"
                    >
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
            <p className="text-sm text-muted-foreground">Extraction history</p>
          ),
        },
      ]}
      defaultTab="actions"
    />
  );

  return (
    <DashboardLayout title="Extract">
      <PageContainer>
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Link
            href="/projects"
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            Projects
          </Link>
          <span className="text-muted-foreground">{">"}</span>
          <span className="font-medium text-foreground">Extract</span>
        </div>

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
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={uploadLocked}
                      />
                      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-8">
                        <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                        <p className="mb-2 text-sm font-medium">
                          Drag and drop your files here
                        </p>
                        <p className="mb-4 text-center text-xs text-muted-foreground">
                          pdf, docx, doc, xls, xlsx, ppt, pptx, csv, txt, rtf,
                          msg, eml, xml, and html files. 200 pages per file.
                        </p>
                        <Button
                          onClick={handleBrowseClick}
                          disabled={uploadLocked || !jobId}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {uploading
                            ? "UPLOADING..."
                            : pipelineBusy
                              ? "PROCESSING…"
                              : "BROWSE FILES"}
                        </Button>
                      </div>
                      {selectedFile && (
                        <div className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{selectedFile.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {Math.max(
                                  1,
                                  Math.round(selectedFile.size / 1024)
                                )}{" "}
                                KB
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 text-sm text-green-600">
                                <Check className="h-4 w-4" />
                                {uploading
                                  ? "Uploading..."
                                  : uploaded
                                    ? "File ready"
                                    : "Selected"}
                              </span>
                              <button
                                type="button"
                                onClick={clearSelectedFile}
                                className={cn(
                                  "rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
                                  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                                )}
                                disabled={uploadLocked}
                                aria-label="Remove file"
                                title={
                                  uploadLocked
                                    ? "Unavailable while uploading or processing"
                                    : "Remove file"
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {!jobId && (
                        <p className="text-sm text-destructive">
                          Missing project job id. Open this page from Project
                          Listing using the Extract action.
                        </p>
                      )}
                      <div className="flex justify-end">
                        <Button
                          onClick={handleSubmit}
                          disabled={uploadLocked || !jobId}
                        >
                          {uploading
                            ? "SUBMITTING..."
                            : pipelineBusy
                              ? "PROCESSING…"
                              : "SUBMIT"}
                        </Button>
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
                      disabled={uploadLocked}
                    />
                  ),
                },
              ]}
              defaultTab="upload"
            />
          </Card>

          <Card className="p-6">
            <ProcessingPipeline
              jobId={activeJobId}
              extractedDir={extractedDir}
              autoRunToken={pipelineAutoRunToken}
              onProcessingChange={handlePipelineProcessingChange}
            />
          </Card>
        </div>

        <Card className="mt-6 p-6">{actionsHistoryTabs}</Card>
      </PageContainer>
    </DashboardLayout>
  );
}
