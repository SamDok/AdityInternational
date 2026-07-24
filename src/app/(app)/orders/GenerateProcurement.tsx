"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateProcurement } from "./actions";
import { useToast } from "@/components/Toast";

export default function GenerateProcurement({ orderId, label }: { orderId: string; label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await generateProcurement(orderId);
      if (res?.error) { setError(res.error); toast(res.error, { kind: "error" }); }
      else { router.refresh(); toast(`Created ${res?.count ?? 0} job${res?.count === 1 ? "" : "s"}`); }
    });
  }

  return (
    <div>
      <button type="button" onClick={onClick} disabled={isPending} className="btn-primary w-full">
        {isPending ? "Generating…" : label}
      </button>
      {error && <p className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
