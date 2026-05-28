type DetailStringListProps = {
  title?: string;
  items: string[];
};

export function DetailStringList({ title, items }: DetailStringListProps) {
  return (
    <div>
      {title ? (
        <h2 className="mb-6 text-lg font-semibold text-foreground">{title}</h2>
      ) : null}
      <ul className="divide-y divide-border border-t border-border">
        {items.map((item) => (
          <li
            key={item}
            className="py-4 text-sm font-medium text-foreground sm:py-5"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
