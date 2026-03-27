"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Pencil, Upload } from "lucide-react";

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState("DCK Construction");
  const [language, setLanguage] = useState("British English");
  const [showWordCount, setShowWordCount] = useState(true);
  const [showWordCountDiff, setShowWordCountDiff] = useState(true);
  const [showWordCountSelections, setShowWordCountSelections] = useState(true);
  const [enableInternetAI, setEnableInternetAI] = useState(true);
  const [allowCookies, setAllowCookies] = useState(false);
  const [libraryUseAll, setLibraryUseAll] = useState(true);

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Manage your account and preferences."
    >
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* General Settings */}
          <Card className="p-6">
            <CardHeader className="p-0 pb-6">
              <CardTitle className="text-xl">General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-0">
              {/* Company name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Company name
                </label>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Edit company name"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Language
                </label>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Input
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Edit language"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Editor Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground">
                  Editor Settings
                </h4>
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 text-sm text-foreground">
                      Show word count in the editor
                    </span>
                    <Switch
                      checked={showWordCount}
                      onCheckedChange={setShowWordCount}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">
                      Show word count difference for each option
                    </span>
                    <Switch
                      checked={showWordCountDiff}
                      onCheckedChange={setShowWordCountDiff}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 text-sm text-foreground">
                      Show word count for selections
                    </span>
                    <Switch
                      checked={showWordCountSelections}
                      onCheckedChange={setShowWordCountSelections}
                    />
                  </div>
                </div>
              </div>

              {/* Internet AI */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Internet AI
                </h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 text-sm text-foreground">
                    Enable Internet AI
                  </span>
                  <Switch
                    checked={enableInternetAI}
                    onCheckedChange={setEnableInternetAI}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  View & Share Preferences
                </p>
              </div>

              {/* Template Management */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Template Management (Beta)
                </h4>
                <p className="text-sm text-muted-foreground">
                  Upload a single template for your admin as preferred meant to
                  work.
                </p>
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-input bg-muted/30 py-8">
                  <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Drag and drop your files here
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Limit to 51.2 MB per file. We accept docx and docx files.
                  </p>
                  <Button className="mt-4" size="sm">
                    BROWSE FILES
                  </Button>
                </div>
              </div>

              {/* Cookie Preferences */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Cookie Preferences
                </h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 text-sm text-foreground">
                    Allow essential and analytics cookies
                  </span>
                  <Switch
                    checked={allowCookies}
                    onCheckedChange={setAllowCookies}
                  />
                </div>
              </div>

              {/* Recycle Bin */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Recycle Bin
                </h4>
                <p className="text-sm text-muted-foreground">
                  Pages in Recycle Bin for over 30 days will be automatically
                  deleted.
                </p>
                <Button variant="outline" size="sm">
                  VIEW
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Library Settings */}
          <Card className="p-6">
            <CardHeader className="p-0 pb-6">
              <CardTitle className="text-xl">Library Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-0">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Library AI
                </h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 text-sm text-foreground">
                    Generate using all Library Documents
                  </span>
                  <Switch
                    checked={libraryUseAll}
                    onCheckedChange={setLibraryUseAll}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
