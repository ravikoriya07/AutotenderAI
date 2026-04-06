"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy URLs `/research/:id` redirect to flat `/research` (project + sessions are header-scoped). */
export default function ResearchSessionRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/research");
  }, [router]);

  return null;
}
