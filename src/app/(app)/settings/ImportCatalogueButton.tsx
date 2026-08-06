"use client";

import { useState, useTransition } from "react";
import { prepareCatalogueImport, importCatalogueChunk, finalizeCatalogueImport } from "./actions";
import { useToast } from "@/components/Toast";
import type { ImportSummary } from "@/lib/catalogueImport";

const CHUNK = 200;

export default function ImportCatalogueButton() {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const toast = useToast();

  function run() {
    setConfirming(false);
    setSummary(null);
    setProgress(0);
    setTotal(0);
    startTransition(async () => {
      try {
        const prep = await prepareCatalogueImport();
        if (prep.error || prep.total == null) { toast(prep.error ?? "Could not start", { kind: "error" }); return; }
        setTotal(prep.total);
        for (let off = 0; off < prep.total; off += CHUNK) {
          const res = await importCatalogueChunk(off, CHUNK);
          if (res.error) { toast(res.error, { kind: "error" }); return; }
          setProgress(Math.min(off + CHUNK, prep.total));
        }
        const fin = await finalizeCatalogueImport();
        if (fin.error || !fin.summary) { toast(fin.error ?? "Could not finish", { kind: "error" }); return; }
        setSummary(fin.summary);
        toast(`Imported ${fin.summary.designs} designs`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Import failed", { kind: "error" });
      }
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

  if (isPending) {
    const pct = total ? Math.round((progress / total) * 100) : 0;
    return (
      <div className="card space-y-2">
        <p className="text-sm font-semibold text-gray-900">Importing catalogue…</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500">{total ? `${progress} / ${total} designs` : "Starting…"}</p>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="card space-y-3">
        <p className="text-sm text-gray-700">
          This loads the full master design library (~2,570 designs) and its makers into your live app.
          It&apos;s safe to run again later — existing designs are updated, not duplicated.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={run} className="btn-primary flex-1">Yes, import now</button>
          <button type="button" onClick={() => setConfirming(false)} className="btn-secondary flex-1">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)} className="btn-secondary w-full">
      Import full design catalogue
    </button>
  );
}
