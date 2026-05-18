export function Spinner() {
  return (
    <output
      className="flex items-center justify-center py-16"
      aria-label="Loading"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
    </output>
  );
}
