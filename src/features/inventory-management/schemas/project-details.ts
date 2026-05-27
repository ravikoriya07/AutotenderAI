import { z } from "zod";

export const projectDetailsSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  client: z.string().min(1, "Client is required"),
  projectReference: z.string().min(1, "Reference is required"),
  siteAddress: z.string().min(1, "Site address is required"),
  budget: z.string().optional(),
  stage: z.string().optional(),
  startOnSite: z.string().optional(),
  completion: z.string().optional(),
  duration: z.string().optional(),
  globalReturnDate: z.string().optional(),
  contractForm: z.string().optional(),
  employersAgent: z.string().optional(),
  architect: z.string().optional(),
  worksGeneral: z.string().optional(),
  worksMechanical: z.string().optional(),
  worksElectrical: z.string().optional(),
  worksFabric: z.string().optional(),
});

export type ProjectDetailsSchema = z.infer<typeof projectDetailsSchema>;
