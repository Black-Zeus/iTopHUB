import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, FilterDropdown, KpiCard, Panel, PanelHeader } from "../../components/ui/general";
import { SearchFilterInput } from "../../components/ui/general/SearchFilterInput";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Icon } from "../../components/ui/icon/Icon";
import { Button } from "../../ui/Button";
import { listLabRecords } from "../../services/lab-service";
import { downloadRowsAsCsv } from "../../utils/export-csv";
import { LAB_REASON_OPTIONS, LAB_STATUS_OPTIONS, getReasonLabel } from "./lab-module-config";

const FILTER_CONTROL_HEIGHT = "h-[66px]";

function buildKpis(rows) {
  const draft    = rows.filter((r) => r.status === "En creacion").length;
  const inLab    = rows.filter((r) => r.status === "En laboratorio").length;
  const done     = rows.filter((r) => r.status === "Completada").length;
  const derived  = rows.filter((r) => r.status === "Derivada a obsoleto").length;
  const cancelled = rows.filter((r) => r.status === "Anulada").length;

  return [
    { label: "Total actas",          value: String(rows.length).padStart(2, "0"),  helper: "Registros guardados",    tone: "default",  filterValue: "" },
    { label: "En creacion",          value: String(draft).padStart(2, "0"),        helper: "Pendientes de cierre",   tone: "warning",  filterValue: "draft" },
    { label: "En laboratorio",       value: String(inLab).padStart(2, "0"),        helper: "En proceso activo",      tone: "default",  filterValue: "in_lab" },
    { label: "Completadas",          value: String(done).padStart(2, "0"),         helper: "Proceso finalizado",     tone: "success",  filterValue: "completed" },
    { label: "Derivadas a obsoleto", value: String(derived).padStart(2, "0"),      helper: "Con normalizacion",      tone: "danger",   filterValue: "derived_obsolete" },
    { label: "Anuladas",             value: String(cancelled).padStart(2, "0"),    helper: "Fuera de flujo",         tone: "danger",   filterValue: "cancelled" },
  ];
}

function chunkActions(actions = [], size = 3) {
  const rows = [];
  for (let i = 0; i < actions.length; i += size) rows.push(actions.slice(i, i + size));
  return rows;
}

function renderFilterSelection({ label, selectedOptions }) {
  return (
    <>
      <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="mt-1 flex min-h-[1.75rem] flex-wrap items-center gap-2">
        {selectedOptions.length === 0 ? (
          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">Todos</span>
        ) : (
          selectedOptions.map((opt) => (
            <span key={opt.value} className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]">
              {opt.label}
            </span>
          ))
        )}
      </span>
    </>
  );
}

function getFilterOptionClassName(_, isActive) {
  return isActive
    ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
    : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]";
}

function formatDate(isoDate) {
  if (!isoDate) return "—";
  try {
    return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(isoDate + "T12:00:00"));
  } catch {
    return isoDate;
  }
}

function PhaseBadge({ hasEntry, hasProcessing, hasExit }) {
  if (hasExit) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(127,191,156,0.14)] px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        3 fases
      </span>
    );
  }
  if (hasProcessing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(106,63,160,0.1)] px-2.5 py-1 text-xs font-semibold text-[rgba(106,63,160,0.9)]">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Entrada + Proceso
      </span>
    );
  }
  if (hasEntry) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Solo entrada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(224,181,107,0.14)] px-2.5 py-1 text-xs font-semibold text-[var(--warning)]">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Sin documentos
    </span>
  );
}

export function LabPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ query: "", status: "", reason: "" });

  const kpis = useMemo(() => buildKpis(rows), [rows]);

  const loadRecords = async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const payload = await listLabRecords(nextFilters);
      setRows(payload?.items || []);
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar las actas de laboratorio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords({ query: "", status: "", reason: "" });
  }, []);

  const handleFilterSubmit = async (event) => {
    event.preventDefault();
    await loadRecords(filters);
  };

  const handleKpiFilter = async (statusValue = "") => {
    const nextFilters = { ...filters, status: statusValue };
    setFilters(nextFilters);
    await loadRecords(nextFilters);
  };

  const actionButtonClassName =
    "inline-flex w-full min-h-[36px] items-center justify-center gap-1.5 whitespace-nowrap px-2 py-1.5 text-[11px]";

  const tableColumns = [
    {
      key: "code",
      label: "Acta",
      sortable: true,
      headerClassName: "w-[9rem] min-w-[9rem]",
      cellClassName: "w-[9rem] min-w-[9rem]",
    },
    {
      key: "reason",
      label: "Motivo",
      sortable: true,
      render: (_, row) => getReasonLabel(row.reason),
    },
    {
      key: "asset",
      label: "Activo",
      sortable: true,
      render: (_, row) => {
        const name = row.assetName || row.assetCode || "—";
        const code = row.assetCode && row.assetName ? `[${row.assetCode}] ` : "";
        return <span title={name}>{code}{name}</span>;
      },
    },
    {
      key: "ownerName",
      label: "Especialista",
      sortable: true,
      render: (value) => value || "—",
    },
    {
      key: "entryDate",
      label: "Ingreso",
      sortable: true,
      headerClassName: "w-[7.5rem] min-w-[7.5rem]",
      cellClassName: "w-[7.5rem] min-w-[7.5rem]",
      render: (value) => formatDate(value),
    },
    {
      key: "phase",
      label: "Fases",
      headerClassName: "w-[9rem] min-w-[9rem]",
      cellClassName: "w-[9rem] min-w-[9rem]",
      render: (_, row) => (
        <PhaseBadge
          hasEntry={Boolean(row.entryGeneratedDocument)}
          hasProcessing={Boolean(row.processingGeneratedDocument)}
          hasExit={Boolean(row.exitGeneratedDocument)}
        />
      ),
    },
    {
      key: "status",
      label: "Estado",
      headerClassName: "w-[8.5rem] min-w-[8.5rem]",
      cellClassName: "w-[8.5rem] min-w-[8.5rem]",
      render: (value) => <StatusChip status={value} />,
    },
    {
      key: "actions",
      label: "Acciones",
      headerClassName: "w-[16rem] min-w-[16rem] text-right",
      cellClassName: "w-[16rem] min-w-[16rem] align-top",
      render: (_, row) => {
        const isDraft      = row.status === "En creacion";
        const isInLab      = row.status === "En laboratorio";
        const isCompleted  = row.status === "Completada";
        const isDerived    = row.status === "Derivada a obsoleto";
        const isCancelled  = row.status === "Anulada";
        const isReadOnly   = isCompleted || isDerived || isCancelled;

        const actions = [];

        if (isDraft || isInLab) {
          actions.push({ key: "edit",  label: "Editar", icon: "edit",   onClick: () => navigate(`/lab/${row.id}`) });
        }
        if (isReadOnly) {
          actions.push({ key: "view",  label: "Ver",    icon: "eye",    onClick: () => navigate(`/lab/${row.id}`) });
        }
        if (isDraft) {
          actions.push({ key: "entry", label: "Entrada", icon: "document", onClick: () => navigate(`/lab/${row.id}`) });
        }
        if (isInLab) {
          actions.push({ key: "exit",  label: "Salida",  icon: "document", onClick: () => navigate(`/lab/${row.id}`) });
        }
        if (isInLab || isCompleted || isDerived) {
          actions.push({ key: "docs",  label: "Docs",   icon: "download", onClick: () => navigate(`/lab/${row.id}`) });
        }

        const actionRows = chunkActions(actions, 3);

        return (
          <div className="ml-auto flex w-full max-w-[16rem] flex-col gap-1.5">
            {actionRows.map((actionRow, index) => (
              <div
                key={`action-row-${row.id}-${index}`}
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${Math.max(actionRow.length, 1)}, minmax(0, 1fr))` }}
              >
                {actionRow.map((action) => (
                  <Button
                    key={action.key}
                    size="sm"
                    variant="secondary"
                    className={actionButtonClassName}
                    onClick={action.onClick}
                  >
                    <Icon name={action.icon} size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {action.label}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div className="grid gap-5">
      {/* KPI cards — 6 columnas en xl */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            {...kpi}
            active={(filters.status || "") === (kpi.filterValue || "")}
            onClick={() => handleKpiFilter(kpi.filterValue || "")}
          />
        ))}
      </div>

      {error ? (
        <div className="rounded-[12px] border border-[rgba(210,138,138,0.3)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {/* Panel de filtros */}
      <Panel>
        <PanelHeader eyebrow="Laboratorio" title="Filtros Actas de Laboratorio" />
        <form className="grid gap-4" onSubmit={handleFilterSubmit}>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="grid gap-3">
              <div className="grid gap-3 xl:grid-cols-4">
                <div className="min-w-0 xl:col-span-2">
                  <SearchFilterInput
                    value={filters.query}
                    placeholder="Buscar por acta, activo, especialista o motivo"
                    onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                  />
                </div>

                <div className="min-w-0">
                  <FilterDropdown
                    label="Estado"
                    selectedValues={filters.status ? [filters.status] : []}
                    options={[
                      { value: "all", label: "Todos" },
                      ...LAB_STATUS_OPTIONS,
                    ]}
                    selectionMode="single"
                    onToggleOption={(value) => setFilters((current) => ({ ...current, status: value === "all" ? "" : value }))}
                    onClear={() => setFilters((current) => ({ ...current, status: "" }))}
                    triggerClassName="py-3"
                    buttonHeightClassName={FILTER_CONTROL_HEIGHT}
                    menuOffsetClassName="top-[calc(100%+0.55rem)]"
                    menuClassName="rounded-[18px]"
                    renderSelection={renderFilterSelection}
                    renderOptionLeading={() => (
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
                    )}
                    renderOptionDescription={(option) =>
                      option.value === "all" ? "Sin restriccion aplicada" : "Selecciona un estado"
                    }
                    getOptionClassName={getFilterOptionClassName}
                  />
                </div>

                <div className="min-w-0">
                  <FilterDropdown
                    label="Motivo"
                    selectedValues={filters.reason ? [filters.reason] : []}
                    options={[
                      { value: "all", label: "Todos" },
                      ...LAB_REASON_OPTIONS,
                    ]}
                    selectionMode="single"
                    onToggleOption={(value) => setFilters((current) => ({ ...current, reason: value === "all" ? "" : value }))}
                    onClear={() => setFilters((current) => ({ ...current, reason: "" }))}
                    triggerClassName="py-3"
                    buttonHeightClassName={FILTER_CONTROL_HEIGHT}
                    menuOffsetClassName="top-[calc(100%+0.55rem)]"
                    menuClassName="rounded-[18px]"
                    renderSelection={renderFilterSelection}
                    renderOptionLeading={() => (
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
                    )}
                    renderOptionDescription={(option) =>
                      option.value === "all" ? "Sin restriccion aplicada" : "Selecciona un motivo"
                    }
                    getOptionClassName={getFilterOptionClassName}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-3 xl:w-[12rem]">
              <Button
                type="submit"
                variant="primary"
                className={`${FILTER_CONTROL_HEIGHT} w-full`}
                aria-label={loading ? "Buscando" : "Buscar"}
                title={loading ? "Buscando" : "Buscar"}
              >
                <Icon name="search" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Buscar
              </Button>
            </div>
          </div>
        </form>
      </Panel>

      {/* Panel de listado */}
      <Panel>
        <PanelHeader
          eyebrow="Laboratorio"
          title="Listado de Actas de Laboratorio"
          actions={(
            <>
              <Button
                variant="secondary"
                disabled={rows.length === 0}
                onClick={() =>
                  downloadRowsAsCsv({
                    filename: "actas_laboratorio.csv",
                    header: ["Acta", "Motivo", "Activo", "Especialista", "Fecha ingreso", "Estado", "Fases"],
                    rows: rows.map((r) => [
                      r.code,
                      getReasonLabel(r.reason),
                      r.assetName || r.assetCode || "",
                      r.ownerName || "",
                      formatDate(r.entryDate),
                      r.status,
                      r.exitGeneratedDocument ? "3 fases" : r.processingGeneratedDocument ? "Entrada + Proceso" : r.entryGeneratedDocument ? "Solo entrada" : "Sin documentos",
                    ]),
                  })
                }
              >
                <Icon name="download" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Descargar Excel
              </Button>
              <Button variant="primary" onClick={() => navigate("/lab/new")}>
                <Icon name="plus" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Nueva acta
              </Button>
            </>
          )}
        />

        <DataTable
          columns={tableColumns}
          rows={rows}
          loading={loading}
          emptyMessage="No hay actas de laboratorio registradas con los filtros actuales."
          pagination
          pageSize={30}
          paginationAlwaysVisible
        />
      </Panel>
    </div>
  );
}
