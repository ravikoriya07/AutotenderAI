import type { LucideIcon } from "lucide-react";
import {
  FileText,
  FileWarning,
  LayoutDashboard,
  Scale,
  Trophy,
  Users,
} from "lucide-react";
import type { ProjectDetailTabIcon } from "@/types/project-detail";

const ICON_MAP: Record<ProjectDetailTabIcon, LucideIcon> = {
  overview: LayoutDashboard,
  "file-text": FileText,
  scale: Scale,
  "file-warning": FileWarning,
  users: Users,
  trophy: Trophy,
};

const DEFAULT_ICON: ProjectDetailTabIcon = "file-text";

export function resolveTabIcon(icon?: string): LucideIcon {
  if (icon && icon in ICON_MAP) {
    return ICON_MAP[icon as ProjectDetailTabIcon];
  }
  return ICON_MAP[DEFAULT_ICON];
}
