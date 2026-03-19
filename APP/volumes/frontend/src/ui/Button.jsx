/**
 * Button — primitivo UI
 * variants: primary | secondary
 * size: sm | md (default)
 */
export function Button({
  children,
  variant = "secondary",
  size = "md",
  disabled = false,
  type = "button",
  className = "",
  onClick,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 border disabled:opacity-55 disabled:cursor-not-allowed hover:-translate-y-px";

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-3 text-sm",
  };

  const variants = {
    primary:
      "bg-[var(--accent-strong)] border-[var(--accent-strong)] text-white shadow-[0_10px_22px_rgba(81,152,194,0.18)] hover:shadow-[0_14px_24px_rgba(81,152,194,0.26)]",
    secondary:
      "bg-[var(--bg-panel)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
    ghost:
      "bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-panel)] hover:border-[var(--border-color)]",
    danger:
      "bg-[rgba(210,138,138,0.14)] border-[var(--danger)] text-[var(--danger)] hover:bg-[rgba(210,138,138,0.22)]",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}