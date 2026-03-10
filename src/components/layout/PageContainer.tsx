import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main
      className={cn(
        "min-h-screen bg-muted/30 p-6",
        className
      )}
    >
      {children}
    </main>
  );
}
