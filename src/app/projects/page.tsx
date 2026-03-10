"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/SearchBar";
import { Toolbar } from "@/components/ui/Toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Plus, MoreVertical, LayoutList, LayoutGrid } from "lucide-react";
import { useState } from "react";

const mockProjects = [
  {
    id: "1",
    opportunity: "SEC Fire Remedial Works Framework",
    dueDate: "6/19/2025",
    status: "Writing",
    statusColor: "text-blue-600",
  },
  {
    id: "2",
    opportunity: "Project X",
    dueDate: "6/17/2025",
    status: "Preparing",
    statusColor: "text-gray-600",
  },
  {
    id: "3",
    opportunity: "test",
    dueDate: "6/11/2024",
    status: "Writing",
    statusColor: "text-blue-600",
  },
];

export default function ProjectsPage() {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  return (
    <DashboardLayout
      title="Projects"
      subtitle="Your space to create new projects, and access any projects shared with you."
      searchPlaceholder="Search your projects"
    >
      <PageContainer>
        <Card>
          <Toolbar className="flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sorting</span>
              <select className="h-8 rounded-md border bg-background px-3 text-sm">
                <option>Updated Date</option>
              </select>
              <button className="rounded p-1 hover:bg-muted">↑</button>
              <button className="rounded p-1 hover:bg-muted">↓</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filters</span>
              <select className="h-8 rounded-md border bg-background px-3 text-sm">
                <option>Status</option>
              </select>
              <select className="h-8 rounded-md border bg-background px-3 text-sm">
                <option>Date</option>
              </select>
              <select className="h-8 rounded-md border bg-background px-3 text-sm">
                <option>Member</option>
              </select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setViewMode("list")}
                className={`rounded p-2 ${viewMode === "list" ? "bg-primary/20 text-primary" : "hover:bg-muted"}`}
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded p-2 ${viewMode === "grid" ? "bg-primary/20 text-primary" : "hover:bg-muted"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                NEW PROJECT
              </Button>
            </div>
          </Toolbar>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      {project.opportunity}
                    </TableCell>
                    <TableCell>{project.dueDate}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 ${project.statusColor}`}
                      >
                        <span className="h-2 w-2 rounded-full bg-current" />
                        {project.status}
                      </span>
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
