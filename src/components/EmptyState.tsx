import Link from "next/link";
import { PlusIcon } from "./Icons";

type Props = {
  icon: React.ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

export default function EmptyState({ icon, title, message, actionLabel, actionHref }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-gray-500">{message}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-primary mt-6">
          <PlusIcon className="h-5 w-5" />
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
