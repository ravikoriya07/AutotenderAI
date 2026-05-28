"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/Button";
import { SectionNav } from "@/features/inventory-management/components/layout/SectionNav";
import { ModuleShell } from "@/features/inventory-management/components/layout/ModuleShell";
import { SectionCard } from "@/features/inventory-management/components/ui/SectionCard";
import { SectionHeader } from "@/features/inventory-management/components/ui/SectionHeader";
import {
  FormField,
  FormInput,
  FormTextarea,
} from "@/features/inventory-management/components/ui/FormField";
import { INQUIRY_MANAGEMENT_BASE } from "@/features/inventory-management/config/modules";
import { PROJECT_DETAILS_SECTIONS } from "@/features/inventory-management/config/project-details-sections";
import { useInventoryWorkflow } from "@/features/inventory-management/context/InventoryWorkflowContext";
import {
  projectDetailsSchema,
  type ProjectDetailsSchema,
} from "@/features/inventory-management/schemas/project-details";
import { saveProjectDetails } from "@/features/inventory-management/services/inventoryManagementService";
import { MOCK_TRADES } from "@/features/inventory-management/data/mock-data";

export function ProjectDetailsModule() {
  const { projectDetails, setProjectDetails } = useInventoryWorkflow();
  const [activeSection, setActiveSection] = useState(
    PROJECT_DETAILS_SECTIONS[0]!.id
  );

  const section = useMemo(
    () =>
      PROJECT_DETAILS_SECTIONS.find((s) => s.id === activeSection) ??
      PROJECT_DETAILS_SECTIONS[0]!,
    [activeSection]
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProjectDetailsSchema>({
    resolver: zodResolver(projectDetailsSchema),
    defaultValues: projectDetails,
  });

  const onSave = handleSubmit(async (values) => {
    const saved = await saveProjectDetails({
      ...projectDetails,
      ...values,
    });
    setProjectDetails(saved);
    toast.success("Project details saved.");
  });

  return (
    <ModuleShell
      sidebar={
        <SectionNav
          items={PROJECT_DETAILS_SECTIONS.map((s) => ({
            id: s.id,
            label: s.label,
          }))}
          activeId={activeSection}
          onSelect={(id) =>
            setActiveSection(id as (typeof PROJECT_DETAILS_SECTIONS)[number]["id"])
          }
        />
      }
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => void onSave()}
          >
            Save
          </Button>
          <Link
            href={`${INQUIRY_MANAGEMENT_BASE}/document-abstraction`}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Proceed →
          </Link>
        </div>
      }
    >
      <SectionHeader title={section.title} description={section.description} />

      <SectionCard>
        {activeSection === "project-information" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Project Name"
              error={errors.projectName?.message}
              className="sm:col-span-2"
            >
              <FormInput {...register("projectName")} />
            </FormField>
            <FormField label="Client" error={errors.client?.message}>
              <FormInput {...register("client")} />
            </FormField>
            <FormField label="Project Reference" error={errors.projectReference?.message}>
              <FormInput {...register("projectReference")} />
            </FormField>
            <FormField label="Site Address" error={errors.siteAddress?.message} className="sm:col-span-2">
              <FormInput {...register("siteAddress")} />
            </FormField>
            <FormField label="Budget">
              <FormInput {...register("budget")} />
            </FormField>
            <FormField label="Stage">
              <FormInput {...register("stage")} />
            </FormField>
          </div>
        )}

        {activeSection === "key-dates" && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <FormField label="Start on Site">
                <FormInput {...register("startOnSite")} />
              </FormField>
              <FormField label="Completion">
                <FormInput {...register("completion")} />
              </FormField>
              <FormField label="Duration">
                <FormInput {...register("duration")} />
              </FormField>
              <FormField label="Global Return Date" className="sm:max-w-sm">
                <FormInput {...register("globalReturnDate")} />
              </FormField>
            </div>
            <SectionCard
              header={
                <span className="text-sm font-semibold">Per-Trade Return Date Overrides</span>
              }
            >
              <div className="divide-y divide-border">
                {MOCK_TRADES.map((trade) => (
                  <div
                    key={trade.id}
                    className="grid gap-3 py-3 sm:grid-cols-[1fr_220px_140px] sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-medium">{trade.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Default: {projectDetails.globalReturnDate}
                      </p>
                    </div>
                    <FormInput placeholder={projectDetails.globalReturnDate} />
                    <div className="flex items-center gap-2">
                      <FormInput defaultValue="7" className="w-16" />
                      <span className="text-xs text-muted-foreground">days</span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </>
        )}

        {activeSection === "contract-details" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Contract Form" className="sm:col-span-2">
              <FormInput {...register("contractForm")} />
            </FormField>
            <FormField label="Employer's Agent">
              <FormInput {...register("employersAgent")} placeholder="Name or firm" />
            </FormField>
            <FormField label="Architect">
              <FormInput {...register("architect")} placeholder="Name or firm" />
            </FormField>
          </div>
        )}

        {activeSection === "works-description" && (
          <div className="space-y-4">
            <FormField label="General / Utilities">
              <FormTextarea {...register("worksGeneral")} />
            </FormField>
            <FormField label="Mechanical Works">
              <FormTextarea {...register("worksMechanical")} />
            </FormField>
            <FormField label="Electrical Works">
              <FormTextarea {...register("worksElectrical")} />
            </FormField>
            <FormField label="Fabric / Building Works">
              <FormTextarea {...register("worksFabric")} />
            </FormField>
          </div>
        )}
      </SectionCard>
    </ModuleShell>
  );
}
