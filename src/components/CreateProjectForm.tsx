"use client";

import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createProject } from "@/services/projectService";
import type { ApiErrorResponse } from "@/types/project";

const STATUS_OPTIONS = ["Preparing", "Writing"];

interface CreateProjectFormProps {
  onSuccess: () => void;
}

export function CreateProjectForm({ onSuccess }: CreateProjectFormProps) {
  const [opportunity, setOpportunity] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ opportunity?: string; status?: string }>({});

  function validate(): boolean {
    const next: { opportunity?: string; status?: string } = {};
    if (!opportunity.trim()) next.opportunity = "Opportunity is required.";
    if (!status) next.status = "Status is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function resetForm() {
    setOpportunity("");
    setDueDate("");
    setStatus("");
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (!validate()) return;

    setLoading(true);
    try {
      await createProject({
        opportunity: opportunity.trim(),
        due_date: dueDate.trim() || "N/A",
        status,
      });
      toast.success("Project created successfully.");
      resetForm();
      onSuccess();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const data = err.response.data as ApiErrorResponse | undefined;
        const first = data?.detail?.[0];
        const message = first?.msg ?? "Could not create project. Check your input.";
        toast.error(message);
      } else {
        toast.error("Failed to create project.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          htmlFor="create-opportunity"
          className="text-sm font-medium text-foreground"
        >
          Opportunity <span className="text-destructive">*</span>
        </label>
        <Input
          id="create-opportunity"
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
          htmlFor="create-due-date"
          className="text-sm font-medium text-foreground"
        >
          Due date
        </label>
        <Input
          id="create-due-date"
          type="text"
          placeholder="N/A or date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="create-status"
          className="text-sm font-medium text-foreground"
        >
          Status <span className="text-destructive">*</span>
        </label>
        <select
          id="create-status"
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
          {loading ? "Creating…" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
