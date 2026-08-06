"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importCustomers } from "../actions";

// Canonical fields we accept, and friendly header aliases mapping to them.
const FIELD_ALIASES: Record<string, string> = {
  "name": "name", "customer": "name", "customer name": "name", "company": "name", "company name": "name",
  "contact": "contactPerson", "contact person": "contactPerson", "contactperson": "contactPerson",
  "email": "email", "e-mail": "email",
  "phone": "phone", "mobile": "phone", "telephone": "phone",
  "alt phone": "altPhone", "altphone": "altPhone", "whatsapp": "altPhone", "alternate phone": "altPhone",
  "address": "address", "billing address": "address",
  "country": "country",
  "shipping address": "shippingAddress", "shippingaddress": "shippingAddress", "consignee": "shippingAddress", "consignee address": "shippingAddress",
  "destination port": "destinationPort", "destinationport": "destinationPort", "port": "destinationPort",
  "incoterms": "incoterms",
  "gst": "gstin", "gstin": "gstin", "gst number": "gstin",
  "tax id": "taxId", "vat": "taxId", "tax id / vat": "taxId", "taxid": "taxId",
  "currency": "currency",
  "payment terms": "paymentTerms", "terms": "paymentTerms", "paymentterms": "paymentTerms",
  "credit limit": "creditLimit", "creditlimit": "creditLimit",
  "default discount": "defaultDiscount", "defaultdiscount": "defaultDiscount", "discount": "defaultDiscount", "discount %": "defaultDiscount",
  "category": "category", "type": "category",
  "tags": "tags", "labels": "tags",
};

const TEMPLATE_HEADERS = [
  "name", "contactPerson", "email", "phone", "altPhone", "country", "address",
  "currency", "paymentTerms", "category", "gstin", "taxId", "creditLimit",
  "defaultDiscount", "destinationPort", "incoterms", "shippingAddress", "tags",
];

// Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, commas, CRLF).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

type ParsedRow = Record<string, string>;

export default function ImportClient() {
  const router = useRouter();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; warnings: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  function downloadTemplate() {
    const csv = TEMPLATE_HEADERS.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const grid = parseCsv(String(reader.result ?? ""));
      if (grid.length < 2) {
        setError("That file has no data rows.");
        setRows([]);
        return;
      }
      const headers = grid[0].map((h) => FIELD_ALIASES[h.trim().toLowerCase()] ?? "");
      if (!headers.includes("name")) {
        setError('Could not find a "name" column. Use the template so the columns match.');
        setRows([]);
        return;
      }
      const parsed: ParsedRow[] = grid.slice(1).map((r) => {
        const obj: ParsedRow = {};
        headers.forEach((field, idx) => {
          if (field) obj[field] = (r[idx] ?? "").trim();
        });
        return obj;
      });
      setRows(parsed.filter((r) => (r.name ?? "").trim() !== ""));
    };
    reader.readAsText(file);
  }

  function doImport() {
    setError(null);
    startTransition(async () => {
      const res = await importCustomers(rows);
      setResult(res);
    });
  }

  return (
    <div className="space-y-5 p-4">
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900">1. Get the template</h2>
        <p className="text-sm text-gray-500">
          Download the template, fill one customer per row in Excel or Google Sheets, then save as CSV.
          Only <b>name</b> is required — leave anything else blank.
        </p>
        <button type="button" onClick={downloadTemplate} className="btn-secondary w-full">
          Download template (CSV)
        </button>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-900">2. Upload your file</h2>
        <label className="btn-secondary w-full cursor-pointer">
          {fileName || "Choose CSV file"}
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        </label>
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>
        )}
        {rows.length > 0 && !result && (
          <p className="text-sm text-gray-600">
            Found <b>{rows.length}</b> customer{rows.length > 1 ? "s" : ""} to import.
          </p>
        )}
      </div>

      {rows.length > 0 && !result && (
        <button type="button" onClick={doImport} disabled={isPending} className="btn-primary w-full">
          {isPending ? "Importing…" : `Import ${rows.length} customer${rows.length > 1 ? "s" : ""}`}
        </button>
      )}

      {result && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900">Done</h2>
          <p className="text-sm text-gray-700">
            Imported <b className="text-green-700">{result.imported}</b>
            {result.skipped > 0 && <> · skipped <b className="text-amber-700">{result.skipped}</b> (duplicates or blank names)</>}
          </p>
          {result.warnings.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-gray-500">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <button type="button" onClick={() => router.push("/customers")} className="btn-primary w-full">
            View customers
          </button>
        </div>
      )}
    </div>
  );
}
