"use client";

import { useState, useTransition } from "react";
import { importDriveImages } from "../products/imageActions";
import { DESIGN_IMAGE_FILE_IDS } from "@/data/designImages";
import { useToast } from "@/components/Toast";

const CHUNK = 24;
const TOTAL = DESIGN_IMAGE_FILE_IDS.length;

export default function ImportImagesButton() {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [failed, setFailed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [sampleErrors, setSampleErrors] = useState<string[]>([]);
  const toast = useToast();

  function run() {
    setConfirming(false);
    setFinished(false);
    setProgress(0); setDone(0); setSkipped(0); setFailed(0); setSampleErrors([]);
    startTransition(async () => {
      let d = 0, s = 0, f = 0;
      const samples: string[] = [];
      for (let i = 0; i < TOTAL; i += CHUNK) {
        const batch = DESIGN_IMAGE_FILE_IDS.slice(i, i + CHUNK);
        try {
          const res = await importDriveImages(batch);
          d += res.done; s += res.skipped; f += res.errors.length;
          for (const e of res.errors) if (samples.length < 5) samples.push(e);
        } catch (e) {
          f += batch.length;
          if (samples.length < 5) samples.push(e instanceof Error ? e.message : "batch failed");
        }
        setProgress(Math.min(i + CHUNK, TOTAL));
        setDone(d); setSkipped(s); setFailed(f); setSampleErrors([...samples]);
      }
      setFinished(true);
      toast(`Images loaded: ${d} new, ${s} already had one${f ? `, ${f} failed` : ""}`);
    });
  }

  if (isPending) {
    const pct = Math.round((progress / TOTAL) * 100);
    return (
      <div className="card space-y-2">
        <p className="text-sm font-semibold text-gray-900">Loading images from Google Drive…</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500">{progress} / {TOTAL} · {done} loaded · {skipped} skipped{failed ? ` · ${failed} failed` : ""}</p>
        <p className="text-xs text-gray-400">Keep this tab open — this takes a few minutes.</p>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="card space-y-2">
        <p className="text-sm font-semibold text-green-700">Images loaded ✓</p>
        <p className="text-sm text-gray-700">
          <b className="text-green-700">{done}</b> new · <b>{skipped}</b> already had one{failed > 0 && <> · <b className="text-amber-700">{failed}</b> couldn&apos;t be fetched</>}
        </p>
        {failed > 0 && sampleErrors.length > 0 && (
          <div className="rounded-lg bg-gray-50 p-2">
            <p className="mb-1 text-xs font-medium text-gray-600">Why they failed (sample):</p>
            <ul className="space-y-0.5 text-xs text-gray-500">
              {sampleErrors.map((e, i) => <li key={i} className="break-words">{e}</li>)}
            </ul>
          </div>
        )}
        {failed > 0 && <p className="text-xs text-gray-500">Run it again to retry the ones that failed — designs that already have a photo are skipped.</p>}
        <div className="flex gap-2">
          <a href="/products/all" className="btn-primary flex-1 text-center">View catalogue</a>
          {failed > 0 && <button type="button" onClick={run} className="btn-secondary flex-1">Retry failed</button>}
        </div>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="card space-y-3">
        <p className="text-sm text-gray-700">
          This pulls up to <b>{TOTAL}</b> design photos from your Google Drive into the app&apos;s image store.
          It runs in this tab for a few minutes. Safe to run again — designs that already have a photo are skipped.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={run} className="btn-primary flex-1">Yes, load images</button>
          <button type="button" onClick={() => setConfirming(false)} className="btn-secondary flex-1">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)} className="btn-secondary w-full">
      Load design images from Drive
    </button>
  );
}
