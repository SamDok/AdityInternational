"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCustomerArchived } from "./actions";
import { useToast } from "@/components/Toast";

export default function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function setArchived(next: boolean, withUndo: boolean) {
    startTransition(async () => {
      await setCustomerArchived(id, next);
      router.refresh();
      toast(next ? "Customer archived" : "Customer restored", withUndo && next
        ? { action: { label: "Undo", onClick: () => setArchived(false, false) } }
        : undefined);
    });
  }

  return (
    <button type="button" onClick={() => setArchived(!archived, true)} disabled={isPending} className="btn-secondary w-full">
      {isPending ? "Saving…" : archived ? "Unarchive customer" : "Archive customer"}
    </button>
  );
}
