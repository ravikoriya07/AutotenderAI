import { z } from "zod";

const usernameRegex = /^[a-zA-Z0-9._-]+$/;
const hasUppercase = /[A-Z]/;
const hasLowercase = /[a-z]/;
const hasNumber = /[0-9]/;

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1, "Please enter a username.")
      .min(3, "Username must be at least 3 characters.")
      .max(30, "Username must be at most 30 characters.")
      .regex(
        usernameRegex,
        "Username can only contain letters, numbers, dot, underscore, and hyphen."
      ),
    name: z
      .string()
      .trim()
      .min(1, "Please enter your full name.")
      .min(2, "Name is too short.")
      .max(80, "Name is too long.")
      .refine(
        (value) => value.split(/\s+/).filter(Boolean).length >= 2,
        "Please enter first and last name."
      ),
    email: z
      .string()
      .trim()
      .min(1, "Please enter your email address.")
      .email("Please enter a valid email address."),
    password: z
      .string()
      .min(1, "Please create a password.")
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password is too long.")
      .refine((value) => hasUppercase.test(value), {
        message: "Password must include at least one uppercase letter.",
      })
      .refine((value) => hasLowercase.test(value), {
        message: "Password must include at least one lowercase letter.",
      })
      .refine((value) => hasNumber.test(value), {
        message: "Password must include at least one number.",
      }),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
