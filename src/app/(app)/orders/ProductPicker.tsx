"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Opt = { id: string; label: string; group: string };

export default function ProductPicker({
  options,
  value,
  onChange,
}: {
  options: Opt[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState(() => options.find((o) => o.id === value)?.label ?? "");
  const [open, setOpen] = useState(false);

  // Keep the visible text in step when the value is set from OUTSIDE (e.g. the
  // visual design gallery), which the internal dropdown selection doesn't cover.
  const lastValue = useRef(value);
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      setQuery(options.find((o) => o.id === value)?.label ?? "");
    }
  }, [value, options]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || o.group.toLowerCase().includes(q))
      : options;
    const map = new Map<string, Opt[]>();
    for (const o of filtered) {
      if (!map.has(o.group)) map.set(o.group, []);
      map.get(o.group)!.push(o);
    }
    return [...map.entries()];
  }, [query, options]);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Type to find a product…"
        className="field-input"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {groups.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">No matches</p>
          ) : (
            groups.map(([group, opts]) => (
              <div key={group}>
                <p className="bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-400">{group}</p>
                {opts.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onMouseDown={() => { onChange(o.id); setQuery(o.label); setOpen(false); }}
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
