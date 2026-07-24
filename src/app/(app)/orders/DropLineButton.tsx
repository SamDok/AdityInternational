"use client";

import { useState, useTransition } from "react";
import { dropOrderLine } from "./actions";
import { useToast } from "@/components/Toast";

// "Can't make this design" — remove one line from the order (and stop its
// un-received job work). Two-step to avoid an accidental delete.
export default function DropLineButton({ itemId, hasJob }: { itemId: string; hasJob: boolean }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function drop() {
    startTransition(async () => {
      const res = await dropOrderLine(itemId);
      setOpen(false);
      if (res?.error) toast(res.error, { kind: "error" });
      else toast(hasJob ? "Design dropped — its job work stopped" : "Design dropped from order");
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-red-500 hover:text-red-600">
        Can’t make this
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs text-gray-500">Drop this design?</span>
      <button type="button" disabled={isPending} onClick={drop} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
        {isPending ? "…" : "Drop"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-400">keep</button>
    </span>
  );
}
