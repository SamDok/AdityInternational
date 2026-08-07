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

// Strip everything but letters/digits for tolerant reference/narration matching.
export function normalizeRef(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type ClaimForMatch = { id: string; type: string; amount: number; reference: string | null };

// Suggest which incentive claim a bank credit belongs to. Strongest signal is the
// claim's reference (shipping bill / ARN / scrip) appearing in the narration;
// otherwise a type keyword ("DRAWBACK"/"RODTEP"/"REFUND") plus a close amount.
export function suggestClaim(
  credit: { amount: number; narration: string | null },
  claims: ClaimForMatch[],
): { claimId: string; confidence: "high" | "medium" | "low" } | null {
  if (claims.length === 0) return null;
  const narr = normalizeRef(credit.narration ?? "");
  for (const c of claims) {
    if (c.reference && c.reference.trim()) {
      const ref = normalizeRef(c.reference);
      if (ref.length >= 4 && narr.includes(ref)) return { claimId: c.id, confidence: "high" };
    }
  }
  const hint = narr.includes("DRAWBACK") || narr.includes("DBK") ? "DRAWBACK"
    : narr.includes("RODTEP") ? "RODTEP"
    : (narr.includes("REFUND") || narr.includes("RFD")) ? "ITC_REFUND" : null;
  const near = claims.filter((c) => Math.abs(c.amount - credit.amount) <= Math.max(1, c.amount * 0.05));
  const byType = hint ? near.filter((c) => c.type === hint) : near;
  if (byType.length === 1) return { claimId: byType[0].id, confidence: hint ? "high" : "medium" };
  if (byType.length > 1) return { claimId: byType[0].id, confidence: "low" };
  return null;
}
