import { redirect } from "next/navigation";
import { getCurrentUser, hasNoUsers } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? Go straight to the app.
  if (await getCurrentUser()) redirect("/");

  const firstRun = await hasNoUsers();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 text-3xl font-bold text-white">
          A
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Aditya International</h1>
        <p className="mt-1 text-sm text-gray-500">
          {firstRun ? "Create your owner account to get started." : "Sign in to your ERP."}
        </p>
      </div>

      <LoginForm firstRun={firstRun} />

      {firstRun && (
        <p className="mt-6 text-center text-xs text-gray-400">
          This first account is the owner. You can add teammates later from Settings.
        </p>
      )}
    </div>
  );
}
