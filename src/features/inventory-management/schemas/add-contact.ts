import { z } from "zod";

export const addContactSchema = z.object({
  company: z.string().trim().min(1, "Company name is required"),
  name: z.string().trim().optional(),
  tel: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Enter a valid email address",
    }),
  area: z.string().trim().optional(),
});

export type AddContactFormValues = z.infer<typeof addContactSchema>;
