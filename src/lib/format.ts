// Small formatting helpers shared across the app.

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback if the currency code is unknown to Intl.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// Clean a quantity/weight of binary floating-point noise numerically
// (11.600000000000001 → 11.6). Use at the source of any subtraction/sum.
export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// Round money to 2 decimals so a printed total equals the sum of the line
// amounts shown against it (each line is displayed to 2 decimals). Sum the
// per-line roundMoney values rather than the raw products.
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

// Same, but as a display string (drops trailing zeros): 11.600000000000001 → "11.6".
export function formatQty(n: number): string {
  if (n == null || isNaN(n)) return "0";
  return String(roundQty(n));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Dates are entered as calendar dates (YYYY-MM-DD → UTC midnight); format in UTC
  // so a due date shows the same day for every viewer, regardless of timezone.
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"] as const;

export const UNITS = ["mtr", "pcs", "kg", "roll", "box", "set"] as const;

// The order's commercial STAGE — set by hand. Shipping progress is separate and
// derived from what's actually been shipped (see fulfillmentOf below).
export const ORDER_STAGES = ["DRAFT", "CONFIRMED", "CANCELLED"] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

export const STAGE_LABELS: Record<OrderStage, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

export const STAGE_COLORS: Record<OrderStage, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-700",
};

// Derived shipping status from the order's line items.
export type Fulfillment = "NONE" | "PARTIAL" | "FULL";

// Per-line: FULL only when every line is fully shipped, so over-shipping one
// design can never mask another that's still short.
export function fulfillmentOf(items: { quantity: number; shippedQty: number }[]): Fulfillment {
  if (items.length === 0) return "NONE";
  const anyShipped = items.some((i) => i.shippedQty > 1e-9);
  if (!anyShipped) return "NONE";
  const allFull = items.every((i) => i.shippedQty >= i.quantity - 1e-9);
  return allFull ? "FULL" : "PARTIAL";
}

export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  NONE: "Not shipped",
  PARTIAL: "Partly shipped",
  FULL: "Shipped",
};

export const FULFILLMENT_COLORS: Record<Fulfillment, string> = {
  NONE: "bg-gray-100 text-gray-600",
  PARTIAL: "bg-amber-100 text-amber-700",
  FULL: "bg-green-100 text-green-700",
};

// Display label for an order's document number: AI/25-26/001 for production,
// AI/S/25-26/001 for samples (each a per-financial-year series). Falls back to a
// plain #/Sample # for legacy orders that predate the seq + fyLabel scheme.
export function orderNo(o: { isSample?: boolean | null; sampleNo?: number | null; number: number; seq?: number | null; fyLabel?: string | null }): string {
  if (o.seq == null || !o.fyLabel) return o.isSample ? `Sample #${o.sampleNo ?? o.number}` : `Order #${o.number}`;
  return `${o.isSample ? "AI/S" : "AI"}/${o.fyLabel}/${String(o.seq).padStart(3, "0")}`;
}

type OrderLike = { manualComplete: boolean; items: { quantity: number; shippedQty: number }[] };

// An order is complete when every line is fully shipped, or it's been closed by
// hand (all pieces sent, but measured metres came up a little short).
export function orderComplete(o: OrderLike): boolean {
  return o.manualComplete || fulfillmentOf(o.items) === "FULL";
}

// The badge for an order's shipping/completion state. A hand-closed order that
// isn't fully shipped by metres reads "Complete" rather than "Shipped".
export function orderBadge(o: OrderLike): { label: string; className: string } {
  const f = fulfillmentOf(o.items);
  if (o.manualComplete && f !== "FULL") return { label: "Complete", className: FULFILLMENT_COLORS.FULL };
  return { label: FULFILLMENT_LABELS[f], className: FULFILLMENT_COLORS[f] };
}
