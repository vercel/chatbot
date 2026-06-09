import { EyeOffIcon, KeyRoundIcon, ShieldIcon } from "lucide-react";

export default function SecretsPage() {
  return (
    <div className="flex flex-col h-full w-full overflow-x-hidden bg-zinc-950">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <KeyRoundIcon className="size-5 text-amber-400" />
        <h1 className="text-lg font-semibold text-zinc-100">Secrets</h1>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
          Keys Only
        </span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <ShieldIcon className="size-12 text-zinc-700 mb-4" />
        <h2 className="text-lg font-medium text-zinc-300 mb-2">
          Secrets Vault
        </h2>
        <p className="text-sm text-zinc-500 max-w-md">
          Manage API keys, tokens, and environment secrets. Keys are masked —
          values are never displayed in the UI.
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs text-zinc-600">
          <EyeOffIcon className="size-3" />
          <span>All values encrypted at rest</span>
        </div>
      </div>
    </div>
  );
}
