import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main
      className={cn(
        "min-h-screen min-w-0 overflow-x-hidden bg-muted/30 p-3 sm:p-4 lg:p-6",
        className
      )}
    >
      {children}
    </main>
  );
}
