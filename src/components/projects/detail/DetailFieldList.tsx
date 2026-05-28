import type {
  ProjectDetailField,
  ProjectDetailSection,
} from "@/types/project-detail";
import { DetailFieldValue } from "@/components/projects/detail/DetailFieldValue";

type DetailFieldListProps = {
  title?: string;
  fields?: ProjectDetailField[];
  sections?: ProjectDetailSection[];
};

function FieldRows({ fields }: { fields: ProjectDetailField[] }) {
  return (
    <div className="divide-y divide-border border-t border-border">
      {fields.map((field) => (
        <div
          key={field.label}
          className="grid gap-3 py-4 sm:grid-cols-[minmax(0,18rem)_1fr] sm:gap-10 sm:py-5"
        >
          <div className="text-sm font-semibold text-muted-foreground">
            {field.label}
          </div>
          <div className="min-w-0 text-sm font-medium leading-relaxed text-foreground">
            <DetailFieldValue field={field} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailFieldList({
  title,
  fields,
  sections,
}: DetailFieldListProps) {
  return (
    <div>
      {title ? (
        <h2 className="mb-6 text-lg font-semibold text-foreground">{title}</h2>
      ) : null}
      {sections?.length
        ? sections.map((section) => (
            <div
              key={section.id ?? section.title ?? section.fields[0]?.label}
              className="mb-8 last:mb-0"
            >
              {section.title ? (
                <h3 className="mb-4 text-base font-semibold text-foreground">
                  {section.title}
                </h3>
              ) : null}
              <FieldRows fields={section.fields} />
            </div>
          ))
        : null}
      {fields?.length ? <FieldRows fields={fields} /> : null}
    </div>
  );
}
