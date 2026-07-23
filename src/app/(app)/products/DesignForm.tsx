"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Values = {
  categoryId?: string | null;
  code?: string | null;
  name?: string | null;
  composition?: string | null;
  hsnCode?: string | null;
  description?: string | null;
};

type Category = { id: string; name: string };

type Props = {
  categories: Category[];
  initial?: Values;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  submitLabel: string;
};

export default function DesignForm({ categories, initial, action, submitLabel }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await action(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-5 p-4">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div>
        <label className="field-label" htmlFor="categoryId">Product type *</label>
        <select id="categoryId" name="categoryId" defaultValue={initial?.categoryId ?? ""} className="field-input" required>
          <option value="">Choose a type…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="field-label" htmlFor="code">Design code *</label>
        <input id="code" name="code" required defaultValue={initial?.code ?? ""}
          className="field-input" placeholder="Your design number, e.g. SD-101" autoFocus />
      </div>

      <div>
        <label className="field-label" htmlFor="name">Design name</label>
        <input id="name" name="name" defaultValue={initial?.name ?? ""}
          className="field-input" placeholder="Optional descriptive name" />
      </div>

      <div>
        <label className="field-label" htmlFor="composition">Composition</label>
        <input id="composition" name="composition" defaultValue={initial?.composition ?? ""}
          className="field-input" placeholder="e.g. 100% Silk" />
      </div>

      <div>
        <label className="field-label" htmlFor="hsnCode">HSN code</label>
        <input id="hsnCode" name="hsnCode" defaultValue={initial?.hsnCode ?? ""}
          className="field-input" placeholder="Defaults from the type if left blank" />
      </div>

      <div>
        <label className="field-label" htmlFor="description">Notes</label>
        <textarea id="description" name="description" defaultValue={initial?.description ?? ""}
          className="field-input" rows={2} placeholder="Anything else about this design" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary flex-1">
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
