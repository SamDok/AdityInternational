import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <p className="text-5xl font-bold text-brand-500">404</p>
      <h1 className="mt-3 text-lg font-semibold text-gray-900">Page not found</h1>
      <p className="mt-1 text-sm text-gray-500">The page you’re looking for doesn’t exist.</p>
      <Link href="/" className="btn-primary mt-6">Go home</Link>
    </div>
  );
}
