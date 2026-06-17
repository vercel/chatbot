"use client";

/**
 * Trail field renderer — shows a transaction/source trail as connected steps.
 */
export function TrailField({
  items,
  className = "",
}: {
  items: Array<{ label: string; value: string; status?: string }>;
  className?: string;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className={`space-y-1 ${className}`}>
      <span className="block text-[10px] uppercase tracking-wider text-white/30 mb-1">
        Source Trail
      </span>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="size-1 rounded-full bg-white/20 shrink-0" />
          <span className="text-white/50">{item.label}:</span>
          <span className="text-white/80 font-mono">{item.value}</span>
          {item.status && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                item.status === "success"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : item.status === "failed"
                    ? "bg-red-500/10 text-red-400"
                    : "bg-white/5 text-white/40"
              }`}
            >
              {item.status}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
