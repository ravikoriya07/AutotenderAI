"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Search, Bell, HelpCircle, Menu } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";
import { useResearchProjectOptional } from "@/contexts/ResearchProjectContext";
import { useCompletedStepProjects } from "@/hooks/useCompletedStepProjects";
import { getAuthUserEmail, getAuthUserName } from "@/lib/authStorage";
import { getShortDisplayName, getUserInitials } from "@/lib/userDisplay";
import { CompletedStepsProjectSelect } from "@/components/projects/CompletedStepsProjectSelect";

interface HeaderProps {
  /** Renders before the page title (e.g. back control). */
  titleLeading?: ReactNode;
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
}

export function Header({
  titleLeading,
  title,
  subtitle,
  searchPlaceholder = "Search...",
}: HeaderProps) {
  const { collapsed, setCollapsed } = useSidebar();
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(getAuthUserName());
    setEmail(getAuthUserEmail());
  }, [pathname]);

  const initials = getUserInitials(displayName, email);
  const shortName = getShortDisplayName(displayName, email);

  const researchProject = useResearchProjectOptional();
  const onResearchRoute = pathname.startsWith("/research");
  const onOrganisationLibraryRoute = pathname === "/library";
  const onQuantityTakeOffRoute = pathname.startsWith("/quantity-take-off");
  const showResearchProjectPicker =
    researchProject != null &&
    (onResearchRoute ||
      onOrganisationLibraryRoute ||
      onQuantityTakeOffRoute);
  const { projects: researchCatalogProjects, loading: researchCatalogLoading } =
    useCompletedStepProjects({
      enabled: showResearchProjectPicker,
      ...(onResearchRoute || onQuantityTakeOffRoute
        ? { stepName: "upload_to_neo4j" }
        : {}),
    });

  useEffect(() => {
    if (!researchProject) return;
    if (!onResearchRoute && !onOrganisationLibraryRoute && !onQuantityTakeOffRoute)
      return;
    if (researchCatalogLoading) return;
    const id = researchProject.selectedProjectJobId.trim();
    if (!id) return;
    if (!researchCatalogProjects.some((p) => p.job_id === id)) {
      researchProject.setSelectedProjectJobId("");
    }
  }, [
    onResearchRoute,
    onOrganisationLibraryRoute,
    onQuantityTakeOffRoute,
    researchProject,
    researchCatalogLoading,
    researchCatalogProjects,
  ]);

  return (
    <header className="sticky top-0 z-30 border-b bg-background pt-[env(safe-area-inset-top,0px)]">
      <div className="flex h-12 min-w-0 items-center gap-2 bg-sidebar px-3 sm:gap-3 sm:px-4 lg:justify-between lg:gap-4">
        <button
          type="button"
          className="shrink-0 rounded p-2 text-sidebar-foreground hover:bg-sidebar-foreground/10 lg:hidden"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-base font-semibold text-sidebar-foreground lg:flex-initial lg:text-left lg:text-lg">
          AutotenderAI
        </span>
        {showResearchProjectPicker && researchProject ? (
          <div className="min-w-0 max-w-[9.5rem] shrink-0 sm:max-w-[13rem]">
            <CompletedStepsProjectSelect
              projects={researchCatalogProjects}
              loading={researchCatalogLoading}
              value={researchProject.selectedProjectJobId}
              onChange={researchProject.setSelectedProjectJobId}
            />
          </div>
        ) : (
          <div className="w-10 shrink-0 lg:hidden" aria-hidden />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-3 px-3 py-2 sm:min-h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center sm:gap-3">
          {titleLeading ? (
            <div className="shrink-0 pt-0.5 sm:pt-0">{titleLeading}</div>
          ) : null}
          {title && (
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-lg font-semibold leading-snug sm:truncate sm:leading-normal">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground sm:line-clamp-2 md:line-clamp-none">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-t border-border/50 pt-2 sm:w-auto sm:justify-end sm:gap-3 sm:border-t-0 sm:pt-0 md:gap-4">
          <div className="relative hidden min-w-0 md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder={searchPlaceholder}
              className="h-9 w-40 rounded-md border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary lg:w-48"
            />
          </div>
          <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2 md:flex-initial md:gap-3">
            <button
              className="min-h-9 min-w-9 shrink-0 rounded-md p-2 hover:bg-muted sm:min-h-0 sm:min-w-0"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <button
              className="min-h-9 min-w-9 shrink-0 rounded-md p-2 hover:bg-muted sm:min-h-0 sm:min-w-0"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <div
              className="flex min-w-0 items-center gap-2 pl-1 sm:pl-2"
              aria-label={
                email
                  ? `${shortName}, ${email}`
                  : displayName
                    ? shortName
                    : "Account"
              }
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary"
                aria-hidden
              >
                {initials}
              </div>
              <div className="hidden min-w-0 flex-col sm:flex">
                <span className="truncate text-sm font-medium leading-tight">
                  {shortName}
                </span>
                {email ? (
                  <span
                    className="truncate text-xs text-muted-foreground"
                    title={email}
                  >
                    {email}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
