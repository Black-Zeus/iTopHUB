import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../../components/ui/general/DataTable";
import { FilterDropdown } from "../../components/ui/general/FilterDropdown";
import { KpiCard } from "../../components/ui/general/KpiCard";
import { Panel, PanelHeader } from "../../components/ui/general/Panel";
import { SoftActionButton } from "../../components/ui/general/SoftActionButton";
import { StatusChip, normalizeStatus } from "../../components/ui/general/StatusChip";
import { Button } from "../../ui/Button";
import { Icon } from "../../components/ui/icon/Icon";
import ModalManager from "../../components/ui/modal";

const ASSET_ROWS = [
  {
    id: 1,
    hostname: "NB-24017",
    className: "Laptop (Laptop)",
    brand: "Dell",
    model: "Latitude 5440",
    serial: "DL5440-22A91",
    owner: "Paula Ferreyra",
    status: "asignado",
  },
  {
    id: 2,
    hostname: "NB-24021",
    className: "Laptop (Laptop)",
    brand: "HP",
    model: "EliteBook 840 G10",
    serial: "HP840G10-0912",
    owner: "Joaquin Herrera",
    status: "laboratorio",
  },
  {
    id: 3,
    hostname: "TB-24003",
    className: "Tablet (Tablet)",
    brand: "Samsung",
    model: "Galaxy Tab Active4 Pro",
    serial: "SMT636-8821",
    owner: "Camila Soto",
    status: "pendiente",
  },
  {
    id: 4,
    hostname: "NB-24032",
    className: "Laptop (Laptop)",
    brand: "Lenovo",
    model: "ThinkPad T14 Gen 4",
    serial: "LNV-T14-7734",
    owner: "Diego Riquelme",
    status: "asignado",
  },
  {
    id: 5,
    hostname: "WK-24008",
    className: "Desktop (Desktop)",
    brand: "Dell",
    model: "OptiPlex 7010",
    serial: "OPT7010-5542",
    owner: "Andrea Vera",
    status: "asignado",
  },
];

function AssetFilterInput({ label, value, placeholder, onChange }) {
  return (
    <label className="block">
      <div className="flex h-[62px] w-full items-center gap-3 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 transition focus-within:border-[var(--accent-strong)] focus-within:bg-[var(--bg-panel)] focus-within:shadow-[0_0_0_4px_rgba(81,152,194,0.12)]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <Icon name="sliders" size={14} className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <input
            type="search"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full border-0 bg-transparent p-0 text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:font-normal placeholder:text-[var(--text-muted)]"
          />
        </span>
      </div>
    </label>
  );
}

function renderAssetFilterSelection({ label, selectedOptions }) {
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
        ) : selectedOptions.length <= 2 ? (
          selectedOptions.map((option) => (
            <span
              key={option.value}
              className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]"
            >
              {option.label}
            </span>
          ))
        ) : (
          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
            {selectedOptions.length} seleccionados
          </span>
        )}
      </span>
    </>
  );
}

function getAssetFilterOptionClassName(_, isActive) {
  return isActive
    ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
    : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]";
}

function buildAssetKpis(rows) {
  return [
    {
      label: "Activos visibles",
      value: String(rows.length),
      helper: "Inventario cargado",
      tone: "default",
    },
    {
      label: "Asignados",
      value: String(rows.filter((row) => normalizeStatus(row.status) === "asignado").length),
      helper: "En uso actual",
      tone: "success",
    },
    {
      label: "En laboratorio",
      value: String(rows.filter((row) => normalizeStatus(row.status) === "laboratorio").length),
      helper: "Con revision tecnica",
      tone: "warning",
    },
    {
      label: "Pendientes",
      value: String(rows.filter((row) => normalizeStatus(row.status) === "pendiente").length),
      helper: "Con accion operativa",
      tone: "danger",
    },
  ];
}

export function AssetsPage() {
  const [filters, setFilters] = useState({
    hostname: "",
    className: [],
    brand: [],
    model: [],
    serial: "",
    status: [],
  });

  const classOptions = useMemo(
    () => [
      { value: "all", label: "Todas" },
      ...Array.from(new Set(ASSET_ROWS.map((row) => row.className))).map((value) => ({
        value,
        label: value,
      })),
    ],
    []
  );

  const brandOptions = useMemo(() => {
    const availableRows =
      filters.className.length === 0
        ? ASSET_ROWS
        : ASSET_ROWS.filter((row) => filters.className.includes(row.className));

    return [
      { value: "all", label: "Todas" },
      ...Array.from(new Set(availableRows.map((row) => row.brand))).map((value) => ({
        value,
        label: value,
      })),
    ];
  }, [filters.className]);

  const modelOptions = useMemo(() => {
    const availableRows = ASSET_ROWS.filter((row) => {
      const matchesClass =
        filters.className.length === 0 || filters.className.includes(row.className);
      const matchesBrand =
        filters.brand.length === 0 || filters.brand.includes(row.brand);

      return matchesClass && matchesBrand;
    });

    return [
      { value: "all", label: "Todos" },
      ...Array.from(new Set(availableRows.map((row) => row.model))).map((value) => ({
        value,
        label: value,
      })),
    ];
  }, [filters.brand, filters.className]);

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "Todos" },
      { value: "asignado", label: "Asignado" },
      { value: "laboratorio", label: "Laboratorio" },
      { value: "pendiente", label: "Pendiente" },
    ],
    []
  );

  const filteredRows = useMemo(() => {
    const normalizedHostname = filters.hostname.trim().toLowerCase();
    const normalizedSerial = filters.serial.trim().toLowerCase();

    return ASSET_ROWS.filter((row) => {
      const matchesHostname =
        normalizedHostname.length === 0 || row.hostname.toLowerCase().includes(normalizedHostname);
      const matchesClass = filters.className.length === 0 || filters.className.includes(row.className);
      const matchesBrand = filters.brand.length === 0 || filters.brand.includes(row.brand);
      const matchesModel = filters.model.length === 0 || filters.model.includes(row.model);
      const matchesSerial =
        normalizedSerial.length === 0 || row.serial.toLowerCase().includes(normalizedSerial);
      const matchesStatus =
        filters.status.length === 0 || filters.status.includes(normalizeStatus(row.status));

      return (
        matchesHostname &&
        matchesClass &&
        matchesBrand &&
        matchesModel &&
        matchesSerial &&
        matchesStatus
      );
    });
  }, [filters]);

  useEffect(() => {
    const validBrandValues = new Set(brandOptions.map((option) => option.value));
    const validModelValues = new Set(modelOptions.map((option) => option.value));

    setFilters((current) => {
      const nextBrand = current.brand.filter((value) => validBrandValues.has(value));
      const nextModel = current.model.filter((value) => validModelValues.has(value));

      if (nextBrand.length === current.brand.length && nextModel.length === current.model.length) {
        return current;
      }

      return {
        ...current,
        brand: nextBrand,
        model: nextModel,
      };
    });
  }, [brandOptions, modelOptions]);

  const kpis = useMemo(() => buildAssetKpis(filteredRows), [filteredRows]);

  const toggleFilterValue = (key, value, selectionMode = "multiple") => {
    if (value === "all") {
      setFilters((current) => ({ ...current, [key]: [] }));
      return;
    }

    setFilters((current) => {
      const currentValues = current[key];

      if (selectionMode === "single") {
        return {
          ...current,
          [key]: currentValues.includes(value) ? [] : [value],
        };
      }

      return {
        ...current,
        [key]: currentValues.includes(value)
          ? currentValues.filter((item) => item !== value)
          : [...currentValues, value],
      };
    });
  };

  const openAssetModal = (row) => {
    ModalManager.info({
      title: `Editar ${row.hostname}`,
      message: "Placeholder inicial para la edicion del activo CMDB.",
      content: (
        <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4 text-sm text-[var(--text-secondary)]">
          <p><span className="font-semibold text-[var(--text-primary)]">Clase:</span> {row.className}</p>
          <p><span className="font-semibold text-[var(--text-primary)]">Marca:</span> {row.brand}</p>
          <p><span className="font-semibold text-[var(--text-primary)]">Modelo:</span> {row.model}</p>
          <p><span className="font-semibold text-[var(--text-primary)]">Serie:</span> {row.serial}</p>
          <p><span className="font-semibold text-[var(--text-primary)]">Responsable:</span> {row.owner}</p>
        </div>
      ),
    });
  };

  const openNewAssetModal = () => {
    ModalManager.info({
      title: "Nuevo activo",
      message: "Placeholder inicial para la creacion de un nuevo activo en CMDB.",
      content: (
        <p className="text-sm text-[var(--text-secondary)]">
          Aqui conectaremos el formulario completo para registrar activos y asociarlos a un responsable.
        </p>
      ),
    });
  };

  const columns = useMemo(
    () => [
      { key: "hostname", label: "Hostname", sortable: true },
      { key: "className", label: "Clase", sortable: true },
      { key: "brand", label: "Marca", sortable: true },
      { key: "model", label: "Modelo", sortable: true },
      { key: "serial", label: "Serie", sortable: true },
      { key: "owner", label: "Usuario responsable", sortable: true },
      {
        key: "status",
        label: "Estado",
        render: (value) => <StatusChip status={value} />,
      },
      {
        key: "action",
        label: "Accion",
        render: (_, row) => (
          <Button type="button" variant="secondary" size="sm" onClick={() => openAssetModal(row)}>
            <Icon name="edit" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Editar
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <Panel>
        <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <AssetFilterInput
              label="HostName"
              value={filters.hostname}
              onChange={(event) => setFilters((current) => ({ ...current, hostname: event.target.value }))}
              placeholder="Buscar por HostName"
            />

            <FilterDropdown
              label="Clase"
              selectedValues={filters.className}
              options={classOptions}
              selectionMode="single"
              onToggleOption={(value) => toggleFilterValue("className", value, "single")}
              onClear={() => setFilters((current) => ({ ...current, className: [] }))}
              triggerClassName="py-3"
              buttonHeightClassName="min-h-[66px]"
              menuOffsetClassName="top-[calc(100%+0.55rem)]"
              menuClassName="rounded-[18px]"
              renderSelection={renderAssetFilterSelection}
              renderOptionLeading={() => (
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
              )}
              renderOptionDescription={(option) =>
                option.value === "all" ? "Sin restriccion aplicada" : "Selecciona una clase"
              }
              getOptionClassName={getAssetFilterOptionClassName}
            />

            <FilterDropdown
              label="Marca"
              selectedValues={filters.brand}
              options={brandOptions}
              selectionMode="single"
              onToggleOption={(value) => toggleFilterValue("brand", value, "single")}
              onClear={() => setFilters((current) => ({ ...current, brand: [] }))}
              triggerClassName="py-3"
              buttonHeightClassName="min-h-[66px]"
              menuOffsetClassName="top-[calc(100%+0.55rem)]"
              menuClassName="rounded-[18px]"
              renderSelection={renderAssetFilterSelection}
              renderOptionLeading={() => (
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
              )}
              renderOptionDescription={(option) =>
                option.value === "all" ? "Sin restriccion aplicada" : "Selecciona una marca"
              }
              getOptionClassName={getAssetFilterOptionClassName}
            />

            <FilterDropdown
              label="Modelo"
              selectedValues={filters.model}
              options={modelOptions}
              selectionMode="multiple"
              onToggleOption={(value) => toggleFilterValue("model", value, "multiple")}
              onClear={() => setFilters((current) => ({ ...current, model: [] }))}
              triggerClassName="py-3"
              buttonHeightClassName="min-h-[66px]"
              menuOffsetClassName="top-[calc(100%+0.55rem)]"
              menuClassName="rounded-[18px]"
              renderSelection={renderAssetFilterSelection}
              renderOptionLeading={() => (
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
              )}
              renderOptionDescription={(option) =>
                option.value === "all" ? "Sin restriccion aplicada" : "Combina este valor con otros"
              }
              getOptionClassName={getAssetFilterOptionClassName}
            />

            <AssetFilterInput
              label="Serie"
              value={filters.serial}
              onChange={(event) => setFilters((current) => ({ ...current, serial: event.target.value }))}
              placeholder="Numero de serie"
            />

            <FilterDropdown
              label="Estado"
              selectedValues={filters.status}
              options={statusOptions}
              selectionMode="multiple"
              onToggleOption={(value) => toggleFilterValue("status", normalizeStatus(value), "multiple")}
              onClear={() => setFilters((current) => ({ ...current, status: [] }))}
              triggerClassName="py-3"
              buttonHeightClassName="min-h-[66px]"
              menuOffsetClassName="top-[calc(100%+0.55rem)]"
              menuClassName="rounded-[18px]"
              renderSelection={renderAssetFilterSelection}
              renderOptionLeading={() => (
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
              )}
              renderOptionDescription={(option) =>
                option.value === "all" ? "Sin restriccion aplicada" : "Combina este valor con otros"
              }
              getOptionClassName={getAssetFilterOptionClassName}
            />
          </div>

          <SoftActionButton type="button" onClick={openNewAssetModal}>
            Nuevo activo
          </SoftActionButton>
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Consulta CMDB" title="Lista de activos" />
        <DataTable
          columns={columns}
          rows={filteredRows}
          emptyMessage="No hay activos que coincidan con los filtros actuales."
        />
      </Panel>
    </div>
  );
}
