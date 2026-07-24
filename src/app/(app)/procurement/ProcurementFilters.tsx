"use client";

import { usePathname, useRouter } from "next/navigation";

type Props = {
  vendor: string;
  customer: string;
  overdue: boolean;
  vendors: { id: string; name: string }[];
  customers: { id: string; name: string }[];
};

export default function ProcurementFilters(props: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(overrides: Partial<Record<string, string>>) {
    const next = {
      vendor: props.vendor,
      customer: props.customer,
      overdue: props.overdue ? "1" : "",
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const selectClass =
    "rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-800 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-brand-500 focus:outline-none";

  return (
    <div className="flex flex-wrap gap-2">
      <select value={props.vendor} onChange={(e) => apply({ vendor: e.target.value })} className={selectClass}>
        <option value="">All vendors</option>
        {props.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <select value={props.customer} onChange={(e) => apply({ customer: e.target.value })} className={selectClass}>
        <option value="">All customers</option>
        {props.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 ring-1 ring-inset ring-gray-200">
        <input type="checkbox" checked={props.overdue} onChange={(e) => apply({ overdue: e.target.checked ? "1" : "" })} className="h-4 w-4 rounded" />
        Overdue only
      </label>
    </div>
  );
}
