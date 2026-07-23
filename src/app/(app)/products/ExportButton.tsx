"use client";

import { useTransition } from "react";
import { exportProductsCsv } from "./actions";

export default function ExportButton() {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const csv = await exportProductsCsv();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "catalogue.csv";
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
