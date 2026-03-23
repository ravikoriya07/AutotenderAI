"use client";

import { useState } from "react";
import axios from "axios";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SingleDatePicker } from "@/components/SingleDatePicker";
import { createProject } from "@/services/projectService";
import {
  projectFormSchema,
  PROJECT_STATUS_VALUES,
  type ProjectFormValues,
} from "@/lib/validations/projectFormSchema";
import { getApiErrorDetailMessage } from "@/lib/apiErrorMessage";
import { cn } from "@/lib/utils";

interface CreateProjectFormProps {
  onSuccess: () => void;
}

export function CreateProjectForm({ onSuccess }: CreateProjectFormProps) {
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
      opportunity: "",
      dueDate: "",
      status: "",
    },
  });

  async function onSubmit(values: ProjectFormValues) {
    setFormError(null);
    try {
      await createProject({
        opportunity: values.opportunity.trim(),
        due_date: values.dueDate.trim() ? values.dueDate.trim() : "N/A",
        status: values.status,
      });
      toast.success("Project created successfully.");
      reset({ opportunity: "", dueDate: "", status: "" });
      onSuccess();
    } catch (err) {
      const fallback =
        axios.isAxiosError(err) && err.response?.status === 422
          ? "Could not create project. Check your input."
          : "Failed to create project.";
      const message = getApiErrorDetailMessage(err, fallback);
      setFormError(message);
      toast.error(message);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
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
          htmlFor="create-due-date"
          className="text-sm font-medium text-foreground"
        >
          Due date <span className="text-muted-foreground">(optional)</span>
        </label>
        <Controller
          name="dueDate"
          control={control}
          render={({ field }) => (
            <SingleDatePicker
              id="create-due-date"
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
          htmlFor="create-status"
          className="text-sm font-medium text-foreground"
        >
          Status <span className="text-destructive">*</span>
        </label>
        <select
          id="create-status"
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
              Creating…
            </>
          ) : (
            "Create project"
          )}
        </Button>
      </div>
    </form>
  );
}
