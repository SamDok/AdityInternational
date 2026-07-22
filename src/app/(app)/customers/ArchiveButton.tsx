"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCustomerArchived } from "./actions";

export default function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    startTransition(async () => {
      await setCustomerArchived(id, !archived);
      router.push(`/customers/${id}`);
    });
  }

  return (
    <button type="button" onClick={toggle} disabled={isPending} className="btn-secondary w-full">
      {isPending ? "Saving…" : archived ? "Unarchive customer" : "Archive customer"}
    </button>
  );
}
