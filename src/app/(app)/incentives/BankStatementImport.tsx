"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { importBankCredits } from "./actions";

// Minimal RFC-4180-ish CSV parser (quotes, escaped quotes, commas, CRLF).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// DD-MM-YYYY / DD/MM/YYYY / DD-MMM-YYYY / DD-MMM-YY → ISO YYYY-MM-DD.
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function parseDate(s: string): string | null {
  const t = s.trim();
  const m = t.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,}|\d{1,2})[-/ ](\d{2,4})/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mo = /^\d+$/.test(m[2]) ? parseInt(m[2], 10) : MONTHS[m[2].slice(0, 3).toLowerCase()];
  let yy = parseInt(m[3], 10);
  if (yy < 100) yy += 2000;
  if (!mo || !dd || !yy) return null;
  return `${yy}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
const numish = (s: string) => { const n = parseFloat(s.replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; };

// Find the header row and map Kotak's varying column names to fields.
function mapColumns(rows: string[][]): { headerIdx: number; col: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const h = rows[i].map((c) => c.trim().toLowerCase());
    const find = (...keys: string[]) => h.findIndex((c) => keys.some((k) => c.includes(k)));
    const date = find("transaction date", "txn date", "date");
    const credit = find("deposit", "credit", "cr amount", "cr ");
    const amount = find("amount");
    if (date >= 0 && (credit >= 0 || amount >= 0)) {
      return {
        headerIdx: i,
        col: {
          date, credit, amount,
          debit: find("withdrawal", "debit", "dr amount"),
          drcr: find("dr / cr", "dr/cr", "type", "cr/dr"),
          narration: find("narration", "description", "remarks", "particular"),
          ref: find("chq", "cheque", "ref no", "reference"),
        },
      };
    }
  }
  return null;
}

export default function BankStatementImport() {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<number | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    const map = mapColumns(rows);
    if (!map) { toast("Couldn't read this file — is it the Kotak statement CSV?", { kind: "error" }); return; }
    const { headerIdx, col } = map;
    const credits: { date: string; amount: number; narration: string | null; reference: string | null }[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const date = col.date >= 0 ? parseDate(r[col.date] ?? "") : null;
      if (!date) continue;
      let amount = col.credit >= 0 ? numish(r[col.credit] ?? "") : 0;
      if (amount <= 0 && col.amount >= 0) {
        const a = numish(r[col.amount] ?? "");
        const drcr = col.drcr >= 0 ? (r[col.drcr] ?? "").trim().toLowerCase() : "";
        const isCredit = drcr.startsWith("c") || (col.debit >= 0 && numish(r[col.debit] ?? "") <= 0 && a > 0);
        if (isCredit) amount = Math.abs(a);
      }
      if (amount <= 0) continue;
      credits.push({ date, amount, narration: col.narration >= 0 ? (r[col.narration] ?? "").trim() || null : null, reference: col.ref >= 0 ? (r[col.ref] ?? "").trim() || null : null });
    }
    e.target.value = "";
    if (credits.length === 0) { toast("No credit lines found in the statement.", { kind: "error" }); return; }
    setPreview(credits.length);
    startTransition(async () => {
      const res = await importBankCredits(credits);
      if ("error" in res) return toast(res.error, { kind: "error" });
      toast(`Imported ${res.added} credit${res.added === 1 ? "" : "s"}${res.skipped ? ` · ${res.skipped} already there` : ""}`);
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <div className="card space-y-2">
      <p className="font-semibold text-gray-900">Import Kotak statement</p>
      <p className="text-xs text-gray-500">Download your account statement from Kotak net-banking as <b>CSV</b> and upload it here. Only credit lines are read; re-uploading an overlapping period is safe.</p>
      <label className="btn-secondary block cursor-pointer text-center">
        {isPending ? `Importing ${preview ?? ""}…` : "Choose statement CSV"}
        <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={isPending} className="hidden" />
      </label>
    </div>
  );
}
