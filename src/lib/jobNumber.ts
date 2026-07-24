// Job / purchase-order document numbering.
//
// Numbers are per document type (job work vs purchase) and reset each Indian
// financial year (1 April – 31 March), shown as JW/25-26/001 or PO/25-26/001.
// The raw `number` column stays a global counter for internal ordering; these
// helpers derive the human-facing document number from the stored seq + fyLabel.

// Two-digit financial-year tag for a date, e.g. a date in June 2025 → "25-26",
// a date in February 2026 → "25-26", April 2026 → "26-27". Uses UTC to match how
// date-only values are stored and formatted across the app.
export function financialYearLabel(d: Date): string {
  const y = d.getUTCFullYear();
  const startYear = d.getUTCMonth() >= 3 ? y : y - 1; // FY starts in April (month index 3)
  const yy = (n: number) => String(((n % 100) + 100) % 100).padStart(2, "0");
  return `${yy(startYear)}-${yy(startYear + 1)}`;
}

// Human-facing document number. Falls back to #<number> for legacy jobs that
// predate the scheme (seq / fyLabel not set).
export function jobDocNo(job: { kind: string; number: number; seq?: number | null; fyLabel?: string | null }): string {
  if (job.seq == null || !job.fyLabel) return `#${job.number}`;
  const prefix = job.kind === "PURCHASE" ? "PO" : "JW";
  return `${prefix}/${job.fyLabel}/${String(job.seq).padStart(3, "0")}`;
}
