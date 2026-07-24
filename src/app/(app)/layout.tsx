import { requireUser } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import { ToastProvider } from "@/components/Toast";

// Every page inside this group requires a signed-in user.
// requireUser() redirects to /login when there is no valid session.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireUser();

  return (
    <ToastProvider>
      <div className="mx-auto min-h-screen max-w-2xl pb-20">{children}</div>
      <BottomNav />
    </ToastProvider>
  );
}
