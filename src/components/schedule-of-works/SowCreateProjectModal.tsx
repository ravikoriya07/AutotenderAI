"use client";

import { useState } from "react";
import axios from "axios";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SingleDatePicker } from "@/components/SingleDatePicker";
import {
  projectFormSchema,
  PROJECT_STATUS_VALUES,
  type ProjectFormValues,
} from "@/lib/validations/projectFormSchema";
import { getApiErrorDetailMessage } from "@/lib/apiErrorMessage";
import { cn } from "@/lib/utils";

type SowCreateProjectModalProps = {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
};

export function SowCreateProjectModal({
  open,
  submitting,
  onClose,
  onSubmit,
}: SowCreateProjectModalProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema) as Resolver<ProjectFormValues>,
    defaultValues: {
      opportunity: "",
      dueDate: "",
      status: "",
    },
  });

  async function onValid(values: ProjectFormValues) {
    setFormError(null);
    try {
      await onSubmit(values);
      reset({ opportunity: "", dueDate: "", status: "" });
    } catch (err) {
      if (!axios.isAxiosError(err) && err instanceof Error && err.message) {
        setFormError(err.message);
        return;
      }
      const fallback =
        axios.isAxiosError(err) && err.response?.status === 422
          ? "Could not create project. Check your input."
          : "Failed to create project.";
      setFormError(getApiErrorDetailMessage(err, fallback));
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="Create project"
    >
      <form className="space-y-4" onSubmit={handleSubmit(onValid)} noValidate>
        <p className="text-sm text-muted-foreground">
          A project is required before the trade split can run.
        </p>
        <div className="space-y-2">
          <label
            htmlFor="sow-create-opportunity"
            className="text-sm font-medium text-foreground"
          >
            Opportunity <span className="text-destructive">*</span>
          </label>
          <Input
            id="sow-create-opportunity"
            type="text"
            placeholder="e.g. Test Project"
            autoComplete="off"
            disabled={submitting}
            aria-invalid={Boolean(errors.opportunity)}
            className={cn(
              errors.opportunity &&
                "border-destructive focus-visible:ring-destructive"
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
            htmlFor="sow-create-due-date"
            className="text-sm font-medium text-foreground"
          >
            Due date <span className="text-muted-foreground">(optional)</span>
          </label>
          <Controller
            name="dueDate"
            control={control}
            render={({ field }) => (
              <SingleDatePicker
                id="sow-create-due-date"
                value={field.value}
                onChange={field.onChange}
                disabled={submitting}
                placeholder="Select date"
              />
            )}
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="sow-create-status"
            className="text-sm font-medium text-foreground"
          >
            Status <span className="text-destructive">*</span>
          </label>
          <select
            id="sow-create-status"
            disabled={submitting}
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
          <Button type="submit" className="flex-1 gap-2" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Creating project…
              </>
            ) : (
              "Create project"
            )}
          </Button>
        </div>
        {submitting ? (
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            Creating the project and starting the trade split…
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
