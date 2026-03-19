/**
 * Spinner — indicador de carga
 * size: sm | md | lg
 */
export function Spinner({ size = "md", className = "" }) {
  const sizes = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-[3px]",
  };

  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block rounded-full border-[var(--border-strong)] border-t-[var(--accent-strong)] animate-spin ${sizes[size]} ${className}`}
    />
  );
}