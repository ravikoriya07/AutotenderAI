import { Button } from "@/components/ui/Button";

type ContractorFilterToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  areaFilter: string;
  onAreaFilterChange: (value: string) => void;
  areas: string[];
  selectedOnly: boolean;
  onSelectedOnlyChange: (value: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
};

export function ContractorFilterToolbar({
  search,
  onSearchChange,
  areaFilter,
  onAreaFilterChange,
  areas,
  selectedOnly,
  onSelectedOnlyChange,
  onSelectAll,
  onClear,
}: ContractorFilterToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-border bg-card px-5 py-2.5">
      <input
        type="search"
        placeholder="Search company, name or area..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-9 w-full max-w-[250px] rounded-md border border-input bg-background px-3 text-sm"
      />
      <select
        value={areaFilter}
        onChange={(e) => onAreaFilterChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        aria-label="Filter by area"
      >
        <option value="all">All Areas</option>
        {areas.map((area) => (
          <option key={area} value={area}>
            {area}
          </option>
        ))}
      </select>
      <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={selectedOnly}
          onChange={(e) => onSelectedOnlyChange(e.target.checked)}
        />
        Selected only
      </label>
      <div className="flex-1" />
      <Button type="button" variant="ghost" size="sm" onClick={onSelectAll}>
        Select All
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
