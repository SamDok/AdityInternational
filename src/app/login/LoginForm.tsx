"use client";

import { useActionState } from "react";
import { login, registerFirstOwner } from "./actions";

type State = { error?: string } | undefined;

export default function LoginForm({ firstRun }: { firstRun: boolean }) {
  const action = firstRun ? registerFirstOwner : login;
  const [state, formAction, pending] = useActionState<State, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.error}
        </div>
      )}

      {firstRun && (
        <div>
          <label className="field-label" htmlFor="name">Your name</label>
          <input id="name" name="name" className="field-input" placeholder="e.g. Sam" autoComplete="name" />
        </div>
      )}

      <div>
        <label className="field-label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="field-input"
          placeholder="you@example.com" autoComplete="email" autoFocus />
      </div>

      <div>
        <label className="field-label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required className="field-input"
          placeholder={firstRun ? "Choose a password (8+ characters)" : "Your password"}
          autoComplete={firstRun ? "new-password" : "current-password"} />
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Please wait…" : firstRun ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
