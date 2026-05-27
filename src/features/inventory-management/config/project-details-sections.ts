import type { ProjectDetailsFormValues } from "@/features/inventory-management/types";

export type ProjectDetailsSectionId =
  | "project-information"
  | "key-dates"
  | "contract-details"
  | "works-description";

export type ProjectDetailsSectionConfig = {
  id: ProjectDetailsSectionId;
  label: string;
  title: string;
  description: string;
  fieldKeys: (keyof ProjectDetailsFormValues)[];
};

export const PROJECT_DETAILS_SECTIONS: ProjectDetailsSectionConfig[] = [
  {
    id: "project-information",
    label: "Project Information",
    title: "Project Information",
    description: "Core project details used across all enquiry emails",
    fieldKeys: [
      "projectName",
      "client",
      "projectReference",
      "siteAddress",
      "budget",
      "stage",
    ],
  },
  {
    id: "key-dates",
    label: "Key Dates & Returns",
    title: "Key Dates & Return Dates",
    description: "Programme dates and per-trade return dates",
    fieldKeys: [
      "startOnSite",
      "completion",
      "duration",
      "globalReturnDate",
    ],
  },
  {
    id: "contract-details",
    label: "Contract Details",
    title: "Contract Details",
    description: "Shown in enquiry emails",
    fieldKeys: ["contractForm", "employersAgent", "architect"],
  },
  {
    id: "works-description",
    label: "Works Description",
    title: "Works Description",
    description: "Inserted into enquiry emails when works summary is enabled",
    fieldKeys: [
      "worksGeneral",
      "worksMechanical",
      "worksElectrical",
      "worksFabric",
    ],
  },
];
