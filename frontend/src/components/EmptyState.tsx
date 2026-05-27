export function EmptyState({ message }: Readonly<{ message: string }>) {
  return (
    <output className="flex flex-col items-center justify-center py-16 text-slate-400">
      <p className="text-sm">{message}</p>
    </output>
  );
}
