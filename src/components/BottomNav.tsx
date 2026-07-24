"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HomeIcon, CartIcon, ClipboardIcon, MoreIcon, PlusIcon, UsersIcon, BoxIcon } from "./Icons";

// The two operational hubs (Orders, Jobs) flank a center "+" that creates the
// common things from anywhere. Customers/Products live on Home + under More.
const tabs = [
  { href: "/", label: "Home", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/orders", label: "Orders", icon: CartIcon, match: (p: string) => p.startsWith("/orders") },
  null, // center action
  { href: "/jobs", label: "Production", icon: ClipboardIcon, match: (p: string) => p.startsWith("/jobs") || p.startsWith("/schedule") || p.startsWith("/procurement") },
  {
    href: "/more",
    label: "More",
    icon: MoreIcon,
    match: (p: string) =>
      p.startsWith("/more") || p.startsWith("/vendors") || p.startsWith("/settings") ||
      p.startsWith("/customers") || p.startsWith("/products"),
  },
];

const quickActions = [
  { href: "/orders/new", label: "New order", icon: CartIcon },
  { href: "/jobs/new", label: "New job / purchase order", icon: ClipboardIcon },
  { href: "/customers/new", label: "New customer", icon: UsersIcon },
  { href: "/products/design/new", label: "New design", icon: BoxIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl p-3 pb-24" onClick={(e) => e.stopPropagation()}>
            <div className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-200">
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <Link key={a.href} href={a.href} onClick={() => setOpen(false)} className="flex items-center gap-3 border-b border-gray-50 px-4 py-3.5 last:border-0 active:bg-gray-50">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span>
                    <span className="font-semibold text-gray-900">{a.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-2xl items-stretch justify-around">
          {tabs.map((tab) => {
            if (!tab) {
              return (
                <button key="add" type="button" onClick={() => setOpen((o) => !o)} aria-label="Quick actions" className="flex flex-1 items-center justify-center">
                  <span className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-4 ring-white transition-transform ${open ? "rotate-45" : ""}`}>
                    <PlusIcon className="h-7 w-7" />
                  </span>
                </button>
              );
            }
            const active = tab.match(pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setOpen(false)}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition ${active ? "text-brand-600" : "text-gray-400"}`}
              >
                <Icon className={`h-6 w-6 ${active ? "scale-105" : ""} transition`} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
