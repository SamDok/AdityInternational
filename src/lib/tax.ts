// GST computation for the commercial invoice and proforma.
//
// Exports (any sale not in INR) are treated as zero-rated under LUT — no tax,
// just the standard declaration. Domestic (INR) sales split into CGST + SGST
// when the buyer is in the seller's state, else IGST — determined from the
// 2-digit state code that prefixes each GSTIN. The per-line GST rate comes from
// the design (falling back to a company default), so a bill can mix rates
// (e.g. 5% fabric and 12% made-ups); tax is grouped and totalled by rate.

import { roundMoney } from "./format";

export type TaxMode = "EXPORT" | "INTRA" | "INTER";

export type TaxGroup = { rate: number; taxable: number; cgst: number; sgst: number; igst: number };

export type TaxBreakdown = {
  mode: TaxMode;
  gross: number; // line total before discount
  discountPct: number;
  discount: number; // amount taken off
  taxable: number; // gross − discount
  groups: TaxGroup[];
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  charges: number; // freight + insurance + other, added after tax
  grandTotal: number; // taxable + tax + charges
  note: string | null; // export declaration, when applicable
};

// The first two characters of a GSTIN are its state code.
function stateCode(gstin?: string | null): string | null {
  if (!gstin) return null;
  const s = gstin.trim();
  return /^\d{2}/.test(s) ? s.slice(0, 2) : null;
}

export function computeTax(input: {
  currency: string;
  sellerGstin?: string | null;
  buyerGstin?: string | null;
  discountPct?: number | null;
  charges?: number | null; // freight + insurance + other, added after tax
  lines: { amount: number; gstRate: number }[];
}): TaxBreakdown {
  const gross = roundMoney(input.lines.reduce((s, l) => s + roundMoney(l.amount), 0));
  const discountPct = input.discountPct && input.discountPct > 0 ? input.discountPct : 0;
  const discount = roundMoney((gross * discountPct) / 100);
  const taxable = roundMoney(gross - discount);
  const charges = roundMoney(input.charges ?? 0);
  // Spread the discount across every line so per-rate GST is on the net value.
  const factor = gross > 0 ? taxable / gross : 1;

  // Any non-INR sale is an export — zero-rated under LUT.
  if (input.currency !== "INR") {
    return {
      mode: "EXPORT",
      gross, discountPct, discount, taxable,
      groups: [], cgst: 0, sgst: 0, igst: 0, tax: 0,
      charges,
      grandTotal: roundMoney(taxable + charges),
      note: "Supply meant for export under LUT / bond without payment of IGST.",
    };
  }

  const seller = stateCode(input.sellerGstin);
  const buyer = stateCode(input.buyerGstin);
  // Same state → CGST + SGST; otherwise (including an unknown buyer state) → IGST.
  const intra = seller != null && buyer != null && seller === buyer;

  const byRate = new Map<number, number>();
  for (const l of input.lines) byRate.set(l.gstRate, (byRate.get(l.gstRate) ?? 0) + l.amount * factor);

  const groups: TaxGroup[] = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, amt]) => {
      const t = roundMoney(amt);
      if (intra) {
        const half = roundMoney((t * rate) / 200);
        return { rate, taxable: t, cgst: half, sgst: half, igst: 0 };
      }
      return { rate, taxable: t, cgst: 0, sgst: 0, igst: roundMoney((t * rate) / 100) };
    });

  const cgst = roundMoney(groups.reduce((s, g) => s + g.cgst, 0));
  const sgst = roundMoney(groups.reduce((s, g) => s + g.sgst, 0));
  const igst = roundMoney(groups.reduce((s, g) => s + g.igst, 0));
  const tax = roundMoney(cgst + sgst + igst);

  return {
    mode: intra ? "INTRA" : "INTER",
    gross, discountPct, discount, taxable,
    groups, cgst, sgst, igst, tax,
    charges,
    grandTotal: roundMoney(taxable + tax + charges),
    note: null,
  };
}
