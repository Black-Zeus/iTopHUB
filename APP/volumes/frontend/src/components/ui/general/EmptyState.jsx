/**
 * EmptyState — placeholder cuando no hay datos
 */
export function EmptyState({ message = "Sin datos disponibles", action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
}