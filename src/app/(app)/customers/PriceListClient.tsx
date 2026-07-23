"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { setCustomerPrice, removeCustomerPrice } from "./actions";
import { formatMoney } from "@/lib/format";
import { TrashIcon } from "@/components/Icons";

type Opt = { id: string; label: string; group: string };
type Price = { id: string; productId: string; label: string; price: number; currency: string };

export default function PriceListClient({
  customerId,
  currency,
  options,
  prices,
}: {
  customerId: string;
  currency: string;
  options: Opt[];
  prices: Price[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const setPrice = setCustomerPrice.bind(null, customerId);

  const groups = useMemo(() => {
    const map = new Map<string, Opt[]>();
    for (const o of options) {
      if (!map.has(o.group)) map.set(o.group, []);
      map.get(o.group)!.push(o);
    }
    return [...map.entries()];
  }, [options]);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await setPrice(formData);
      if (res?.error) setError(res.error);
      else formRef.current?.reset();
    });
  }

  return (
    <div className="space-y-6 p-4">
      <section className="card">
        <h2 className="mb-3 font-semibold text-gray-900">Set a price</h2>
        {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>}
        {options.length === 0 ? (
          <p className="text-sm text-gray-500">Add some product designs and widths first.</p>
        ) : (
          <form ref={formRef} action={onSubmit} className="space-y-3">
            <div>
              <label className="field-label" htmlFor="productId">Product (design · width · colour)</label>
              <select id="productId" name="productId" required className="field-input" defaultValue="">
                <option value="" disabled>Choose a product…</option>
                {groups.map(([group, opts]) => (
                  <optgroup key={group} label={group}>
                    {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="price">Price ({currency})</label>
                <input id="price" name="price" type="number" step="0.01" min="0" required inputMode="decimal"
                  className="field-input" placeholder="0.00" />
              </div>
              <input type="hidden" name="currency" value={currency} />
              <div className="flex items-end">
                <button type="submit" disabled={isPending} className="btn-primary w-full">
                  {isPending ? "Saving…" : "Save price"}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400">Setting a price for a product you already priced updates it.</p>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">Prices ({prices.length})</h2>
        {prices.length === 0 ? (
          <p className="card text-sm text-gray-500">No prices set for this customer yet.</p>
        ) : (
          <ul className="space-y-2">
            {prices.map((p) => (
              <li key={p.id} className="card flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{p.label}</p>
                </div>
                <span className="shrink-0 font-semibold text-gray-900">{formatMoney(p.price, p.currency)}</span>
                <form action={removeCustomerPrice.bind(null, p.id)}>
                  <button type="submit" aria-label="Remove price" className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
