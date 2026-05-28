type DetailPlaceholderProps = {
  message: string;
};

export function DetailPlaceholder({ message }: DetailPlaceholderProps) {
  return (
    <p className="px-1 py-8 text-sm text-muted-foreground">{message}</p>
  );
}
