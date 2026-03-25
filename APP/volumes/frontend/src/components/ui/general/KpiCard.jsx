import { Badge } from "../../../ui";

/**
 * KpiCard — tarjeta de métrica del dashboard
 */
export function KpiCard({ label, value, helper, tone = "default" }) {
  return (
    <article className="flex flex-col items-center justify-center gap-0 rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-panel)] p-5 text-center shadow-[var(--shadow-subtle)]">
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