import { useMemo, useState } from "react";
import { DataTable } from "./DataTable";
import { FilterDropdown } from "./FilterDropdown";
import { KpiCard } from "./KpiCard";
import { Panel, PanelHeader } from "./Panel";
import { SearchFilterInput } from "./SearchFilterInput";
import { StatusChip, normalizeStatus } from "./StatusChip";
import { Button } from "../../../ui/Button";
import { Icon } from "../icon/Icon";
import ModalManager from "../modal";
import { downloadRowsAsCsv } from "../../../utils/export-csv";


const FILTER_CONTROL_HEIGHT = "h-[66px]";


function renderFilterSelection({ label, selectedOptions }) {
  return (
    <>
      <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="mt-1 flex min-h-[1.75rem] flex-wrap items-center gap-2">
        {selectedOptions.length === 0 ? (
          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
            Todos
          </span>
        ) : (
          selectedOptions.map((option) => (
            <span
              key={option.value}
              className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]"
            >
              {option.label}
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


function buildKpis(rows) {
  const positiveStatuses = new Set(["asignado", "operativo", "disponible", "stock", "confirmada", "emitida"]);
  const pendingStatuses = new Set(["pendiente", "borrador"]);
  const warningStatuses = new Set(["laboratorio", "en-analisis", "pendiente-de-diagnostico", "ingresado-a-laboratorio"]);

  return [
    {
      label: "Total actas",
      value: String(rows.length).padStart(2, "0"),
      helper: "Periodo actual",
      tone: "default",
    },
    {
      label: "Activas",
      value: String(rows.filter((row) => positiveStatuses.has(normalizeStatus(row.status))).length).padStart(2, "0"),
      helper: "En seguimiento",
      tone: "success",
    },
    {
      label: "Pendientes",
      value: String(rows.filter((row) => pendingStatuses.has(normalizeStatus(row.status))).length).padStart(2, "0"),
      helper: "Requieren accion",
      tone: "warning",
    },
    {
      label: "En revision",
      value: String(rows.filter((row) => warningStatuses.has(normalizeStatus(row.status))).length).padStart(2, "0"),
      helper: "Con validacion",
      tone: "danger",
    },
  ];
}


function openCreateModal(title) {
  ModalManager.custom({
    title: `Nueva ${title}`,
    size: "large",
    showFooter: false,
    content: (
      <div className="space-y-4">
        <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4 text-sm text-[var(--text-secondary)]">
          Esta version replica la experiencia visual del modulo de entrega y deja lista la apertura en modal para el flujo de creacion.
        </div>
        <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 text-sm text-[var(--text-secondary)]">
          El backend real de este modulo aun no esta conectado en esta pantalla.
        </div>
      </div>
    ),
  });
}


function openEditModal(title, row) {
  ModalManager.custom({
    title: `Editar ${row.code}`,
    size: "large",
    showFooter: false,
    content: (
      <div className="space-y-4">
        <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Registro seleccionado
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{row.code}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Esta replica mantiene la edicion en modal para {title.toLowerCase()}.
          </p>
        </div>
        <div className="grid gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 text-sm text-[var(--text-secondary)]">
          <p><span className="font-semibold text-[var(--text-primary)]">Responsable:</span> {row.person}</p>
          <p><span className="font-semibold text-[var(--text-primary)]">Activo:</span> {row.asset}</p>
          <p><span className="font-semibold text-[var(--text-primary)]">Fecha:</span> {row.date}</p>
          <p><span className="font-semibold text-[var(--text-primary)]">Estado:</span> {row.status}</p>
        </div>
      </div>
    ),
  });
}


function downloadRows(title, rows) {
  if (!rows.length) {
    return;
  }

  downloadRowsAsCsv({
    filename: `${title.toLowerCase().replace(/\s+/g, "_")}.csv`,
    header: ["Acta", "Responsable", "Activo", "Fecha", "Estado"],
    rows: rows.map((row) => [
      row.code || "",
      row.person || "",
      row.asset || "",
      row.date || "",
      row.status || "",
    ]),
  });
}


export function MockActaModulePage({
  eyebrow,
  title,
  searchPlaceholder,
  statusOptions = [],
  rows = [],
  emptyMessage = "No hay actas que coincidan con los filtros actuales.",
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesQuery = normalizedQuery.length === 0
        || [row.code, row.person, row.asset, row.date, row.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesStatus = !status || normalizeStatus(row.status) === normalizeStatus(status);
      return matchesQuery && matchesStatus;
    });
  }, [query, rows, status]);

  const kpis = useMemo(() => buildKpis(filteredRows), [filteredRows]);

  const columns = useMemo(() => [
    { key: "code", label: "Acta", sortable: true },
    { key: "person", label: "Responsable", sortable: true },
    { key: "asset", label: "Activo", sortable: true },
    { key: "date", label: "Fecha", sortable: true },
    {
      key: "status",
      label: "Estado",
      render: (value) => <StatusChip status={value} />,
    },
    {
      key: "actions",
      label: "Acciones",
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEditModal(title, row)}>
            <Icon name="edit" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Editar
          </Button>
        </div>
      ),
    },
  ], [title]);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <Panel>
        <PanelHeader eyebrow={eyebrow} title={`Filtros ${title}`} />
        <form className="grid gap-4" onSubmit={(event) => event.preventDefault()}>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="grid gap-3">
              <div className="grid gap-3 xl:grid-cols-4">
                <div className="min-w-0 xl:col-span-3">
                  <SearchFilterInput
                    value={query}
                    placeholder={searchPlaceholder}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>

                <div className="min-w-0">
                  <FilterDropdown
                    label="Estado"
                    selectedValues={status ? [status] : []}
                    options={[
                      { value: "all", label: "Todos" },
                      ...statusOptions,
                    ]}
                    selectionMode="single"
                    onToggleOption={(value) => setStatus(value === "all" ? "" : value)}
                    onClear={() => setStatus("")}
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
              </div>
            </div>

            <div className="flex flex-col justify-center gap-3 xl:w-[12rem]">
              <Button
                type="submit"
                variant="primary"
                className={`${FILTER_CONTROL_HEIGHT} w-full`}
                aria-label="Buscar"
                title="Buscar"
              >
                <Icon name="search" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Buscar
              </Button>
            </div>
          </div>
        </form>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow={eyebrow}
          title={`Listado ${title}`}
          actions={(
            <>
              {filteredRows.length ? (
                <Button variant="secondary" onClick={() => downloadRows(title, filteredRows)}>
                  <Icon name="download" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Descargar Excel
                </Button>
              ) : null}
              <Button variant="primary" onClick={() => openCreateModal(title)}>
                <Icon name="plus" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Nueva acta
              </Button>
            </>
          )}
        />

        <DataTable columns={columns} rows={filteredRows} emptyMessage={emptyMessage} />
      </Panel>
    </div>
  );
}
