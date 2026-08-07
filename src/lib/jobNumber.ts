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

// Material purchase order document number, e.g. MPO/25-26/001 (its own series).
export function materialPoDocNo(po: { number: number; seq?: number | null; fyLabel?: string | null }): string {
  if (po.seq == null || !po.fyLabel) return `#${po.number}`;
  return `MPO/${po.fyLabel}/${String(po.seq).padStart(3, "0")}`;
}

// Shipment document numbers share one financial-year series; the same seq is
// shown as BG/25-26/001 on the sales (commercial) invoice and PL/25-26/001 on
// the packing list.
export function shipmentDocNo(
  s: { number: number; seq?: number | null; fyLabel?: string | null },
  prefix: "BG" | "PL" = "BG",
): string {
  if (s.seq == null || !s.fyLabel) return `#${s.number}`;
  return `${prefix}/${s.fyLabel}/${String(s.seq).padStart(3, "0")}`;
}

// Order document number: AI/25-26/001 for production, AI/S/25-26/001 for samples
// (each its own per-financial-year series). Falls back to a plain # for legacy
// orders that predate the scheme.
export function orderDocNo(o: { isSample?: boolean | null; number: number; seq?: number | null; fyLabel?: string | null; sampleNo?: number | null }): string {
  if (o.seq == null || !o.fyLabel) return o.isSample ? `Sample #${o.sampleNo ?? o.number}` : `#${o.number}`;
  const prefix = o.isSample ? "AI/S" : "AI";
  return `${prefix}/${o.fyLabel}/${String(o.seq).padStart(3, "0")}`;
}
