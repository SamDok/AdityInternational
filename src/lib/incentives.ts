import { prisma } from "./prisma";
import { roundMoney } from "./format";

// Export incentives an Indian textile exporter can claim.
export type IncentiveType = "DRAWBACK" | "RODTEP" | "ITC_REFUND";
export const INCENTIVE_LABEL: Record<IncentiveType, string> = {
  DRAWBACK: "Duty Drawback",
  RODTEP: "RoDTEP",
  ITC_REFUND: "GST input refund",
};

// Placeholder rates seeded for a new HSN — a starting point the owner MUST verify
// against the current CBIC drawback / DGFT RoDTEP schedule (rows stay unverified
// until they confirm). Not authoritative.
export const PREFILL_DRAWBACK_PCT = 1.5;
export const PREFILL_RODTEP_PCT = 1.0;

export type HsnRate = { drawbackPct: number | null; drawbackCap: number | null; rodtepPct: number | null; verified: boolean };

export async function getHsnRates(): Promise<Map<string, HsnRate>> {
  const rows = await prisma.hsnIncentiveRate.findMany();
  const m = new Map<string, HsnRate>();
  for (const r of rows) m.set(r.hsnCode, { drawbackPct: r.drawbackPct, drawbackCap: r.drawbackCap, rodtepPct: r.rodtepPct, verified: r.verified });
  return m;
}

// Drawback + RoDTEP due on one export shipment, in INR. Both are a % of the FOB
// goods value per HSN; the FOB is converted to INR with the shipment's locked
// rate. Domestic (INR) shipments earn nothing. `convertible` is false when a
// foreign shipment has no FX rate yet (so the INR value can't be computed).
export function shipmentIncentive(
  lines: { amount: number; hsnCode: string | null }[],
  currency: string,
  fxRate: number | null,
  rates: Map<string, HsnRate>,
): { drawbackInr: number; rodtepInr: number; convertible: boolean } {
  if (currency === "INR") return { drawbackInr: 0, rodtepInr: 0, convertible: true };
  const toInr = fxRate && fxRate > 0 ? fxRate : null;
  let db = 0;
  let rd = 0;
  for (const l of lines) {
    const r = l.hsnCode ? rates.get(l.hsnCode) : undefined;
    if (!r) continue;
    const inr = toInr ? l.amount * toInr : 0;
    db += inr * ((r.drawbackPct ?? 0) / 100);
    rd += inr * ((r.rodtepPct ?? 0) / 100);
  }
  return { drawbackInr: roundMoney(db), rodtepInr: roundMoney(rd), convertible: !!toInr };
}

// Input GST paid on received material purchases — the base for an ITC refund on
// zero-rated (LUT) exports.
export function inputGstPaid(items: { qtyReceived: number; rate: number | null; gstRate: number | null }[]): number {
  return roundMoney(items.reduce((s, i) => s + i.qtyReceived * (i.rate ?? 0) * ((i.gstRate ?? 0) / 100), 0));
}
