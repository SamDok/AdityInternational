"use client";

import { useRef, useState, useTransition } from "react";
import { setCustomerPrice, removeCustomerPrice } from "./actions";
import { formatMoney } from "@/lib/format";
import { TrashIcon } from "@/components/Icons";
import ProductTypeahead from "../orders/ProductTypeahead";

type Price = { id: string; productId: string; label: string; price: number; currency: string };

export default function PriceListClient({
  customerId,
  currency,
  hasProducts,
  prices,
}: {
  customerId: string;
  currency: string;
  hasProducts: boolean;
  prices: Price[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [selectedCost, setSelectedCost] = useState<number | null>(null);
  const [priceText, setPriceText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const setPrice = setCustomerPrice.bind(null, customerId);

  const priceNum = parseFloat(priceText);
  const margin =
    selectedCost != null && !isNaN(priceNum) && priceNum > 0
      ? Math.round(((priceNum - selectedCost) / priceNum) * 100)
      : null;

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await setPrice(formData);
      if (res?.error) setError(res.error);
      else {
        formRef.current?.reset();
        setSelectedId(""); setSelectedLabel(""); setSelectedCost(null);
        setPriceText("");
      }
    });
  }

  return (
    <div className="space-y-6 p-4">
      <section className="card">
        <h2 className="mb-3 font-semibold text-gray-900">Set a price</h2>
        {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>}
        {!hasProducts ? (
          <p className="text-sm text-gray-500">Add some product designs and widths first.</p>
        ) : (
          <form ref={formRef} action={onSubmit} className="space-y-3">
            <div>
              <label className="field-label">Product (design · width · colour)</label>
              <input type="hidden" name="productId" value={selectedId} required />
              <ProductTypeahead
                value={selectedId}
                label={selectedLabel}
                onPick={(hit) => { setSelectedId(hit.id); setSelectedLabel(hit.label); setSelectedCost(hit.costPrice); }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="price">Price ({currency})</label>
                <input id="price" name="price" type="number" step="0.01" min="0" required inputMode="decimal"
                  value={priceText} onChange={(e) => setPriceText(e.target.value)}
                  className="field-input" placeholder="0.00" />
              </div>
              <input type="hidden" name="currency" value={currency} />
              <div className="flex items-end">
                <button type="submit" disabled={isPending} className="btn-primary w-full">
                  {isPending ? "Saving…" : "Save price"}
                </button>
              </div>
            </div>
            {selectedCost != null && (
              <p className="text-xs text-gray-500">
                Cost {formatMoney(selectedCost, currency)}
                {margin != null ? ` · margin ${margin}%` : ""}
              </p>
            )}
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
