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
import { Plus, MoreVertical, LayoutList, LayoutGrid } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { listProjects } from "@/services/projectService";
import type { Project } from "@/types/project";
import { toast } from "react-toastify";

function getStatusColor(status: string): string {
  switch (status) {
    case "Writing":
      return "text-blue-600";
    case "Preparing":
      return "text-gray-600";
    default:
      return "text-muted-foreground";
  }
}

export default function ProjectsPage() {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const hasFetchedRef = useRef(false);

  async function fetchProjects() {
    setLoading(true);
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (error) {
      toast.error("Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchProjects();
  }, []);

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
              <Button onClick={() => setCreateModalOpen(true)}>
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
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      {project.opportunity}
                    </TableCell>
                    <TableCell>{project.dueDate ?? "N/A"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 ${getStatusColor(
                          project.status
                        )}`}
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
                {projects.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No projects found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
        <Modal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Create project"
        >
          <CreateProjectForm
            onSuccess={() => {
              setCreateModalOpen(false);
              void fetchProjects();
            }}
          />
        </Modal>
      </PageContainer>
    </DashboardLayout>
  );
}
