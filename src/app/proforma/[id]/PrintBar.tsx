"use client";

import { useRouter } from "next/navigation";

export default function PrintBar({ backHref }: { backHref: string }) {
  const router = useRouter();
  return (
    <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
      <button onClick={() => router.push(backHref)} className="text-sm font-medium text-gray-600 hover:text-gray-900">
        ← Back to order
      </button>
      <button onClick={() => window.print()} className="btn-primary !px-5 !py-2 text-sm">
        Print / Save as PDF
      </button>
    </div>
  );
}
