import { useEffect } from "react";

/**
 * Modal — diálogo superpuesto
 * Cierra con Escape y click en backdrop.
 */
export function Modal({ open, onClose, title, children, className = "" }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={`relative z-10 w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-[var(--bg-panel)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)] ${className}`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          {title && (
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              {title}
            </h3>
          )}
          <button
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-muted)] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}