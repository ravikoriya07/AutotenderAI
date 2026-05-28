import type { ReactNode } from "react";
import {
  Building2,
  Globe,
  Mail,
  MapPin,
  Package,
  Phone,
  type LucideIcon,
} from "lucide-react";
import {
  isFullWidthContact,
  partitionSupplierRecord,
  shortContactLabel,
} from "@/components/projects/detail/supplierRecordLayout";
import { cn } from "@/lib/utils";

type NamedSupplierCardProps = {
  record: Record<string, string>;
};

function contactIcon(label: string): LucideIcon {
  const key = label.trim().toLowerCase();
  if (key.includes("address")) return MapPin;
  if (key.includes("phone") || key.includes("tel")) return Phone;
  if (key.includes("web") || key.includes("url")) return Globe;
  if (key.includes("email") || key.includes("e-mail")) return Mail;
  return MapPin;
}

function ContactLink({ label, value }: { label: string; value: string }) {
  const key = label.trim().toLowerCase();

  if (key.includes("email")) {
    return (
      <a
        href={`mailto:${value}`}
        className="line-clamp-2 break-all text-foreground underline-offset-2 hover:text-primary hover:underline"
      >
        {value}
      </a>
    );
  }

  if (key.includes("web") || key.includes("url")) {
    const href = value.startsWith("http") ? value : `https://${value}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="line-clamp-2 break-all text-foreground underline-offset-2 hover:text-primary hover:underline"
      >
        {value}
      </a>
    );
  }

  if (key.includes("phone") || key.includes("tel")) {
    return (
      <a
        href={`tel:${value.replace(/\s/g, "")}`}
        className="text-foreground underline-offset-2 hover:text-primary hover:underline"
      >
        {value}
      </a>
    );
  }

  return (
    <span className="line-clamp-3 break-words text-foreground">{value}</span>
  );
}

const FIELD_LABEL_CLASS =
  "block text-[10px] font-medium leading-[14px] text-muted-foreground";

function FieldIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      className="flex h-[14px] w-3.5 shrink-0 items-center justify-center text-muted-foreground/80"
      aria-hidden
    >
      <Icon className="h-3 w-3" />
    </span>
  );
}

function IconLabeledBlock({
  icon,
  label,
  children,
  as: Tag = "div",
  className,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  as?: "div" | "li";
  className?: string;
}) {
  return (
    <Tag className={cn("flex min-w-0 gap-2", className)}>
      <FieldIcon icon={icon} />
      <div className="min-w-0 flex-1">
        <span className={FIELD_LABEL_CLASS}>{label}</span>
        <div className="mt-0.5 text-xs leading-snug">{children}</div>
      </div>
    </Tag>
  );
}

function ContactCell({ label, value }: { label: string; value: string }) {
  const Icon = contactIcon(label);
  const fullWidth = isFullWidthContact(label);

  return (
    <IconLabeledBlock
      as="li"
      icon={Icon}
      label={shortContactLabel(label)}
      className={cn(
        "rounded-md border border-transparent px-1 py-0.5",
        fullWidth && "col-span-full"
      )}
    >
      <ContactLink label={label} value={value} />
    </IconLabeledBlock>
  );
}

export function NamedSupplierCard({ record }: NamedSupplierCardProps) {
  const { title, highlight, contact, other } = partitionSupplierRecord(record);

  if (!title && !highlight && contact.length === 0 && other.length === 0) {
    return null;
  }

  const displayTitle = title?.value ?? "Supplier";
  const hasContact = contact.length > 0;
  const hasFooter = hasContact || other.length > 0;

  return (
    <article
      className={cn(
        "group flex flex-col rounded-lg border border-border bg-card",
        "shadow-sm transition-[border-color,box-shadow] duration-200",
        "hover:border-primary/25 hover:shadow-md"
      )}
    >
      <div className="flex items-start gap-2.5 px-3.5 pt-3.5 pb-2">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            "border border-border bg-muted/40 text-muted-foreground",
            "transition-colors group-hover:border-primary/20 group-hover:text-primary"
          )}
          aria-hidden
        >
          <Building2 className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
            {displayTitle}
          </h3>
        </div>
      </div>

      {highlight ? (
        <div
          className={cn(
            "mx-3.5 rounded-md border border-border bg-muted/25 px-2.5 py-2",
            hasFooter ? "mb-2" : "mb-3.5"
          )}
        >
          <IconLabeledBlock icon={Package} label="Product reference">
            <p className="font-medium text-foreground line-clamp-4">
              {highlight.value}
            </p>
          </IconLabeledBlock>
        </div>
      ) : null}

      {hasFooter ? (
        <div className="border-t border-border px-3.5 py-2.5">
          {hasContact ? (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
              {contact.map((field) => (
                <ContactCell
                  key={field.label}
                  label={field.label}
                  value={field.value}
                />
              ))}
            </ul>
          ) : null}

          {other.length > 0 ? (
            <dl
              className={cn(
                "space-y-1.5",
                hasContact && "mt-2 border-t border-border/60 pt-2"
              )}
            >
              {other.map(({ label, value }) => (
                <div key={label} className="flex gap-2 text-xs">
                  <dt className="w-20 shrink-0 font-medium text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="min-w-0 flex-1 font-medium text-foreground">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : !highlight ? (
        <div className="pb-3.5" aria-hidden />
      ) : null}
    </article>
  );
}
