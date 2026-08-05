// Receivables (from customers) and payables (to vendors).
//
// Nothing is stored as a running balance — it's all derived so it can never drift:
//   customer outstanding = Σ invoice grand totals − Σ receipts   (per currency)
//   vendor  outstanding  = Σ received-goods value − Σ payments    (per currency)
// A customer may bill in more than one currency, so every figure is kept per
// currency and never summed across them.

import { computeTax } from "./tax";
import { roundMoney } from "./format";

export type CompanyForTax = { gstin: string | null; defaultGstRate: number | null };

type ShipmentForTotal = {
  currency: string;
  status: string;
  billToTaxId: string | null;
  items: { quantity: number; rate: number; product: { design: { gstRate: number | null } | null } }[];
};

// The full invoice value (incl. GST) of one shipment — the same number the
// commercial invoice prints as its grand total.
export function shipmentGrandTotal(s: ShipmentForTotal, company: CompanyForTax): number {
  return computeTax({
    currency: s.currency,
    sellerGstin: company.gstin,
    buyerGstin: s.billToTaxId,
    lines: s.items.map((i) => ({
      amount: i.quantity * i.rate,
      gstRate: i.product.design?.gstRate ?? company.defaultGstRate ?? 0,
    })),
  }).grandTotal;
}

// What a vendor is owed for one job = value of goods actually received (you pay
// for what was delivered, not what was ordered).
export function jobReceivedValue(job: { items: { qtyReceived: number; rate: number | null }[] }): number {
  return roundMoney(job.items.reduce((s, i) => s + i.qtyReceived * (i.rate ?? 0), 0));
}

export function sumByCurrency(rows: { amount: number; currency: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.currency, roundMoney((m.get(r.currency) ?? 0) + r.amount));
  return m;
}

export type Balance = { currency: string; billed: number; paid: number; outstanding: number };

// Combine billed-by-currency and paid-by-currency into per-currency balances.
export function balances(billed: Map<string, number>, paid: Map<string, number>): Balance[] {
  const currencies = new Set([...billed.keys(), ...paid.keys()]);
  return [...currencies]
    .map((currency) => {
      const b = roundMoney(billed.get(currency) ?? 0);
      const p = roundMoney(paid.get(currency) ?? 0);
      return { currency, billed: b, paid: p, outstanding: roundMoney(b - p) };
    })
    .filter((x) => x.billed !== 0 || x.paid !== 0)
    .sort((a, b) => b.outstanding - a.outstanding);
}

// Spread a currency's total receipts across its invoices oldest-first, so each
// invoice reads as paid / part-paid / unpaid without storing an allocation.
export function allocateFIFO(
  invoices: { id: string; total: number }[],
  paidTotal: number,
): Map<string, number> {
  let left = paidTotal;
  const out = new Map<string, number>();
  for (const inv of invoices) {
    const applied = Math.max(0, Math.min(inv.total, roundMoney(left)));
    out.set(inv.id, applied);
    left = roundMoney(left - applied);
  }
  return out;
}

export type PaidState = "PAID" | "PART" | "UNPAID";

export function paidState(total: number, paid: number): PaidState {
  if (paid >= total - 0.01) return "PAID";
  if (paid > 0.01) return "PART";
  return "UNPAID";
}

export const PAID_LABEL: Record<PaidState, string> = { PAID: "Paid", PART: "Part-paid", UNPAID: "Unpaid" };
export const PAID_COLOR: Record<PaidState, string> = {
  PAID: "bg-green-100 text-green-700",
  PART: "bg-amber-100 text-amber-700",
  UNPAID: "bg-gray-100 text-gray-600",
};

export const PAYMENT_METHODS = ["Bank", "Cash", "Cheque", "LC", "Other"] as const;
