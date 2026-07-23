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

export function fulfillmentOf(items: { quantity: number; shippedQty: number }[]): Fulfillment {
  if (items.length === 0) return "NONE";
  const ordered = items.reduce((s, i) => s + i.quantity, 0);
  const shipped = items.reduce((s, i) => s + i.shippedQty, 0);
  if (shipped <= 0) return "NONE";
  if (shipped >= ordered) return "FULL";
  return "PARTIAL";
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
