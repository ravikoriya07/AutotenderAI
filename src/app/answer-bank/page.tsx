"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toolbar } from "@/components/ui/Toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Input } from "@/components/ui/Input";
import { Download, FileText, MoreVertical } from "lucide-react";
import { useState } from "react";

const mockEntries = [
  { id: "1", question: "", answer: "", tags: "" },
  { id: "2", question: "", answer: "", tags: "" },
];

export default function AnswerBankPage() {
  const [editMode, setEditMode] = useState(false);

  return (
    <DashboardLayout
      title="Answer Bank"
      subtitle="Store commonly used questions and answers for easy retrieval!"
    >
      <PageContainer>
        <Card>
          <Toolbar className="flex-wrap gap-4">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              DOWNLOAD ANSWER BANK
            </Button>
            <Button size="sm">
              <FileText className="mr-2 h-4 w-4" />
              Document Manager
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm">EDIT MODE</span>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  editMode ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    editMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </Toolbar>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Answer</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Input
                        placeholder="Enter question"
                        disabled={!editMode}
                        className="border-0 bg-transparent focus-visible:ring-0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Enter answer"
                        disabled={!editMode}
                        className="border-0 bg-transparent focus-visible:ring-0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Tags"
                        disabled={!editMode}
                        className="border-0 bg-transparent focus-visible:ring-0"
                      />
                    </TableCell>
                    <TableCell>
                      <button className="rounded p-1 hover:bg-muted">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </PageContainer>
    </DashboardLayout>
  );
}
