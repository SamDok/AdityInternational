import Link from "next/link";
import { ArrowLeftIcon } from "./Icons";

type Props = {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, backHref, action }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Go back"
            className="-ml-2 rounded-full p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeftIcon />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="truncate text-sm text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
