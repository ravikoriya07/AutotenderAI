"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { toast } from "react-toastify";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/lib/validations/registerSchema";
import { registerUser } from "@/services/authService";
import { getApiErrorDetailMessage } from "@/lib/apiErrorMessage";
import { cn } from "@/lib/utils";

function getRegisterErrorMessage(err: unknown): string {
  const fallback =
    axios.isAxiosError(err) && err.response?.status === 422
      ? "Could not register. Check your input."
      : "Registration failed. Please try again.";
  return getApiErrorDetailMessage(err, fallback);
}

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setFormError(null);
    try {
      await registerUser({
        username: values.username,
        name: values.name,
        email: values.email,
        password: values.password,
      });
      toast.success("Account created. You can sign in now.");
      router.push("/login");
    } catch (err) {
      const message = getRegisterErrorMessage(err);
      setFormError(message);
      toast.error(message);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <label
          htmlFor="register-username"
          className="text-sm font-medium text-foreground"
        >
          Username
        </label>
        <Input
          id="register-username"
          type="text"
          placeholder="johndoe"
          autoComplete="username"
          aria-invalid={Boolean(errors.username)}
          className={cn(errors.username && "border-destructive focus-visible:ring-destructive")}
          {...register("username")}
        />
        {errors.username && (
          <p className="text-sm text-destructive" role="alert">
            {errors.username.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="register-name"
          className="text-sm font-medium text-foreground"
        >
          Name
        </label>
        <Input
          id="register-name"
          type="text"
          placeholder="John Doe"
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          className={cn(errors.name && "border-destructive focus-visible:ring-destructive")}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="register-email"
          className="text-sm font-medium text-foreground"
        >
          Email
        </label>
        <Input
          id="register-email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          className={cn(errors.email && "border-destructive focus-visible:ring-destructive")}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="register-password"
          className="text-sm font-medium text-foreground"
        >
          Password
        </label>
        <p className="text-xs text-muted-foreground">
          Use at least 8 characters with uppercase, lowercase, and a number.
        </p>
        <div className="relative">
          <Input
            id="register-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            className={cn(
              "pr-10",
              errors.password && "border-destructive focus-visible:ring-destructive"
            )}
            {...register("password")}
          />
          <button
            type="button"
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="register-confirm-password"
          className="text-sm font-medium text-foreground"
        >
          Confirm Password
        </label>
        <div className="relative">
          <Input
            id="register-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            className={cn(
              "pr-10",
              errors.confirmPassword &&
                "border-destructive focus-visible:ring-destructive"
            )}
            {...register("confirmPassword")}
          />
          <button
            type="button"
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={
              showConfirmPassword ? "Hide confirm password" : "Show confirm password"
            }
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-destructive" role="alert">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {formError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Registering…
          </>
        ) : (
          "Register"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
