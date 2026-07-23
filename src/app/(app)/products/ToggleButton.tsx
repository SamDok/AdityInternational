"use client";

import { useState, useTransition } from "react";

export default function ToggleButton({
  action,
  label,
}: {
  action: () => Promise<{ error?: string } | void>;
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>}
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(async () => { const r = await action(); if (r?.error) setError(r.error); })}
        className="btn-secondary w-full"
      >
        {isPending ? "Saving…" : label}
      </button>
    </div>
  );
}
