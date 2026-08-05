"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { formatMoney, formatDate } from "@/lib/format";
import { TrashIcon } from "@/components/Icons";

export type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  date: string | Date;
  method?: string | null;
  reference?: string | null;
  note?: string | null;
  against?: string | null; // invoice / job label, if tied
};

export default function PaymentList({ payments, onDelete }: { payments: PaymentRow[]; onDelete: (id: string) => Promise<void> }) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  function del(id: string) {
    if (!window.confirm("Delete this payment?")) return;
    startTransition(async () => {
      await onDelete(id);
      toast("Payment deleted");
      router.refresh();
    });
  }

  if (payments.length === 0) return <p className="card text-sm text-gray-500">No payments recorded yet.</p>;

  return (
    <ul className="divide-y divide-gray-100 rounded-2xl bg-white ring-1 ring-gray-100">
      {payments.map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">{formatMoney(p.amount, p.currency)}</p>
            <p className="truncate text-xs text-gray-500">
              {formatDate(p.date)}
              {p.method ? ` · ${p.method}` : ""}
              {p.reference ? ` · ${p.reference}` : ""}
              {p.against ? ` · ${p.against}` : ""}
              {p.note ? ` · ${p.note}` : ""}
            </p>
          </div>
          <button type="button" onClick={() => del(p.id)} disabled={isPending} className="shrink-0 rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600" aria-label="Delete payment">
            <TrashIcon className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
