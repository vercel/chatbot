"use client";

import type { AppModelId } from "@/lib/types";

const MODEL_OPTIONS: Array<{ id: AppModelId; label: string }> = [
  { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { id: "openai/gpt-4.1", label: "GPT-4.1" },
  { id: "anthropic/claude-3.7-sonnet", label: "Claude 3.7 Sonnet" },
];

export function ModelSelector({
  value,
  onChange,
}: {
  value: AppModelId;
  onChange: (next: AppModelId) => void;
}) {
  return (
    <label className="model-selector">
      <span className="label">Model</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as AppModelId)}
      >
        {MODEL_OPTIONS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>
    </label>
  );
}
