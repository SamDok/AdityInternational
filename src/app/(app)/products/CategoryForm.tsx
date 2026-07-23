"use client";

import { useRef, useState, useTransition } from "react";

type Values = { name?: string | null; hsnCode?: string | null; sortOrder?: number | null };

type Props = {
  initial?: Values;
  action: (formData: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  submitLabel: string;
  resetOnSuccess?: boolean;
};

export default function CategoryForm({ initial, action, submitLabel, resetOnSuccess }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await action(formData);
      if (res?.error) setError(res.error);
      else if (resetOnSuccess) formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-3">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>}
      <div>
        <label className="field-label" htmlFor="name">Type name *</label>
        <input id="name" name="name" required defaultValue={initial?.name ?? ""}
          className="field-input" placeholder="e.g. Silk Dupion" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="hsnCode">Default HSN</label>
          <input id="hsnCode" name="hsnCode" defaultValue={initial?.hsnCode ?? ""}
            className="field-input" placeholder="Optional" />
        </div>
        <div>
          <label className="field-label" htmlFor="sortOrder">Order</label>
          <input id="sortOrder" name="sortOrder" type="number" defaultValue={initial?.sortOrder ?? 0}
            className="field-input" />
        </div>
      </div>
      <button type="submit" disabled={isPending} className="btn-primary w-full">
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
