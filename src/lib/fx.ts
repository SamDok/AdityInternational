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

export const FX_CURRENCIES = ["USD", "EUR", "GBP", "AED"];

// Parse an open.er-api.com "base INR" response into { currency: INR-per-unit }.
// The API's rates are "foreign per 1 INR", so INR per 1 unit = 1 / rate.
export function parseErApi(data: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const d = data as { result?: string; rates?: Record<string, number> };
  if (d?.result !== "success" || !d.rates) return out;
  for (const cur of FX_CURRENCIES) {
    const perInr = d.rates[cur];
    if (typeof perInr === "number" && perInr > 0) out[cur] = 1 / perInr;
  }
  return out;
}

// Pull today's live mid-market rates and store them. Runs on Vercel (which can
// reach the internet) via the daily cron and the "Refresh now" button.
export async function refreshFxRates(): Promise<{ ok?: true; updated?: Record<string, number>; error?: string }> {
  let data: unknown;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/INR", { cache: "no-store" });
    if (!res.ok) return { error: `rate source returned ${res.status}` };
    data = await res.json();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "could not reach the rate source" };
  }
  const rates = parseErApi(data);
  const currencies = Object.keys(rates);
  if (currencies.length === 0) return { error: "no usable rates in the response" };
  const updated: Record<string, number> = {};
  for (const cur of currencies) {
    const perUnitInr = rates[cur];
    await prisma.fxRate.upsert({ where: { currency: cur }, update: { perUnitInr }, create: { currency: cur, perUnitInr } });
    updated[cur] = Math.round(perUnitInr * 100) / 100;
  }
  return { ok: true, updated };
}
