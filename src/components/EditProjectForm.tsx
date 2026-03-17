"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SingleDatePicker } from "@/components/SingleDatePicker";
import { editProject } from "@/services/projectService";
import type { ApiErrorResponse } from "@/types/project";
import type { Project } from "@/types/project";

const STATUS_OPTIONS = ["Preparing", "In Progress", "Completed"];

/** Normalize API due_date to Y-m-d for <input type="date">. Returns "" for N/A or unparseable. */
function dueDateToYmd(value: string | undefined | null): string {
  if (value == null || !value.trim() || value.trim().toUpperCase() === "N/A")
    return "";
  const t = value.trim();
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const match = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return "";
}

interface EditProjectFormProps {
  project: Project;
  onSuccess: () => void;
}

export function EditProjectForm({ project, onSuccess }: EditProjectFormProps) {
  const [opportunity, setOpportunity] = useState(project.opportunity);
  const [dueDate, setDueDate] = useState(() => dueDateToYmd(project.dueDate));
  const [status, setStatus] = useState(project.status);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ opportunity?: string; status?: string }>({});

  useEffect(() => {
    setOpportunity(project.opportunity);
    setDueDate(dueDateToYmd(project.dueDate));
    setStatus(project.status);
  }, [project]);

  function validate(): boolean {
    const next: { opportunity?: string; status?: string } = {};
    if (!opportunity.trim()) next.opportunity = "Opportunity is required.";
    if (!status) next.status = "Status is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (!validate()) return;

    setLoading(true);
    try {
      await editProject(project.id, {
        opportunity: opportunity.trim(),
        due_date: dueDate.trim() ? dueDate.trim() : "N/A",
        status,
      });
      toast.success("Project updated successfully.");
      onSuccess();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const data = err.response.data as ApiErrorResponse | undefined;
        const first = data?.detail?.[0];
        const message = first?.msg ?? "Could not update project. Check your input.";
        toast.error(message);
      } else {
        toast.error("Failed to update project.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          htmlFor="edit-opportunity"
          className="text-sm font-medium text-foreground"
        >
          Opportunity <span className="text-destructive">*</span>
        </label>
        <Input
          id="edit-opportunity"
          type="text"
          placeholder="e.g. Test Project"
          value={opportunity}
          onChange={(e) => setOpportunity(e.target.value)}
          disabled={loading}
          className={errors.opportunity ? "border-destructive" : ""}
        />
        {errors.opportunity && (
          <p className="text-sm text-destructive">{errors.opportunity}</p>
        )}
      </div>
      <div className="space-y-2">
        <label
          htmlFor="edit-due-date"
          className="text-sm font-medium text-foreground"
        >
          Due date <span className="text-muted-foreground">(optional)</span>
        </label>
        <SingleDatePicker
          id="edit-due-date"
          value={dueDate}
          onChange={setDueDate}
          disabled={loading}
          placeholder="Select date"
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="edit-status"
          className="text-sm font-medium text-foreground"
        >
          Status <span className="text-destructive">*</span>
        </label>
        <select
          id="edit-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={loading}
          className={`flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
            errors.status ? "border-destructive" : "border-input"
          }`}
        >
          <option value="">Select status</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {errors.status && (
          <p className="text-sm text-destructive">{errors.status}</p>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
