import { ExtractPageContent } from "@/components/extract/ExtractPageContent";

export default async function ExtractPage({
  searchParams,
}: {
  searchParams: Promise<{ job_id?: string }>;
}) {
  const params = await searchParams;
  return <ExtractPageContent jobId={params.job_id ?? ""} />;
}
