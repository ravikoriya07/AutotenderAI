"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { clearAuthSession, getAuthToken } from "@/lib/authStorage";
import { verifyToken } from "@/services/authService";

const PUBLIC_ROUTES = new Set(["/login", "/register"]);

type AuthGateProps = {
  children: React.ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  const isPublicRoute = useMemo(() => {
    if (!pathname) return false;
    return PUBLIC_ROUTES.has(pathname);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const token = getAuthToken();
      setChecking(true);
      if (isPublicRoute) {
        if (!token) {
          if (!cancelled) setChecking(false);
          return;
        }
        try {
          await verifyToken(token);
          if (cancelled) return;
          router.replace("/projects");
        } catch {
          clearAuthSession();
          if (!cancelled) setChecking(false);
        }
        return;
      }

      if (!token) {
        clearAuthSession();
        router.replace("/login");
        // Keep loader until navigation — avoid mounting protected pages without auth.
        return;
      }

      try {
        await verifyToken(token);
        if (!cancelled) setChecking(false);
      } catch {
        clearAuthSession();
        router.replace("/login");
        return;
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [isPublicRoute, router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return <>{children}</>;
}

