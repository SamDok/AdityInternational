"use client";

import { useEffect, useMemo, useState } from "react";
import { getDesignGallery, type GalleryDesign } from "./actions";

// A full-screen visual picker: search a grid of design photos, tap one, then pick
// its width/colour. For when a customer sends a picture and you don't know the code.
export default function DesignGallery({ onPick, onClose }: { onPick: (variantId: string) => void; onClose: () => void }) {
  const [designs, setDesigns] = useState<GalleryDesign[] | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getDesignGallery().then((d) => { if (live) setDesigns(d); }).catch(() => { if (live) setDesigns([]); });
    return () => { live = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!designs) return [];
    const q = query.trim().toLowerCase();
    if (!q) return designs;
    return designs.filter((d) => `${d.code} ${d.name ?? ""} ${d.group}`.toLowerCase().includes(q));
  }, [designs, query]);

  function choose(d: GalleryDesign) {
    if (d.variants.length === 1) onPick(d.variants[0].id);
    else setExpanded((e) => (e === d.designId ? null : d.designId));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 p-3">
        <input
          autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search designs by code, name or type…"
          className="min-w-0 flex-1 rounded-xl border-0 bg-gray-50 px-4 py-2.5 text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none" />
        <button type="button" onClick={onClose} className="btn-secondary shrink-0 !px-4 !py-2 text-sm">Close</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {designs === null ? (
          <p className="py-16 text-center text-sm text-gray-400">Loading designs…</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">No designs match “{query}”.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((d) => (
              <div key={d.designId} className="overflow-hidden rounded-xl ring-1 ring-gray-100">
                <button type="button" onClick={() => choose(d)} className="block w-full text-left">
                  {d.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.image} alt={d.code} loading="lazy" className="aspect-square w-full object-cover" />
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
        )}
      </div>
    </div>
  );
}
