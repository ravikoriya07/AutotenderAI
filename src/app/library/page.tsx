"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { FolderTree, type FolderNode } from "@/components/ui/FolderTree";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Trash2, Eye, Download } from "lucide-react";

const libraryTree: FolderNode[] = [
  {
    id: "org",
    label: "Organization Library",
    children: [
      { id: "dck", label: "DCK QUALITY BIDS" },
      { id: "other", label: "OTHER BIDS FOR AUTOTENDER AI SITE" },
    ],
  },
];

const mockFiles = [
  { id: "1", name: "DCK QUALITY BIDS", lastUpdated: "", updatedBy: "", status: "" },
  {
    id: "2",
    name: "OTHER BIDS FOR AUTOTENDER AI SITE",
    lastUpdated: "",
    updatedBy: "",
    status: "",
  },
];

export default function LibraryPage() {
  const [selectedFolder, setSelectedFolder] = useState("org");

  return (
    <DashboardLayout
      title="Organisation Library"
      searchPlaceholder="Search your library..."
    >
      <PageContainer>
        <div className="flex min-w-0 flex-col gap-6 lg:flex-row">
          <div className="w-full shrink-0 lg:w-64">
            <Card className="bg-sidebar/5 p-4">
              <h3 className="mb-3 text-sm font-medium">AutotenderAI Libraries</h3>
              <FolderTree
                nodes={libraryTree}
                selectedId={selectedFolder}
                onSelect={setSelectedFolder}
              />
              <h3 className="mt-4 text-sm font-medium">Connected Libraries</h3>
              <p className="mt-2 text-xs text-muted-foreground">None</p>
            </Card>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm text-muted-foreground">
                Total Size: 1237 MB · Files: 620
              </p>
              <Button size="sm" className="shrink-0">
                New
              </Button>
            </div>
            <Card className="min-w-0 overflow-hidden">
              <div className="border-b p-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  Select items to:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                  <Button variant="outline" size="sm">
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download File
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input type="checkbox" className="rounded" />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Updated By</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <input type="checkbox" className="rounded" />
                      </TableCell>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell>{file.lastUpdated}</TableCell>
                      <TableCell>{file.updatedBy}</TableCell>
                      <TableCell>{file.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </Card>
          </div>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
