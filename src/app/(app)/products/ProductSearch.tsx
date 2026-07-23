"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon } from "@/components/Icons";

export default function ProductSearch({ q, placeholder }: { q: string; placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(q);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      router.push(value ? `${pathname}?q=${encodeURIComponent(value)}` : pathname);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative px-4 pt-2">
      <SearchIcon className="pointer-events-none absolute left-7 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? "Search design code, name, composition…"}
        className="w-full rounded-xl border-0 bg-gray-50 py-3 pl-10 pr-4 text-base text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
      />
    </div>
  );
}
