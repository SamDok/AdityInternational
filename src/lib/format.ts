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
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"] as const;

export const UNITS = ["mtr", "pcs", "kg", "roll", "box", "set"] as const;

export const ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "IN_PRODUCTION",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  IN_PRODUCTION: "In production",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  IN_PRODUCTION: "bg-amber-100 text-amber-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};
