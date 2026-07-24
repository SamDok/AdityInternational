import Link from "next/link";

// Prev/Next pager. `params` are the current query params to preserve (minus page).
export default function Pager({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params?: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const build = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex items-center justify-between px-4 py-4 text-sm">
      {page > 1 ? (
        <Link href={build(page - 1)} className="btn-secondary !px-4 !py-2">← Prev</Link>
      ) : <span className="opacity-0">←</span>}
      <span className="text-gray-500">Page {page} of {pages}</span>
      {page < pages ? (
        <Link href={build(page + 1)} className="btn-secondary !px-4 !py-2">Next →</Link>
      ) : <span className="opacity-0">→</span>}
    </div>
  );
}
