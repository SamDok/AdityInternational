"use client";

import { useTransition } from "react";
import { exportAllData } from "./actions";
import { useToast } from "@/components/Toast";

export default function BackupButton() {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function onClick() {
    startTransition(async () => {
      const res = await exportAllData();
      if (res?.error || !res?.data) { toast(res?.error ?? "Export failed", { kind: "error" }); return; }
      const blob = new Blob([res.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aditya-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Backup downloaded");
    });
  }

  return (
    <button type="button" onClick={onClick} disabled={isPending} className="btn-secondary w-full">
      {isPending ? "Preparing…" : "Download a full backup"}
    </button>
  );
}
