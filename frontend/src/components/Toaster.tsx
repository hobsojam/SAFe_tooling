import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

type Variant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: Variant;
}

type ToastFn = (message: string, variant?: Variant) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

const STYLES: Record<Variant, string> = {
  success: "bg-green-50 border-green-200 text-green-800",
  error: "bg-red-50 border-red-200 text-red-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  // Persistent live region refs — pre-rendered empty, text injected on demand.
  // Direct DOM mutation (not React state) because React bails out of re-renders
  // when state value is unchanged, which would silence the screen reader on
  // duplicate messages. requestAnimationFrame ensures the clear lands first.
  const statusRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, isAlert: boolean) => {
    const el = isAlert ? alertRef.current : statusRef.current;
    if (!el) return;
    el.textContent = "";
    requestAnimationFrame(() => {
      el.textContent = message;
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastFn>(
    (message, variant = "success") => {
      const id = ++counterRef.current;
      announce(message, variant === "error");
      setToasts((ts) => [...ts, { id, message, variant }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [announce, dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Live regions — always in the DOM, never receive focus.
          Screen readers detect text injection as a DOM mutation and announce it. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        ref={statusRef}
      />
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        ref={alertRef}
      />

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 w-80">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${STYLES[t.variant]}`}
            >
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label={`Dismiss: ${t.message}`}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity leading-none"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
