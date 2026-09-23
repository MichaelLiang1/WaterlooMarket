export function Stars({ value, count }: { value: number; count?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1 text-xs" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      <span className="text-gold-500">
        {"★".repeat(rounded)}
        <span className="text-stone-300">{"★".repeat(5 - rounded)}</span>
      </span>
      <span className="text-stone-600">
        {value.toFixed(1)}
        {count !== undefined && ` (${count})`}
      </span>
    </span>
  );
}
