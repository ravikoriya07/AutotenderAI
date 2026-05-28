import type { ProjectDetailField } from "@/types/project-detail";
import { cn } from "@/lib/utils";

type DetailFieldValueProps = {
  field: ProjectDetailField;
  className?: string;
};

export function DetailFieldValue({ field, className }: DetailFieldValueProps) {
  const { value, format } = field;

  if (value == null || value === "") {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  if (Array.isArray(value)) {
    if (format === "multiline") {
      return (
        <span
          className={cn("block whitespace-pre-line", className)}
        >
          {value.join("\n")}
        </span>
      );
    }
    return (
      <div className={cn("space-y-3 text-foreground", className)}>
        {value.map((paragraph, index) => (
          <p key={`${field.label}-${index}`}>{paragraph}</p>
        ))}
      </div>
    );
  }

  if (format === "multiline") {
    return (
      <span className={cn("block whitespace-pre-line", className)}>
        {value}
      </span>
    );
  }

  return <span className={className}>{value}</span>;
}
