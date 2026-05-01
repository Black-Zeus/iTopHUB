import { Badge } from "../../../ui";

/**
 * KpiCard — tarjeta de métrica del dashboard
 */
export function KpiCard({ label, value, helper, tone = "default", active = false, onClick = null }) {
  const isInteractive = typeof onClick === "function";

  return (
    <article
      className={`flex flex-col items-center justify-center gap-0 rounded-[var(--radius-md)] border bg-[var(--bg-panel)] p-5 text-center shadow-[var(--shadow-subtle)] transition ${
        active
          ? "border-[var(--accent-strong)] ring-2 ring-[rgba(81,152,194,0.18)]"
          : "border-[var(--border-color)]"
      } ${isInteractive ? "cursor-pointer hover:-translate-y-px hover:border-[var(--accent-strong)]" : ""}`}
      onClick={isInteractive ? onClick : undefined}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
    >
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </p>
      <strong className="my-2 block text-[1.7rem] font-bold text-[var(--text-primary)]">
        {value}
      </strong>
      {helper && <Badge tone={tone}>{helper}</Badge>}
    </article>
  );
}
