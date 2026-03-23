import { z } from "zod";

export const PROJECT_STATUS_VALUES = [
  "Preparing",
  "In Progress",
  "Completed",
] as const;

function isProjectStatus(s: string): s is (typeof PROJECT_STATUS_VALUES)[number] {
  return (PROJECT_STATUS_VALUES as readonly string[]).includes(s);
}

export const projectFormSchema = z.object({
  opportunity: z.string().min(1, "Opportunity is required"),
  dueDate: z.string(),
  status: z
    .string()
    .min(1, "Status is required")
    .refine(isProjectStatus, { message: "Select a valid status" }),
});

/** Form state uses `""` for unselected status before validation; Zod output narrows `status`. */
export type ProjectFormValues = {
  opportunity: string;
  dueDate: string;
  status: string;
};
