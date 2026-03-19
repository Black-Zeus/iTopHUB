/**
 * Panel — contenedor de sección con borde y sombra
 */
export function Panel({ children, className = "", wide = false }) {
  return (
    <section
      className={`rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-panel)] p-6 shadow-[var(--shadow-subtle)] ${wide ? "col-span-2" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({ title, eyebrow, actions, className = "" }) {
  return (
    <div className={`mb-5 flex items-start justify-between gap-4 ${className}`}>
      <div>
        {eyebrow && (
          <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {eyebrow}
          </p>
        )}
        {title && (
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}