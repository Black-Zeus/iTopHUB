import { useMemo, useState } from "react";
import { DataTable } from "./DataTable";
import { KpiCard } from "./KpiCard";
import { Panel, PanelHeader } from "./Panel";
import { StatusChip } from "./StatusChip";
import { Button } from "../../../ui/Button";
import { Icon } from "../icon/Icon";

const TABLE_COLUMNS = [
  { key: "code", label: "Acta", sortable: true },
  { key: "person", label: "Responsable", sortable: true },
  { key: "asset", label: "Activo", sortable: true },
  { key: "area", label: "Area", sortable: true },
  { key: "date", label: "Fecha", sortable: true },
  {
    key: "status",
    label: "Estado",
    render: (value) => <StatusChip status={value} />,
  },
  {
    key: "actions",
    label: "Acciones",
    render: () => (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-9 w-9 min-w-0 rounded-full p-0 text-[var(--text-primary)]"
          aria-label="Editar acta"
          title="Editar"
        >
          <Icon name="edit" size={16} className="h-4 w-4 shrink-0" aria-hidden="true" />
          
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-9 w-9 min-w-0 rounded-full border border-[var(--border-color)] p-0 text-[var(--text-primary)]"
          aria-label="Descargar acta"
          title="Descargar"
        >
          <Icon name="download" size={16} className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Button>
      </div>
    ),
  },
];

function buildKpis(rows) {
  const activeStatuses = new Set(["asignado", "operativo", "disponible", "stock"]);
  const pendingStatuses = new Set(["pendiente"]);
  const warningStatuses = new Set(["laboratorio"]);

  return [
    {
      label: "Total actas",
      value: String(rows.length).padStart(2, "0"),
      helper: "Periodo actual",
      tone: "default",
    },
    {
      label: "Activas",
      value: String(rows.filter((row) => activeStatuses.has(row.status)).length).padStart(2, "0"),
      helper: "En seguimiento",
      tone: "success",
    },
    {
      label: "Pendientes",
      value: String(rows.filter((row) => pendingStatuses.has(row.status)).length).padStart(2, "0"),
      helper: "Requieren accion",
      tone: "warning",
    },
    {
      label: "En revision",
      value: String(rows.filter((row) => warningStatuses.has(row.status)).length).padStart(2, "0"),
      helper: "Con validacion",
      tone: "danger",
    },
  ];
}

export function ActaModulePage({
  eyebrow,
  title,
  searchPlaceholder = "Buscar por acta, persona o activo",
  statusOptions = [],
  rows = [],
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesStatus = status === "all" ? true : row.status === status;
      const searchableValues = [row.code, row.person, row.asset, row.area, row.date]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery.length === 0 || searchableValues.includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [query, rows, status]);

  const kpis = useMemo(() => buildKpis(filteredRows), [filteredRows]);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <Panel>
        <PanelHeader
          eyebrow={eyebrow}
          title={title}
          actions={(
            <Button type="button" variant="primary" size="sm" className="whitespace-nowrap">
              <Icon name="plus" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Generar nueva acta
            </Button>
          )}
        />

        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Filtro
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full min-w-0 border-0 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </label>

          <label className="flex items-center gap-3 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Estado
            </span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="border-0 bg-transparent pr-6 text-sm text-[var(--text-primary)] outline-none"
            >
              <option value="all">Todos</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DataTable
          columns={TABLE_COLUMNS}
          rows={filteredRows}
          emptyMessage="No hay actas que coincidan con los filtros actuales."
        />
      </Panel>
    </div>
  );
}
