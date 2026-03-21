import type { StepRuntime } from "@/lib/processingPipelineConfig";
import { StepItem } from "./StepItem";

type StepListProps = {
  steps: StepRuntime[];
};

function renderColumn(
  columnSteps: StepRuntime[],
  partLabel: string,
  partIndex: 1 | 2
) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{partLabel}</p>
      <ul
        className="space-y-2"
        role="list"
        aria-label={`Processing steps, part ${partIndex} of 2`}
      >
        {columnSteps.map((step) => (
          <li key={step.id}>
            <StepItem
              step={step}
              isActive={step.status === "processing"}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StepList({ steps }: StepListProps) {
  const half = Math.ceil(steps.length / 2);
  const part1 = steps.slice(0, half);
  const part2 = steps.slice(half);

  const label1 =
    part1.length > 0
      ? `Part 1 (steps ${part1[0].id}–${part1[part1.length - 1].id})`
      : "Part 1";
  const label2 =
    part2.length > 0
      ? `Part 2 (steps ${part2[0].id}–${part2[part2.length - 1].id})`
      : "Part 2";

  return (
    <div
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-4"
      role="group"
      aria-label="Processing pipeline steps in two columns"
    >
      {renderColumn(part1, label1, 1)}
      {renderColumn(part2, label2, 2)}
    </div>
  );
}
