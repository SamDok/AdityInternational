"use client";

import { useState, useTransition } from "react";
import { TrashIcon } from "./Icons";

type Props = {
  action: () => Promise<{ error?: string } | void>;
  label: string;
  confirmMessage: string;
};

export default function DeleteButton({ action, label, confirmMessage }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
      )}
      <button type="button" onClick={onClick} disabled={isPending} className="btn-danger w-full">
        <TrashIcon className="h-5 w-5" />
        {isPending ? "Deleting…" : label}
      </button>
    </div>
  );
}
