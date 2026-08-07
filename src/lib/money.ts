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
  discountPct?: number | null;
  freight?: number | null;
  insurance?: number | null;
  otherCharges?: number | null;
  items: { quantity: number; rate: number; product: { design: { gstRate: number | null } | null } }[];
};

// The full invoice value (incl. discount, GST and charges) of one shipment — the
// same number the commercial invoice prints as its grand total.
export function shipmentGrandTotal(s: ShipmentForTotal, company: CompanyForTax): number {
  return computeTax({
    currency: s.currency,
    sellerGstin: company.gstin,
    buyerGstin: s.billToTaxId,
    discountPct: s.discountPct,
    charges: (s.freight ?? 0) + (s.insurance ?? 0) + (s.otherCharges ?? 0),
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

// Aging: split an outstanding balance by how long it has been due. Buckets are
// 0–30 / 31–60 / 61–90 / 90+ days from the bill date.
export type Aging = { d0_30: number; d31_60: number; d61_90: number; d90plus: number; total: number };

export const AGING_BUCKETS: { key: keyof Aging; label: string }[] = [
  { key: "d0_30", label: "0–30 days" },
  { key: "d31_60", label: "31–60 days" },
  { key: "d61_90", label: "61–90 days" },
  { key: "d90plus", label: "90+ days" },
];

// Age one party's unpaid balance, per currency. Payments are applied oldest-first
// (FIFO) before ageing, so a partly-paid old bill ages only its remainder. Call
// this per customer / per vendor — never pool bills across parties, since one
// party's receipts can't settle another's invoices.
export function agingByCurrency(
  bills: { date: Date; total: number; currency: string }[],
  paidByCurrency: Map<string, number>,
  asOf: Date = new Date(),
): Map<string, Aging> {
  const out = new Map<string, Aging>();
  const currencies = new Set([...bills.map((b) => b.currency), ...paidByCurrency.keys()]);
  for (const cur of currencies) {
    const curBills = bills.filter((b) => b.currency === cur).sort((a, b) => +a.date - +b.date);
    const alloc = allocateFIFO(curBills.map((b, i) => ({ id: String(i), total: b.total })), paidByCurrency.get(cur) ?? 0);
    const a: Aging = { d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
    curBills.forEach((b, i) => {
      const unpaid = roundMoney(b.total - (alloc.get(String(i)) ?? 0));
      if (unpaid <= 0.01) return;
      const days = Math.floor((+asOf - +b.date) / 86400000);
      if (days <= 30) a.d0_30 += unpaid;
      else if (days <= 60) a.d31_60 += unpaid;
      else if (days <= 90) a.d61_90 += unpaid;
      else a.d90plus += unpaid;
      a.total += unpaid;
    });
    if (a.total > 0.01) {
      out.set(cur, { d0_30: roundMoney(a.d0_30), d31_60: roundMoney(a.d31_60), d61_90: roundMoney(a.d61_90), d90plus: roundMoney(a.d90plus), total: roundMoney(a.total) });
    }
  }
  return out;
}

// Fold one party's aging into a running per-currency total (for the dashboard).
export function addAging(into: Map<string, Aging>, add: Map<string, Aging>) {
  for (const [cur, a] of add) {
    const cur0 = into.get(cur) ?? { d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
    into.set(cur, {
      d0_30: roundMoney(cur0.d0_30 + a.d0_30), d31_60: roundMoney(cur0.d31_60 + a.d31_60),
      d61_90: roundMoney(cur0.d61_90 + a.d61_90), d90plus: roundMoney(cur0.d90plus + a.d90plus),
      total: roundMoney(cur0.total + a.total),
    });
  }
}

// Realized FX gain/loss (in INR): when a foreign invoice booked at one rate is
// paid at another, the rupee difference on the settled amount is real P&L. We
// match receipts to invoices oldest-first (FIFO), within each currency, and sum
// settledAmount × (receiptRate − invoiceRate). A positive number is a gain
// (received more INR than the invoice was booked at). INR-only and rows without
// both rates contribute nothing.
export function realizedFxGain(
  invoices: { total: number; currency: string; rate: number | null; date: Date }[],
  receipts: { amount: number; currency: string; rate: number | null; date: Date }[],
): number {
  let gain = 0;
  const currencies = new Set(invoices.filter((i) => i.currency !== "INR").map((i) => i.currency));
  for (const cur of currencies) {
    const inv = invoices.filter((i) => i.currency === cur).sort((a, b) => +a.date - +b.date).map((i) => ({ left: i.total, rate: i.rate }));
    const pay = receipts.filter((p) => p.currency === cur).sort((a, b) => +a.date - +b.date);
    let ii = 0;
    for (const p of pay) {
      let amt = p.amount;
      while (amt > 0.01 && ii < inv.length) {
        const cur0 = inv[ii];
        if (cur0.left <= 0.01) { ii++; continue; }
        const chunk = Math.min(amt, cur0.left);
        if (p.rate != null && cur0.rate != null) gain += chunk * (p.rate - cur0.rate);
        cur0.left = roundMoney(cur0.left - chunk);
        amt = roundMoney(amt - chunk);
      }
    }
  }
  return roundMoney(gain);
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
