import { prisma } from "./prisma";

// INR per 1 unit of a currency. INR is always 1; foreign rates come from FxRate.
export type FxRates = Map<string, number>;

export async function getFxRates(): Promise<FxRates> {
  const rows = await prisma.fxRate.findMany();
  const m = new Map<string, number>([["INR", 1]]);
  for (const r of rows) if (r.perUnitInr > 0) m.set(r.currency, r.perUnitInr);
  return m;
}

// Convert an amount between currencies using the reference rates. Returns null
// when a needed rate is missing (so callers can fall back gracefully).
export function convert(amount: number, from: string, to: string, rates: FxRates): number | null {
  if (from === to) return amount;
  const fr = rates.get(from);
  const tr = rates.get(to);
  if (fr == null || tr == null) return null;
  return (amount * fr) / tr;
}
