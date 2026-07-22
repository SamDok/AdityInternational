"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon } from "@/components/Icons";

type Props = {
  q: string;
  country: string;
  category: string;
  salesperson: string;
  sort: string;
  showArchived: boolean;
  countries: string[];
  categories: string[];
  salespeople: { id: string; label: string }[];
};

const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "recent", label: "Recently added" },
  { value: "orders", label: "Most orders" },
  { value: "lastorder", label: "Last order" },
];

export default function CustomerFilters(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(props.q);
  const firstRender = useRef(true);

  // Build the URL from the current filter values and navigate.
  function apply(overrides: Partial<Record<string, string>>) {
    const params = new URLSearchParams();
    const next = {
      q,
      country: props.country,
      category: props.category,
      salesperson: props.salesperson,
      sort: props.sort === "name" ? "" : props.sort,
      archived: props.showArchived ? "1" : "",
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  // Debounce the free-text search so we don't navigate on every keystroke.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => apply({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const selectClass =
    "rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-800 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none";

  return (
    <div className="space-y-3 px-4 pt-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, code, contact…"
          className="w-full rounded-xl border-0 bg-gray-50 py-3 pl-10 pr-4 text-base text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={props.country} onChange={(e) => apply({ country: e.target.value })} className={selectClass}>
          <option value="">All countries</option>
          {props.countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={props.category} onChange={(e) => apply({ category: e.target.value })} className={selectClass}>
          <option value="">All categories</option>
          {props.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={props.salesperson} onChange={(e) => apply({ salesperson: e.target.value })} className={selectClass}>
          <option value="">All salespeople</option>
          {props.salespeople.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={props.sort} onChange={(e) => apply({ sort: e.target.value === "name" ? "" : e.target.value })} className={selectClass}>
          {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>Sort: {s.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 ring-1 ring-inset ring-gray-200">
          <input
            type="checkbox"
            checked={props.showArchived}
            onChange={(e) => apply({ archived: e.target.checked ? "1" : "" })}
            className="h-4 w-4 rounded"
          />
          Show archived
        </label>
      </div>
    </div>
  );
}
