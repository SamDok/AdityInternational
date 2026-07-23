"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon } from "@/components/Icons";

type Props = {
  q: string;
  type: string;
  composition: string;
  stock: string;
  sort: string;
  types: { id: string; name: string }[];
  compositions: string[];
};

export default function CatalogueFilters(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(props.q);
  const first = useRef(true);

  function apply(overrides: Partial<Record<string, string>>) {
    const params = new URLSearchParams();
    const next = {
      q,
      type: props.type,
      composition: props.composition,
      stock: props.stock === "all" ? "" : props.stock,
      sort: props.sort === "code" ? "" : props.sort,
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => apply({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const sel = "rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-800 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none";

  return (
    <div className="space-y-3 px-4 pt-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search design code, name, composition…"
          className="w-full rounded-xl border-0 bg-gray-50 py-3 pl-10 pr-4 text-base text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={props.type} onChange={(e) => apply({ type: e.target.value })} className={sel}>
          <option value="">All types</option>
          {props.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={props.composition} onChange={(e) => apply({ composition: e.target.value })} className={sel}>
          <option value="">All compositions</option>
          {props.compositions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={props.stock} onChange={(e) => apply({ stock: e.target.value })} className={sel}>
          <option value="all">Any stock</option>
          <option value="in">In stock</option>
          <option value="out">Out of stock</option>
        </select>
        <select value={props.sort} onChange={(e) => apply({ sort: e.target.value })} className={sel}>
          <option value="code">Sort: Code</option>
          <option value="recent">Sort: Recently added</option>
          <option value="stock">Sort: Most stock</option>
        </select>
      </div>
    </div>
  );
}
