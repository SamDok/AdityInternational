import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Aditya International ERP",
  description: "Run your business — customers, products, and orders — from any device.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Aditya ERP",
  },
};

export const viewport: Viewport = {
  themeColor: "#3563e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen max-w-2xl pb-20">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
