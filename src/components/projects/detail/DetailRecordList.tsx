import { NamedSupplierCard } from "@/components/projects/detail/NamedSupplierCard";
import { supplierRecordKey } from "@/components/projects/detail/supplierRecordLayout";
import { Users } from "lucide-react";

type DetailRecordListProps = {
  title?: string;
  records: Record<string, string>[];
};

export function DetailRecordList({ title, records }: DetailRecordListProps) {
  const sectionTitle = title ?? "Records";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {sectionTitle}
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          <Users className="h-3 w-3" aria-hidden />
          {records.length} {records.length === 1 ? "supplier" : "suppliers"}
        </span>
      </div>

      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No suppliers recorded for this project.
        </p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 items-start gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {records.map((record, index) => (
            <li key={supplierRecordKey(record, index)} className="min-w-0">
              <NamedSupplierCard record={record} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
