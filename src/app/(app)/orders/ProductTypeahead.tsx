"use client";

import { useEffect, useRef, useState } from "react";
import { searchProducts, type ProductHit } from "./actions";

// Server-searched product picker: the order form never ships the whole catalogue.
// Shows the current selection's label; typing (debounced) queries the server.
export default function ProductTypeahead({
  value,
  label,
  onPick,
}: {
  value: string;
  label: string;
  onPick: (hit: ProductHit) => void;
}) {
  const [query, setQuery] = useState(label);
  const [results, setResults] = useState<ProductHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Keep the visible text in step when the value/label is set from outside
  // (edit prefill, or the visual design gallery).
  const lastLabel = useRef(label);
  useEffect(() => {
    if (label !== lastLabel.current) { lastLabel.current = label; setQuery(label); }
  }, [label]);

  // Debounced server search while the dropdown is open.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchProducts(query)
        .then((r) => { if (live) setResults(r); })
        .catch(() => { if (live) setResults([]); })
        .finally(() => { if (live) setLoading(false); });
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [query, open]);

  const groups = new Map<string, ProductHit[]>();
  for (const r of results) { if (!groups.has(r.group)) groups.set(r.group, []); groups.get(r.group)!.push(r); }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Type a design code, colour or width…"
        className="field-input"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {loading && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">{query.trim() ? "No matches" : "Type to search"}</p>
          ) : (
            [...groups.entries()].map(([group, opts]) => (
              <div key={group}>
                <p className="bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-400">{group}</p>
                {opts.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onMouseDown={() => { onPick(o); setQuery(o.label); setOpen(false); }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${o.id === value ? "font-semibold text-brand-600" : "text-gray-800"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
