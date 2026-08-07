import { formatMoney, formatDate } from "@/lib/format";
import DocPrintBar from "@/components/DocPrintBar";

export type LedgerRow = { date: Date; label: string; ref?: string | null; debit: number; credit: number };
export type CurrencyLedger = { currency: string; rows: LedgerRow[] };

export type CompanyHeader = {
  legalName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  gstin?: string | null;
  logoData?: string | null;
};

// Build per-currency ledgers (chronological, with running balance) from a flat
// list of debits (bills) and credits (payments). Debit raises the balance the
// party owes; credit (a payment) lowers it.
export function buildLedgers(events: (LedgerRow & { currency: string })[]): CurrencyLedger[] {
  const byCur = new Map<string, LedgerRow[]>();
  for (const e of events) {
    const arr = byCur.get(e.currency) ?? [];
    arr.push(e);
    byCur.set(e.currency, arr);
  }
  return [...byCur.entries()]
    .map(([currency, rows]) => ({
      currency,
      rows: rows.sort((a, b) => +a.date - +b.date || (b.debit - a.debit)),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export default function StatementDoc({
  company,
  title,
  backHref,
  backLabel,
  partyLabel,
  partyName,
  partyAddress,
  partyTaxLabel,
  partyTaxId,
  balanceNoun,
  ledgers,
}: {
  company: CompanyHeader;
  title: string;
  backHref: string;
  backLabel: string;
  partyLabel: string;
  partyName: string;
  partyAddress?: string | null;
  partyTaxLabel?: string;
  partyTaxId?: string | null;
  balanceNoun: string; // e.g. "Due from customer" / "Payable to vendor"
  ledgers: CurrencyLedger[];
}) {
  const today = new Date();
  return (
    <div className="min-h-screen bg-gray-100">
      <DocPrintBar backHref={backHref} backLabel={backLabel} />

      <div className="proforma mx-auto my-6 max-w-[820px] bg-white p-8 text-[13px] leading-relaxed text-gray-900 shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-4">
          <div className="flex items-center gap-4">
            {company.logoData && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoData} alt="" className="h-16 w-16 object-contain" />
            )}
            <div>
              <p className="text-xl font-bold">{company.legalName || "Your Company"}</p>
              {company.address && <p className="whitespace-pre-line text-xs text-gray-600">{company.address}</p>}
              <p className="text-xs text-gray-600">{[company.phone, company.email, company.website].filter(Boolean).join("  ·  ")}</p>
              {company.gstin && <p className="text-xs text-gray-600">GSTIN: {company.gstin}</p>}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wide">{title}</h1>
          <div className="text-right text-xs">
            <p><span className="text-gray-500">As of:</span> {formatDate(today)}</p>
          </div>
        </div>

        <div className="mt-4 rounded border border-gray-200 p-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">{partyLabel}</p>
          <p className="font-semibold">{partyName}</p>
          {partyAddress && <p className="whitespace-pre-line text-xs text-gray-700">{partyAddress}</p>}
          {partyTaxId && <p className="mt-1 text-xs text-gray-700">{partyTaxLabel ?? "Tax ID"}: {partyTaxId}</p>}
        </div>

        {ledgers.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">No transactions on record.</p>
        ) : (
          ledgers.map((lg) => {
            let running = 0;
            return (
              <div key={lg.currency} className="mt-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Currency: {lg.currency}</p>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-y border-gray-300 text-left">
                      <th className="py-1.5 pr-2">Date</th>
                      <th className="py-1.5 pr-2">Particulars</th>
                      <th className="py-1.5 pr-2 text-right">Debit</th>
                      <th className="py-1.5 pr-2 text-right">Credit</th>
                      <th className="py-1.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lg.rows.map((r, i) => {
                      running += r.debit - r.credit;
                      return (
                        <tr key={i} className="border-b border-gray-100 align-top">
                          <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(r.date)}</td>
                          <td className="py-1.5 pr-2">
                            {r.label}
                            {r.ref && <span className="text-gray-500"> · {r.ref}</span>}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{r.debit ? formatMoney(r.debit, lg.currency) : ""}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{r.credit ? formatMoney(r.credit, lg.currency) : ""}</td>
                          <td className="py-1.5 text-right font-medium tabular-nums">{formatMoney(running, lg.currency)}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gray-800 font-bold">
                      <td className="py-2 pr-2" colSpan={4}>{balanceNoun} ({lg.currency})</td>
                      <td className={`py-2 text-right tabular-nums ${running > 0.01 ? "text-red-700" : "text-green-700"}`}>{formatMoney(running, lg.currency)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })
        )}

        <p className="mt-8 text-[11px] text-gray-400">Debit = billed to the account; Credit = payment received/made. Balance is running.</p>
      </div>
    </div>
  );
}
