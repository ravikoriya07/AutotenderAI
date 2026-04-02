"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Plus,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  FileDown,
  Library,
  PanelRight,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { EditProjectForm } from "@/components/EditProjectForm";
import axios from "axios";
import { listProjects, deleteProject } from "@/services/projectService";
import Swal from "sweetalert2";
import type { Project, Pagination } from "@/types/project";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import { DateRangePickerWrapper } from "@/components/DateRangePickerWrapper";

const STATUS_OPTIONS = ["Preparing", "In Progress", "Completed"];
const DEFAULT_LIMIT = 10;

function getStatusColor(status: string): string {
  switch (status) {
    case "In Progress":
      return "text-blue-600";
    case "Preparing":
      return "text-gray-600";
    case "Completed":
      return "text-green-600";
    default:
      return "text-muted-foreground";
  }
}

function formatDateForApi(value: string): string | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value.trim());
  if (Number.isNaN(d.getTime())) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function FiltersBar({
  startDate,
  endDate,
  status,
  onStartDateChange,
  onEndDateChange,
  onStatusChange,
  onReset,
}: {
  startDate: string;
  endDate: string;
  status: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onReset: () => void;
}) {
  const handleRangeChange = (start: string, end: string) => {
    onStartDateChange(start);
    onEndDateChange(end);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePickerWrapper
        startDate={startDate}
        endDate={endDate}
        onRangeChange={handleRangeChange}
      />
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Status</label>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <Button variant="outline" size="sm" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}

function PaginationControls({
  pagination,
  loading,
  onPageChange,
}: {
  pagination: Pagination | null;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  if (!pagination || pagination.total_pages <= 1) return null;
  const { current_page, total_pages, total_items } = pagination;
  const prevDisabled = loading || current_page <= 1;
  const nextDisabled = loading || current_page >= total_pages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {total_items != null
          ? `Showing page ${current_page} of ${total_pages} (${total_items} total)`
          : `Page ${current_page} of ${total_pages}`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={prevDisabled}
          onClick={() => onPageChange(current_page - 1)}
          className="h-8 min-w-8 px-2"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span
          className="flex h-8 min-w-[7rem] items-center justify-center rounded-md border border-transparent bg-transparent px-3 text-sm font-medium text-foreground"
          aria-live="polite"
        >
          {current_page} / {total_pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={nextDisabled}
          onClick={() => onPageChange(current_page + 1)}
          className="h-8 min-w-8 px-2"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ProjectActionsCell({
  onEdit,
  onDetail,
  onExtract,
  onLibrary,
  onDelete,
  open,
  onToggle,
  onClose,
}: {
  onEdit: () => void;
  onDetail: () => void;
  onExtract: () => void;
  onLibrary: () => void;
  onDelete: () => void;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "rounded-md p-2 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-muted"
        )}
        aria-label="Row actions"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-10 mt-1.5 min-w-[152px] overflow-hidden rounded-lg border border-border bg-card shadow-md"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
          >
            <Pencil className="h-4 w-4 shrink-0 text-primary" />
            Edit
          </button>
          <div className="border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDetail();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
          >
            <PanelRight className="h-4 w-4 shrink-0 text-primary" />
            Detail
          </button>
          <div className="border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onExtract();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
          >
            <FileDown className="h-4 w-4 shrink-0 text-primary" />
            Extract
          </button>
          <div className="border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onLibrary();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
          >
            <Library className="h-4 w-4 shrink-0 text-primary" />
            Library
          </button>
          <div className="border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 focus:bg-destructive/10 focus:outline-none"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(DEFAULT_LIMIT);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");

  /** Manual refresh after create/edit/delete (not tied to effect abort). */
  const fetchProjects = useCallback(async () => {
    try {
      const start = formatDateForApi(startDate);
      const end = formatDateForApi(endDate);
      if (start && end && start > end) {
        toast.error("End date must be on or after start date.");
        return;
      }
      const result = await listProjects({
        page,
        limit,
        start_date: start,
        end_date: end,
        status: status || undefined,
      });
      setProjects(result.projects);
      setPagination(result.pagination);
    } catch {
      toast.error("Failed to load projects.");
    }
  }, [page, limit, startDate, endDate, status]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const start = formatDateForApi(startDate);
        const end = formatDateForApi(endDate);
        if (start && end && start > end) {
          toast.error("End date must be on or after start date.");
          if (!cancelled) setLoading(false);
          return;
        }
        const result = await listProjects(
          {
            page,
            limit,
            start_date: start,
            end_date: end,
            status: status || undefined,
          },
          controller.signal
        );
        if (cancelled) return;
        setProjects(result.projects);
        setPagination(result.pagination);
      } catch (e) {
        if (cancelled || axios.isCancel(e)) return;
        toast.error("Failed to load projects.");
        setProjects([]);
        setPagination(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, limit, startDate, endDate, status]);

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setStatus("");
    setPage(1);
  };

  const handleDelete = (project: Project) => {
    Swal.fire({
      title: "Delete project?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "hsl(var(--destructive))",
    }).then((result) => {
      if (result.isConfirmed) {
        deleteProject(project.id)
          .then(() => {
            toast.success("Project deleted successfully.");
            void fetchProjects();
          })
          .catch(() => {
            toast.error("Failed to delete project.");
          });
      }
    });
  };

  const projectList = Array.isArray(projects) ? projects : [];

  return (
    <DashboardLayout
      title="Projects"
      subtitle="Your space to create new projects, and access any projects shared with you."
      searchPlaceholder="Search your projects"
    >
      <PageContainer>
        <Card>
          <Toolbar className="flex-wrap gap-4">
            <FiltersBar
              startDate={startDate}
              endDate={endDate}
              status={status}
              onStartDateChange={(v) => {
                setStartDate(v);
                setPage(1);
              }}
              onEndDateChange={(v) => {
                setEndDate(v);
                setPage(1);
              }}
              onStatusChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              onReset={handleReset}
            />
            <Button
              className="w-full sm:ml-auto sm:w-auto"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              NEW PROJECT
            </Button>
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {projectList.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">
                          {project.opportunity}
                        </TableCell>
                        <TableCell>{project.dueDate ?? "N/A"}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5",
                              getStatusColor(project.status)
                            )}
                          >
                            <span className="h-2 w-2 rounded-full bg-current" />
                            {project.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ProjectActionsCell
                            open={openActionId === project.id}
                            onToggle={() =>
                              setOpenActionId((id) =>
                                id === project.id ? null : project.id
                              )
                            }
                            onClose={() => setOpenActionId(null)}
                            onEdit={() => {
                              setProjectToEdit(project);
                              setEditModalOpen(true);
                            }}
                            onDetail={() => {
                              router.push(
                                `/projects/${encodeURIComponent(project.id)}`
                              );
                            }}
                            onExtract={() => {
                              const jobId = project.job_id ?? project.id;
                              router.push(
                                `/extract?job_id=${encodeURIComponent(jobId)}`
                              );
                            }}
                            onLibrary={() => {
                              const jobId = project.job_id ?? project.id;
                              router.push(
                                `/libraries?job_id=${encodeURIComponent(jobId)}`
                              );
                            }}
                            onDelete={() => handleDelete(project)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {projectList.length === 0 && !loading && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-sm text-muted-foreground py-8"
                        >
                          No projects found.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            pagination={pagination}
            loading={loading}
            onPageChange={setPage}
          />
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
        <Modal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setProjectToEdit(null);
          }}
          title="Edit project"
        >
          {projectToEdit && (
            <EditProjectForm
              project={projectToEdit}
              onSuccess={() => {
                setEditModalOpen(false);
                setProjectToEdit(null);
                void fetchProjects();
              }}
            />
          )}
        </Modal>
      </PageContainer>
    </DashboardLayout>
  );
}
