"use client";

/**
 * Currency field renderer — formats numbers as $X.XX with sign.
 */
export function CurrencyField({
  value,
  format = "$%.2f",
  className = "",
}: {
  value: number | string;
  format?: string;
  className?: string;
}) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return <span className={className}>{String(value)}</span>;

  const isNegative = num < 0;
  const abs = Math.abs(num);

  // Simple sprintf-like formatting
  let formatted = format.replace("%.2f", abs.toFixed(2)).replace("%d", String(Math.round(abs)));
  if (isNegative) formatted = "-" + formatted;

  return (
    <span className={`font-mono tabular-nums ${isNegative ? "text-red-400" : "text-emerald-400"} ${className}`}>
      {formatted}
    </span>
  );
}
