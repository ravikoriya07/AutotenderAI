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
import { loginSchema, type LoginFormValues } from "@/lib/validations/loginSchema";
import { loginUser } from "@/services/authService";
import { setAuthSession } from "@/lib/authStorage";
import { getApiErrorDetailMessage } from "@/lib/apiErrorMessage";
import { cn } from "@/lib/utils";

function getLoginErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === "Invalid login response" || err.message === "Login response missing token") {
      return "Login failed. Unexpected response from server.";
    }
  }
  const fallback =
    axios.isAxiosError(err) && err.response?.status === 401
      ? "Invalid username or password."
      : "Login failed. Please try again.";
  return getApiErrorDetailMessage(err, fallback);
}

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      const { token, name, email } = await loginUser({
        username: values.username,
        password: values.password,
      });
      setAuthSession(token, name, email);
      toast.success("Signed in successfully.");
      router.push("/projects");
    } catch (err) {
      const message = getLoginErrorMessage(err);
      setFormError(message);
      toast.error(message);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <label
          htmlFor="login-username"
          className="text-sm font-medium text-foreground"
        >
          Username
        </label>
        <Input
          id="login-username"
          type="text"
          placeholder="johndoe"
          autoComplete="username"
          aria-invalid={Boolean(errors.username)}
          className={cn(
            errors.username && "border-destructive focus-visible:ring-destructive"
          )}
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
          htmlFor="login-password"
          className="text-sm font-medium text-foreground"
        >
          Password
        </label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
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

      {formError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Signing in…
          </>
        ) : (
          "Log in"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          Register
        </Link>
      </p>
    </form>
  );
}
