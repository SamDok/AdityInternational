"use client";

import { useActionState, useState, useTransition } from "react";
import { addTeammate, changePassword, removeTeammate, logout } from "./actions";
import { TrashIcon } from "@/components/Icons";

type State = { error?: string; ok?: string } | undefined;

type Teammate = { id: string; name: string | null; email: string; role: string };

export default function SettingsClient({
  me,
  teammates,
  isOwner,
}: {
  me: { id: string; name: string | null; email: string; role: string };
  teammates: Teammate[];
  isOwner: boolean;
}) {
  return (
    <div className="space-y-6 p-4">
      {/* Account */}
      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-gray-500">Signed in as</h2>
        <p className="text-lg font-semibold text-gray-900">{me.name || me.email}</p>
        <p className="text-sm text-gray-500">{me.email}</p>
        <span className="mt-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          {me.role === "owner" ? "Owner" : "Member"}
        </span>
        <form action={logout} className="mt-4">
          <button type="submit" className="btn-secondary w-full">Sign out</button>
        </form>
      </section>

      {/* Change password */}
      <ChangePasswordCard />

      {/* Teammates (owner only) */}
      {isOwner && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-gray-500">
            Team ({teammates.length})
          </h2>
          <ul className="mb-3 space-y-2">
            {teammates.map((t) => (
              <li key={t.id} className="card flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-600">
                  {(t.name || t.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{t.name || t.email}</p>
                  <p className="truncate text-sm text-gray-500">
                    {t.email}
                    {t.role === "owner" ? " · Owner" : ""}
                  </p>
                </div>
                {t.id !== me.id && t.role !== "owner" && <RemoveButton id={t.id} name={t.name || t.email} />}
              </li>
            ))}
          </ul>
          <AddTeammateCard />
        </section>
      )}
    </div>
  );
}

function RemoveButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Remove ${name}`}
      disabled={isPending}
      onClick={() => {
        if (window.confirm(`Remove ${name}? They will no longer be able to sign in.`)) {
          startTransition(() => {
            void removeTeammate(id);
          });
        }
      }}
      className="rounded-lg p-2 text-red-500 hover:bg-red-50"
    >
      <TrashIcon className="h-5 w-5" />
    </button>
  );
}

function AddTeammateCard() {
  const [state, formAction, pending] = useActionState<State, FormData>(addTeammate, undefined);
  return (
    <div className="card">
      <h3 className="mb-3 font-semibold text-gray-900">Add a teammate</h3>
      {state?.error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{state.error}</p>}
      {state?.ok && <p className="mb-3 rounded-xl bg-green-50 px-4 py-2 text-sm font-medium text-green-700">{state.ok}</p>}
      <form action={formAction} className="space-y-3" key={state?.ok /* reset fields after success */}>
        <input name="name" className="field-input" placeholder="Name (optional)" autoComplete="off" />
        <input name="email" type="email" required className="field-input" placeholder="Email" autoComplete="off" />
        <input name="password" type="text" required className="field-input" placeholder="Temporary password (8+ characters)" autoComplete="off" />
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Adding…" : "Add teammate"}
        </button>
      </form>
      <p className="mt-2 text-xs text-gray-400">
        You set a starting password and share it with them. They can change it after signing in.
      </p>
    </div>
  );
}

function ChangePasswordCard() {
  const [state, formAction, pending] = useActionState<State, FormData>(changePassword, undefined);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary w-full">
        Change my password
      </button>
    );
  }

  return (
    <section className="card">
      <h3 className="mb-3 font-semibold text-gray-900">Change my password</h3>
      {state?.error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{state.error}</p>}
      {state?.ok && <p className="mb-3 rounded-xl bg-green-50 px-4 py-2 text-sm font-medium text-green-700">{state.ok}</p>}
      <form action={formAction} className="space-y-3">
        <input name="current" type="password" required className="field-input" placeholder="Current password" autoComplete="current-password" />
        <input name="next" type="password" required className="field-input" placeholder="New password (8+ characters)" autoComplete="new-password" />
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary flex-1">
            {pending ? "Saving…" : "Update"}
          </button>
        </div>
      </form>
    </section>
  );
}
