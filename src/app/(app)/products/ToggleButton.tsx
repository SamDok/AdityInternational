"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

type Act = () => Promise<{ error?: string } | void>;

export default function ToggleButton({
  action,
  label,
  toastMessage,
  undoAction,
}: {
  action: Act;
  label: string;
  toastMessage?: string;
  // When given, the success toast offers an "Undo" that runs this reverse action.
  undoAction?: Act;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function run(act: Act, message: string | undefined, withUndo: boolean) {
    startTransition(async () => {
      const r = await act();
      router.refresh();
      if (r?.error) { setError(r.error); toast(r.error, { kind: "error" }); return; }
      if (message) {
        toast(message, withUndo && undoAction
          ? { action: { label: "Undo", onClick: () => run(undoAction, undefined, false) } }
          : undefined);
      }
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{error}</p>}
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(action, toastMessage, true)}
        className="btn-secondary w-full"
      >
        {isPending ? "Saving…" : label}
      </button>
    </div>
  );
}
