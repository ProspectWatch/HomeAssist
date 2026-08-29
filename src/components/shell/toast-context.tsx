"use client";

import * as React from "react";

const ToastContext = React.createContext<(msg: string) => void>(() => {});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = React.useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    timer.current = setTimeout(() => setMessage(null), 1700);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {message ? (
        <div
          className="fixed left-1/2 z-[200] max-w-[80%] -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-4 py-2.5 text-center text-[12.5px] text-white shadow-[0_8px_20px_rgba(29,29,27,.3)]"
          style={{ bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          {message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
