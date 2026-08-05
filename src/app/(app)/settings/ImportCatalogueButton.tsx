"use client";

import { useState, useTransition } from "react";
import { importCatalogue } from "./actions";
import { useToast } from "@/components/Toast";
import type { ImportSummary } from "@/lib/catalogueImport";

export default function ImportCatalogueButton() {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const toast = useToast();

  function run() {
    setConfirming(false);
    startTransition(async () => {
      const res = await importCatalogue();
      if (res?.error || !res?.summary) { toast(res?.error ?? "Import failed", { kind: "error" }); return; }
      setSummary(res.summary);
      toast(`Imported ${res.summary.designs} designs`);
    });
  }

  if (summary) {
    return (
      <div className="card space-y-2">
        <p className="text-sm font-semibold text-green-700">Catalogue imported ✓</p>
        <p className="text-sm text-gray-700">
          <b>{summary.designs}</b> designs · <b>{summary.vendors}</b> makers/suppliers · <b>{summary.categories.length}</b> types
          {summary.excluded > 0 && <> · skipped <b>{summary.excluded}</b></>}
        </p>
        <ul className="max-h-44 space-y-0.5 overflow-y-auto text-xs text-gray-500">
          {summary.categories.map((c) => (
            <li key={c.name} className="flex justify-between"><span>{c.name}</span><span className="tabular-nums">{c.count}</span></li>
          ))}
        </ul>
        <a href="/products/all" className="btn-primary block w-full text-center">View catalogue</a>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="card space-y-3">
        <p className="text-sm text-gray-700">
          This loads the full master design library (~2,570 designs) and its makers into your live app.
          It's safe to run again later — existing designs are updated, not duplicated.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={run} disabled={isPending} className="btn-primary flex-1">
            {isPending ? "Importing…" : "Yes, import now"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={isPending} className="btn-secondary flex-1">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)} disabled={isPending} className="btn-secondary w-full">
      {isPending ? "Importing…" : "Import full design catalogue"}
    </button>
  );
}
