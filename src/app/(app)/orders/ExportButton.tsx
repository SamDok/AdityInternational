"use client";

import { useTransition } from "react";
import { exportOrdersCsv } from "./actions";

export default function ExportButton() {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const csv = await exportOrdersCsv();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "orders.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <button type="button" onClick={onClick} disabled={isPending} className="btn-secondary !px-3 !py-2 text-sm">
      {isPending ? "…" : "Export"}
    </button>
  );
}
