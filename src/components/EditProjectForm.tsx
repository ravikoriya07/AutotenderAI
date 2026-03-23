"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SingleDatePicker } from "@/components/SingleDatePicker";
import { editProject } from "@/services/projectService";
import type { Project } from "@/types/project";
import {
  projectFormSchema,
  PROJECT_STATUS_VALUES,
  type ProjectFormValues,
} from "@/lib/validations/projectFormSchema";
import { getApiErrorDetailMessage } from "@/lib/apiErrorMessage";
import { cn } from "@/lib/utils";

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
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(
      projectFormSchema
    ) as Resolver<ProjectFormValues>,
    defaultValues: {
      opportunity: project.opportunity,
      dueDate: dueDateToYmd(project.dueDate),
      status: project.status,
    },
  });

  useEffect(() => {
    reset({
      opportunity: project.opportunity,
      dueDate: dueDateToYmd(project.dueDate),
      status: project.status,
    });
  }, [project, reset]);

  async function onSubmit(values: ProjectFormValues) {
    setFormError(null);
    try {
      await editProject(project.id, {
        opportunity: values.opportunity.trim(),
        due_date: values.dueDate.trim() ? values.dueDate.trim() : "N/A",
        status: values.status,
      });
      toast.success("Project updated successfully.");
      onSuccess();
    } catch (err) {
      const fallback =
        axios.isAxiosError(err) && err.response?.status === 422
          ? "Could not update project. Check your input."
          : "Failed to update project.";
      const message = getApiErrorDetailMessage(err, fallback);
      setFormError(message);
      toast.error(message);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
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
          autoComplete="off"
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.opportunity)}
          className={cn(
            errors.opportunity && "border-destructive focus-visible:ring-destructive"
          )}
          {...register("opportunity")}
        />
        {errors.opportunity && (
          <p className="text-sm text-destructive" role="alert">
            {errors.opportunity.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label
          htmlFor="edit-due-date"
          className="text-sm font-medium text-foreground"
        >
          Due date <span className="text-muted-foreground">(optional)</span>
        </label>
        <Controller
          name="dueDate"
          control={control}
          render={({ field }) => (
            <SingleDatePicker
              id="edit-due-date"
              value={field.value}
              onChange={field.onChange}
              disabled={isSubmitting}
              placeholder="Select date"
            />
          )}
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
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.status)}
          className={cn(
            "flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            errors.status
              ? "border-destructive focus-visible:ring-destructive"
              : "border-input"
          )}
          {...register("status")}
        >
          <option value="">Select status</option>
          {PROJECT_STATUS_VALUES.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {errors.status && (
          <p className="text-sm text-destructive" role="alert">
            {errors.status.message}
          </p>
        )}
      </div>
      {formError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}
