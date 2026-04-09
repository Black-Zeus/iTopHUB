/**
 * StatusChip - chip de estado operacional de activos
 * Mapea los estados del Draft directamente.
 */

const STATUS_MAP = {
  operativo: { label: "Operativo", cls: "bg-[rgba(127,191,156,0.14)] text-[var(--success)]" },
  asignado: { label: "Asignado", cls: "bg-[rgba(127,191,156,0.14)] text-[var(--success)]" },
  disponible: { label: "Disponible", cls: "bg-[var(--accent-soft)] text-[var(--accent-strong)]" },
  stock: { label: "Stock", cls: "bg-[var(--accent-soft)] text-[var(--accent-strong)]" },
  laboratorio: { label: "Laboratorio", cls: "bg-[rgba(224,181,107,0.14)] text-[var(--warning)]" },
  pendiente: { label: "Pendiente", cls: "bg-[rgba(224,181,107,0.14)] text-[var(--warning)]" },
  active: { label: "Activo", cls: "bg-[rgba(127,191,156,0.14)] text-[var(--success)]" },
  inactive: { label: "Inactivo", cls: "bg-[rgba(210,138,138,0.14)] text-[var(--danger)]" },
  baja: { label: "Baja", cls: "bg-[rgba(210,138,138,0.14)] text-[var(--danger)]" },
  "no-operativo": { label: "No operativo", cls: "bg-[rgba(210,138,138,0.14)] text-[var(--danger)]" },
};

export function normalizeStatus(status) {
  return status?.toLowerCase().replace(/\s+/g, "-") ?? "";
}

export function getStatusChipConfig(status) {
  const normalized = normalizeStatus(status);

  return STATUS_MAP[normalized] ?? {
    label: status ?? "-",
    cls: "bg-[var(--bg-panel-muted)] text-[var(--text-muted)]",
  };
}

export function StatusChip({ status, className = "" }) {
  const config = getStatusChipConfig(status);

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${config.cls} ${className}`}
    >
      {config.label}
    </span>
  );
}
