// Currencies we keep a dedicated bank account for. INR is a domestic account
// (uses IFSC); the others are foreign-currency accounts (use SWIFT, and often
// IBAN). The proforma prints the account whose currency matches the order.
export const BANK_CURRENCIES = ["USD", "EUR", "GBP", "INR"] as const;
export type BankCurrency = (typeof BANK_CURRENCIES)[number];

// Which code a given currency's account uses, so the form can guide entry.
export function isDomestic(currency: string) {
  return currency === "INR";
}

export const BANK_FIELDS = [
  "bankName", "accountName", "accountNo", "swift", "ifsc", "iban", "branch", "bankAddress",
] as const;
export type BankField = (typeof BANK_FIELDS)[number];
