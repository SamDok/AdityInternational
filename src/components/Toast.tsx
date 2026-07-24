"use client";

import { createContext, useContext, useCallback, useState, type ReactNode } from "react";

type ToastKind = "success" | "error";
type ToastAction = { label: string; onClick: () => void };
type ToastItem = { id: number; message: string; kind: ToastKind; action?: ToastAction };

type ToastFn = (message: string, opts?: { kind?: ToastKind; action?: ToastAction }) => void;

const ToastCtx = createContext<ToastFn | null>(null);

// Safe no-op if used outside the provider (e.g. in isolation).
export function useToast(): ToastFn {
  return useContext(ToastCtx) ?? (() => {});
}

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback<ToastFn>((message, opts = {}) => {
    const id = ++counter;
    setToasts((t) => [...t, { id, message, kind: opts.kind ?? "success", action: opts.action }]);
    // Linger longer when there's an action to click.
    setTimeout(() => remove(id), opts.action ? 6000 : 3200);
  }, [remove]);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
          >
            <span className={t.kind === "error" ? "text-red-400" : "text-green-400"}>
              {t.kind === "error" ? "✕" : "✓"}
            </span>
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => { t.action!.onClick(); remove(t.id); }}
                className="shrink-0 font-semibold text-brand-300 hover:text-brand-200"
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss" onClick={() => remove(t.id)} className="shrink-0 text-gray-400 hover:text-white">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
