import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

let _id = 0;

/**
 * ToastProvider — envuelve la app para habilitar toasts globales.
 * Usar useToast() para disparar notificaciones desde cualquier componente.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback(({ message, tone = "default", duration = 3500 }) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const tones = {
    default: "bg-[var(--bg-panel)] border-[var(--border-color)] text-[var(--text-primary)]",
    success: "bg-[rgba(127,191,156,0.14)] border-[var(--success)] text-[var(--success)]",
    warning: "bg-[rgba(224,181,107,0.14)] border-[var(--warning)] text-[var(--warning)]",
    danger:  "bg-[rgba(210,138,138,0.14)] border-[var(--danger)] text-[var(--danger)]",
    info:    "bg-[var(--accent-soft)] border-[var(--accent-strong)] text-[var(--accent-strong)]",
  };

  return (
    <ToastContext.Provider value={{ add }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 rounded-[var(--radius-sm)] border px-4 py-3 text-sm font-medium shadow-[var(--shadow-soft)] backdrop-blur-sm animate-fade-in ${tones[t.tone]}`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="opacity-60 hover:opacity-100 transition"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}