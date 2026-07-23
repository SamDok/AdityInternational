"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, UsersIcon, BoxIcon, CartIcon, MoreIcon } from "./Icons";

const tabs = [
  { href: "/", label: "Home", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/customers", label: "Customers", icon: UsersIcon, match: (p: string) => p.startsWith("/customers") },
  { href: "/products", label: "Products", icon: BoxIcon, match: (p: string) => p.startsWith("/products") },
  { href: "/orders", label: "Orders", icon: CartIcon, match: (p: string) => p.startsWith("/orders") },
  {
    href: "/more",
    label: "More",
    icon: MoreIcon,
    match: (p: string) => p.startsWith("/more") || p.startsWith("/vendors") || p.startsWith("/jobs") || p.startsWith("/settings"),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition ${
                active ? "text-brand-600" : "text-gray-400"
              }`}
            >
              <Icon className={`h-6 w-6 ${active ? "scale-105" : ""} transition`} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
