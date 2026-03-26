import { useMemo, useState } from "react";
import { DataTable } from "./DataTable";
import { FilterDropdown } from "./FilterDropdown";
import { KpiCard } from "./KpiCard";
import { Panel, PanelHeader } from "./Panel";
import { SoftActionButton } from "./SoftActionButton";
import { StatusChip, getStatusChipConfig, normalizeStatus } from "./StatusChip";
import { Button } from "../../../ui/Button";
import { Icon } from "../icon/Icon";
import ModalManager from "../modal";

function EditActaModalContent({ row }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Acta seleccionada
        </p>
        <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{row.code}</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Este modal es un placeholder inicial para la futura edicion del documento.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 text-sm text-[var(--text-secondary)]">
        <p><span className="font-semibold text-[var(--text-primary)]">Responsable:</span> {row.person}</p>
        <p><span className="font-semibold text-[var(--text-primary)]">Activo:</span> {row.asset}</p>
        <p><span className="font-semibold text-[var(--text-primary)]">Area:</span> {row.area}</p>
        <p><span className="font-semibold text-[var(--text-primary)]">Fecha:</span> {row.date}</p>
      </div>
    </div>
  );
}

function DownloadActaModalContent({ fileName, onDownload }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Archivo disponible
        </p>
        <p className="mt-2 break-all text-base font-semibold text-[var(--text-primary)]">{fileName}</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Placeholder inicial para la descarga del PDF del acta.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={onDownload}>
          <Icon name="download" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Descargar
        </Button>
      </div>
    </div>
  );
}

function createTableColumns({ onEdit, onDownload }) {
  return [
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
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-9 w-9 min-w-0 rounded-full p-0 text-[var(--text-primary)]"
            aria-label="Editar acta"
            title="Editar"
            onClick={() => onEdit(row)}
          >
            <Icon name="edit" size={16} className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 min-w-0 rounded-full border border-[var(--border-color)] p-0 text-[var(--text-primary)]"
            aria-label="Descargar acta"
            title="Descargar"
            onClick={() => onDownload(row)}
          >
            <Icon name="download" size={16} className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];
}

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
      value: String(rows.filter((row) => activeStatuses.has(normalizeStatus(row.status))).length).padStart(2, "0"),
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

export function ActaModulePage({
  eyebrow,
  title,
  searchPlaceholder = "Buscar por acta, persona o activo",
  statusOptions = [],
  rows = [],
  columns,
  searchKeys = ["code", "person", "asset", "area", "date"],
  buildKpis: buildKpisOverride,
  primaryActionLabel = "Generar nueva acta",
  primaryActionIcon = "plus",
  onPrimaryAction,
  emptyMessage = "No hay actas que coincidan con los filtros actuales.",
}) {
  const [query, setQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState([]);

  const statusFilters = useMemo(() => {
    const availableStatuses = statusOptions.map((option) => {
      const normalizedValue = normalizeStatus(option.value);

      return {
        ...option,
        count: rows.filter((row) => normalizeStatus(row.status) === normalizedValue).length,
        visual: getStatusChipConfig(option.value),
      };
    });

    return [
      {
        value: "all",
        label: "Todos",
        count: rows.length,
        visual: {
          cls: "bg-[var(--bg-panel-muted)] text-[var(--text-secondary)]",
        },
      },
      ...availableStatuses,
    ];
  }, [rows, statusOptions]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const normalizedRowStatus = normalizeStatus(row.status);
      const matchesStatus =
        selectedStatuses.length === 0 ? true : selectedStatuses.includes(normalizedRowStatus);
      const searchableValues = searchKeys
        .map((key) => row[key])
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery.length === 0 || searchableValues.includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [query, rows, searchKeys, selectedStatuses]);

  const kpisBuilder = buildKpisOverride ?? buildKpis;
  const kpis = useMemo(() => kpisBuilder(filteredRows), [filteredRows, kpisBuilder]);
  const selectedStatusOptions = statusFilters.filter((option) =>
    selectedStatuses.includes(normalizeStatus(option.value))
  );

  const toggleStatusSelection = (value) => {
    const normalizedValue = normalizeStatus(value);

    if (normalizedValue === "all") {
      setSelectedStatuses([]);
      return;
    }

    setSelectedStatuses((currentStatuses) =>
      currentStatuses.includes(normalizedValue)
        ? currentStatuses.filter((statusValue) => statusValue !== normalizedValue)
        : [...currentStatuses, normalizedValue]
    );
  };

  const openEditModal = (row) => {
    ModalManager.info({
      title: `Editar ${row.code}`,
      message: "Placeholder inicial para la edicion del acta.",
      size: "medium",
      content: <EditActaModalContent row={row} />,
    });
  };

  const openDownloadModal = (row) => {
    const fileName = `${row.code}.pdf`;

    const modalId = ModalManager.custom({
      title: `Descargar ${row.code}`,
      size: "medium",
      showFooter: false,
      content: (
        <DownloadActaModalContent
          fileName={fileName}
          onDownload={() => {
            ModalManager.close(modalId);
            ModalManager.info({
              title: "Descarga pendiente",
              message: `Placeholder activo para ${fileName}. Aqui conectaremos la descarga real.`,
            });
          }}
        />
      ),
    });
  };

  const tableColumns = useMemo(
    () => columns ?? createTableColumns({ onEdit: openEditModal, onDownload: openDownloadModal }),
    [columns]
  );

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
          actions={primaryActionLabel ? (
            <SoftActionButton
              type="button"
              size="sm"
              className="whitespace-nowrap"
              onClick={onPrimaryAction}
            >
              <Icon name={primaryActionIcon} size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {primaryActionLabel}
            </SoftActionButton>
          ) : null}
        />

        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <label className="flex min-h-[66px] min-w-0 flex-1 items-center gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3">
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

          <FilterDropdown
            label="Estado"
            align="right"
            options={statusFilters.map((option) => ({
              ...option,
              normalizedValue: normalizeStatus(option.value),
            }))}
            selectedValues={selectedStatuses}
            onToggleOption={toggleStatusSelection}
            onClear={() => setSelectedStatuses([])}
            triggerClassName="py-3 lg:w-[22rem] lg:max-w-[22rem]"
            buttonHeightClassName="min-h-[66px]"
            menuOffsetClassName="top-[calc(100%+0.55rem)]"
            title="Filtrar por estado"
            description="Puedes seleccionar uno o varios estados"
            renderSelection={() => (
              <>
                <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Estado
                </span>
                <span className="mt-1 flex min-h-[1.75rem] flex-wrap items-center gap-2">
                  {selectedStatusOptions.length === 0 ? (
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      Todos los estados
                    </span>
                  ) : selectedStatusOptions.length <= 2 ? (
                    selectedStatusOptions.map((option) => (
                      <StatusChip key={option.value} status={getStatusChipConfig(option.value).label} />
                    ))
                  ) : (
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {selectedStatusOptions.length} estados seleccionados
                    </span>
                  )}
                  {selectedStatusOptions.length > 0 ? (
                    <span className="text-xs text-[var(--text-muted)]">Seleccion multiple activa</span>
                  ) : null}
                </span>
              </>
            )}
            renderOptionDescription={(option) =>
              option.value === "all" ? "Sin restriccion aplicada" : "Combina este estado con otros"
            }
            renderOptionLeading={() => (
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
            )}
            getOptionClassName={(option, isActive) =>
              isActive
                ? `border-transparent shadow-[0_10px_22px_rgba(81,152,194,0.14)] ${option.visual.cls}`
                : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"
            }
            menuClassName="rounded-[18px]"
            renderOptionTrailing={(_, isActive) =>
              isActive ? (
                <Icon name="check" size={12} className="h-3 w-3" aria-hidden="true" />
              ) : null
            }
          />
        </div>

        <DataTable
          columns={tableColumns}
          rows={filteredRows}
          emptyMessage={emptyMessage}
        />
      </Panel>
    </div>
  );
}
