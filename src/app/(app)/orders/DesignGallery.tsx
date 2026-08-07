"use client";

import { useEffect, useState } from "react";
import { getDesignGallery, type GalleryDesign } from "./actions";

// A full-screen visual picker: search a grid of design photos, tap one, then pick
// its width/colour. Built to scale to thousands of designs — the list is fetched
// server-side (capped + searchable, no image bytes) and each thumbnail is
// lazy-loaded individually from the design image route, so only what's on screen
// downloads. For when a customer sends a picture and you don't know the code.
export default function DesignGallery({ onPick, onClose, customerId, customerName }: { onPick: (variantId: string) => void; onClose: () => void; customerId?: string; customerName?: string }) {
  const [designs, setDesigns] = useState<GalleryDesign[] | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  // Default to this customer's own designs when we have a customer to scope to.
  const [customerOnly, setCustomerOnly] = useState(!!customerId);

  // Debounced server-side search so the payload/DOM stay bounded for big catalogues.
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      getDesignGallery(query, customerId, customerOnly)
        .then((r) => { if (live) { setDesigns(r.designs); setTotal(r.total); } })
        .catch(() => { if (live) { setDesigns([]); setTotal(0); } });
    }, query ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [query, customerId, customerOnly]);

  function choose(d: GalleryDesign) {
    if (d.variants.length === 1) onPick(d.variants[0].id);
    else setExpanded((e) => (e === d.designId ? null : d.designId));
  }

  const shown = designs?.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="space-y-2 border-b border-gray-100 p-3">
        <div className="flex items-center gap-2">
          <input
            autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={customerOnly ? "Search this customer's designs…" : "Search designs by code or name…"}
            className="min-w-0 flex-1 rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          <button type="button" onClick={onClose} className="btn-secondary shrink-0 !px-4 !py-2 text-sm">Close</button>
        </div>
        {customerId && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setCustomerOnly(true)}
              className={`rounded-lg px-3 py-1 text-xs font-medium ring-1 ring-inset ${customerOnly ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-gray-50 text-gray-600 ring-gray-200"}`}>
              {customerName ? `${customerName}'s designs` : "This customer's designs"}
            </button>
            <button type="button" onClick={() => setCustomerOnly(false)}
              className={`rounded-lg px-3 py-1 text-xs font-medium ring-1 ring-inset ${!customerOnly ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-gray-50 text-gray-600 ring-gray-200"}`}>
              All designs
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {designs === null ? (
          <p className="py-16 text-center text-sm text-gray-400">Loading designs…</p>
        ) : shown === 0 ? (
          customerOnly && !query ? (
            <p className="py-16 text-center text-sm text-gray-400">
              This customer hasn&apos;t ordered before.{" "}
              <button type="button" onClick={() => setCustomerOnly(false)} className="font-semibold text-brand-600 underline">Show all designs</button>
            </p>
          ) : (
            <p className="py-16 text-center text-sm text-gray-400">
              No designs match “{query}”{customerOnly ? " for this customer" : ""}.
              {customerOnly && <> <button type="button" onClick={() => setCustomerOnly(false)} className="font-semibold text-brand-600 underline">Search all designs</button></>}
            </p>
          )
        ) : (
          <>
            {total > shown && (
              <p className="mb-2 px-1 text-xs text-gray-400">Showing {shown} of {total} — refine your search to narrow it down.</p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {designs.map((d) => (
                <div key={d.designId} className="overflow-hidden rounded-xl ring-1 ring-gray-100">
                  <button type="button" onClick={() => choose(d)} className="block w-full text-left">
                    {d.hasImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/designs/${d.designId}/image`} alt={d.code} loading="lazy" className="aspect-square w-full bg-gray-50 object-contain" />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-gray-50 text-xs text-gray-300">No image</div>
                    )}
                    <div className="p-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{d.code}</p>
                      {d.name && <p className="truncate text-xs text-gray-500">{d.name}</p>}
                      <p className="truncate text-[11px] text-gray-400">{d.group} · {d.variants.length} width{d.variants.length === 1 ? "" : "s"}</p>
                    </div>
                  </button>
                  {expanded === d.designId && d.variants.length > 1 && (
                    <div className="flex flex-wrap gap-1 border-t border-gray-100 p-2">
                      {d.variants.map((v) => (
                        <button key={v.id} type="button" onClick={() => onPick(v.id)}
                          className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100">
                          {v.label.replace(`${d.code} · `, "") || v.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
