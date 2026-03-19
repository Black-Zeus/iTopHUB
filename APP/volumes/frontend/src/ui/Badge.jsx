/**
 * Badge — etiqueta de estado o categoría
 * tone: default | info | success | warning | danger
 */
export function Badge({ children, tone = "default", className = "" }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border";

  const tones = {
    default:
      "bg-[var(--bg-panel-muted)] border-[var(--border-color)] text-[var(--text-secondary)]",
    info: "bg-[var(--accent-soft)] border-transparent text-[var(--accent-strong)]",
    success:
      "bg-[rgba(127,191,156,0.14)] border-transparent text-[var(--success)]",
    warning:
      "bg-[rgba(224,181,107,0.14)] border-transparent text-[var(--warning)]",
    danger:
      "bg-[rgba(210,138,138,0.14)] border-transparent text-[var(--danger)]",
  };

  return (
    <span className={`${base} ${tones[tone]} ${className}`}>{children}</span>
  );
}