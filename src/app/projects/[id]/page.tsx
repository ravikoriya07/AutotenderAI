import { ProjectDetailRouteClient } from "@/app/projects/[id]/ProjectDetailRouteClient";

export const dynamic = "force-dynamic";

type ProjectDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { id } = await params;
  const projectId = Array.isArray(id) ? id[0] ?? "" : id ?? "";

  return <ProjectDetailRouteClient projectId={projectId} />;
}
