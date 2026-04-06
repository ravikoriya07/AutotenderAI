"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
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
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="min-w-0 flex-1 sm:max-w-md sm:flex-none">
        <DateRangePickerWrapper
          startDate={startDate}
          endDate={endDate}
          onRangeChange={handleRangeChange}
        />
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <span className="text-sm font-medium text-muted-foreground">Status</span>
        <select
          id="projects-status-filter"
          aria-label="Filter by status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-9 min-w-[10rem] flex-1 rounded-md border border-input bg-background px-3 text-sm sm:h-8 sm:flex-none"
        >
          <option value="">All</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="w-full sm:w-auto"
        >
          Reset
        </Button>
      </div>
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3 sm:px-4">
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

const ACTION_MENU_WIDTH = 176;
const ACTION_MENU_EST_HEIGHT = 260;

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const el = wrapRef.current;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const spaceBelow = vh - rect.bottom;
      const openUp =
        spaceBelow < ACTION_MENU_EST_HEIGHT &&
        rect.top > ACTION_MENU_EST_HEIGHT;
      let left = rect.right - ACTION_MENU_WIDTH;
      left = Math.max(8, Math.min(left, vw - ACTION_MENU_WIDTH - 8));
      const top = openUp
        ? rect.top - ACTION_MENU_EST_HEIGHT - 6
        : rect.bottom + 6;
      setMenuStyle({
        position: "fixed",
        top: Math.max(8, Math.min(top, vh - ACTION_MENU_EST_HEIGHT - 8)),
        left,
        width: ACTION_MENU_WIDTH,
        zIndex: 200,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    function handlePointer(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (
        wrapRef.current?.contains(t) ||
        menuRef.current?.contains(t)
      ) {
        return;
      }
      onClose();
    }
    if (open) {
      document.addEventListener("mousedown", handlePointer);
      document.addEventListener("touchstart", handlePointer);
    }
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const menu = open ? (
    <div
      ref={menuRef}
      style={menuStyle}
      className="max-h-[min(70vh,280px)] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card py-1 shadow-lg ring-1 ring-black/5"
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onEdit();
          onClose();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
      >
        <Pencil className="h-4 w-4 shrink-0 text-primary" />
        Edit
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onDetail();
          onClose();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
      >
        <PanelRight className="h-4 w-4 shrink-0 text-primary" />
        Detail
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onExtract();
          onClose();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
      >
        <FileDown className="h-4 w-4 shrink-0 text-primary" />
        Extract
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onLibrary();
          onClose();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
      >
        <Library className="h-4 w-4 shrink-0 text-primary" />
        Library
      </button>
      <div className="my-1 border-t border-border" />
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
  ) : null;

  return (
    <div ref={wrapRef} className="relative flex shrink-0 justify-end">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "rounded-lg p-2 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-muted"
        )}
        aria-label="Project actions"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

function ProjectMobileCard({
  project,
  openActionId,
  setOpenActionId,
  router,
  onEditRequest,
  onDeleteRequest,
}: {
  project: Project;
  openActionId: string | null;
  setOpenActionId: Dispatch<SetStateAction<string | null>>;
  router: ReturnType<typeof useRouter>;
  onEditRequest: (p: Project) => void;
  onDeleteRequest: (p: Project) => void;
}) {
  const jobId = project.job_id ?? project.id;
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <h3 className="text-base font-semibold leading-snug text-foreground">
            {project.opportunity}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground/80">Due: </span>
              {project.dueDate ?? "N/A"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs font-medium",
                getStatusColor(project.status)
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              {project.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-9 flex-1 min-[380px]:flex-none"
              onClick={() =>
                router.push(`/projects/${encodeURIComponent(project.id)}`)
              }
            >
              Detail
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-9 flex-1 min-[380px]:flex-none"
              onClick={() =>
                router.push(`/libraries?job_id=${encodeURIComponent(jobId)}`)
              }
            >
              <Library className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              Library
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-9 flex-1 min-[380px]:flex-none"
              onClick={() =>
                router.push(`/extract?job_id=${encodeURIComponent(jobId)}`)
              }
            >
              <FileDown className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              Extract
            </Button>
          </div>
        </div>
        <ProjectActionsCell
          open={openActionId === project.id}
          onToggle={() =>
            setOpenActionId((id) => (id === project.id ? null : project.id))
          }
          onClose={() => setOpenActionId(null)}
          onEdit={() => onEditRequest(project)}
          onDetail={() =>
            router.push(`/projects/${encodeURIComponent(project.id)}`)
          }
          onExtract={() =>
            router.push(`/extract?job_id=${encodeURIComponent(jobId)}`)
          }
          onLibrary={() =>
            router.push(`/libraries?job_id=${encodeURIComponent(jobId)}`)
          }
          onDelete={() => onDeleteRequest(project)}
        />
      </div>
    </article>
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
      <PageContainer className="mx-auto max-w-6xl">
        <Card className="overflow-hidden">
          <Toolbar className="flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center">
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
              className="h-10 w-full shrink-0 sm:ml-auto sm:h-9 sm:w-auto"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4 shrink-0" />
              New project
            </Button>
          </Toolbar>

          <div className="md:hidden">
            {loading ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : projectList.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No projects found.
              </p>
            ) : (
              <div className="space-y-3 p-3 sm:p-4">
                {projectList.map((project) => (
                  <ProjectMobileCard
                    key={project.id}
                    project={project}
                    openActionId={openActionId}
                    setOpenActionId={setOpenActionId}
                    router={router}
                    onEditRequest={(p) => {
                      setProjectToEdit(p);
                      setEditModalOpen(true);
                    }}
                    onDeleteRequest={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table className="min-w-[640px] table-fixed">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-11 w-[40%] min-w-0 px-3 lg:px-4">
                      Opportunity
                    </TableHead>
                    <TableHead className="h-11 w-[18%] whitespace-nowrap px-3 lg:px-4">
                      Due date
                    </TableHead>
                    <TableHead className="h-11 w-[26%] whitespace-nowrap px-3 lg:px-4">
                      Status
                    </TableHead>
                    <TableHead className="h-11 w-[16%] whitespace-nowrap px-3 py-2 text-right lg:px-4">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {projectList.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="min-w-0 px-3 py-3 align-middle lg:px-4">
                            <span
                              className="line-clamp-2 font-medium text-foreground lg:line-clamp-1 lg:truncate"
                              title={project.opportunity}
                            >
                              {project.opportunity}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-3 py-3 text-sm text-muted-foreground lg:px-4">
                            {project.dueDate ?? "N/A"}
                          </TableCell>
                          <TableCell className="px-3 py-3 lg:px-4">
                            <span
                              className={cn(
                                "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium",
                                getStatusColor(project.status)
                              )}
                            >
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                              <span className="truncate">{project.status}</span>
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-3 text-right lg:px-4">
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
                            className="py-10 text-center text-sm text-muted-foreground"
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
