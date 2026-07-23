"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateProcurement } from "./actions";

export default function GenerateProcurement({ orderId, label }: { orderId: string; label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await generateProcurement(orderId);
      if (res?.error) setError(res.error);
      else router.refresh();
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
