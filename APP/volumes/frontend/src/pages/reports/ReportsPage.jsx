import { useEffect, useMemo, useState } from "react";
import { FilterDateField } from "../../components/ui/general/FilterDateField";
import { FilterDropdown } from "../../components/ui/general/FilterDropdown";
import { Panel, PanelHeader } from "../../components/ui/general/Panel";
import { SoftActionButton } from "../../components/ui/general/SoftActionButton";
import { CollapseToggleButton } from "../../components/ui/general/CollapseToggleButton";
import { Button } from "../../ui/Button";
import { Spinner } from "../../ui/Spinner";
import ModalManager from "../../components/ui/modal";
import { downloadRowsAsCsv } from "../../utils/export-csv";
import { executeReport, getReportCatalog, getReportDefinition } from "../../services/reports-service";

const CATEGORY_ORDER = ["Inventario", "Asignacion", "Movimientos", "Laboratorio", "Documental", "Renovacion", "Calidad CMDB"];

// Sentinel for "no filter applied" on select filters backed by nullable option values
const ALL_VALUE = "__all__";

function getDateOffset(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

// Normalizes API filter definitions into the shape expected by ReportParameterField.
// API:   {name, label, type, options: [{label, value}]}
// Local: {key, label, type, options: string[], optionValues: any[]}
function normalizeFilters(apiFilters) {
  if (!Array.isArray(apiFilters)) return [];
  return apiFilters.map((f) => ({
    key: f.name,
    label: f.label,
    type: f.type === "text" ? "search" : f.type,
    required: f.required ?? false,
    placeholder: f.placeholder,
    options: Array.isArray(f.options) ? f.options.map((o) => o.label) : [],
    optionValues: Array.isArray(f.options) ? f.options.map((o) => o.value) : [],
  }));
}

function buildDefaultParams(normalizedFilters) {
  const defaults = {};

  for (let index = 0; index < normalizedFilters.length; index += 1) {
    const parameter = normalizedFilters[index];
    const nextParameter = normalizedFilters[index + 1];

    if (
      parameter?.type === "date" &&
      nextParameter?.type === "date" &&
      parameter.key === "from_date" &&
      nextParameter.key === "to_date"
    ) {
      defaults[parameter.key] = getDateOffset(-6);
      defaults[nextParameter.key] = getDateOffset(0);
      index += 1;
      continue;
    }

    if (parameter.type === "date") {
      defaults[`${parameter.key}_start`] = getDateOffset(-6);
      defaults[`${parameter.key}_end`] = getDateOffset(0);
      continue;
    }

    if (parameter.type === "select") {
      // Use null for the "all" option (optionValues[0] is typically null for "Todos")
      defaults[parameter.key] = parameter.optionValues?.[0] ?? null;
      continue;
    }

    defaults[parameter.key] = "";
  }

  return defaults;
}

function getFormColumnClass(parameterCount) {
  if (parameterCount === 3) return "grid-cols-1 md:grid-cols-3";
  if (parameterCount % 2 === 0) return "grid-cols-1 md:grid-cols-2";
  return "grid-cols-1";
}

function getVisibleParameters(normalizedFilters) {
  const visibleParameters = [];

  for (let index = 0; index < normalizedFilters.length; index += 1) {
    const current = normalizedFilters[index];
    const next = normalizedFilters[index + 1];

    if (
      current?.type === "date" &&
      next?.type === "date" &&
      current.key === "from_date" &&
      next.key === "to_date"
    ) {
      visibleParameters.push({
        type: "date-range",
        key: `${current.key}:${next.key}`,
        label: "Rango de fechas",
        startKey: current.key,
        endKey: next.key,
      });
      index += 1;
      continue;
    }

    if (current?.type === "date") {
      visibleParameters.push({
        type: "date-range",
        key: `${current.key}_start:${current.key}_end`,
        label: current.label,
        startKey: `${current.key}_start`,
        endKey: `${current.key}_end`,
      });
      continue;
    }

    visibleParameters.push(current);
  }

  return visibleParameters;
}

// Collects non-null, non-empty filter values to send to the backend.
// Converts ALL_VALUE sentinel back to null so the engine can skip it.
function buildApiFilters(params, normalizedFilters) {
  const result = {};
  for (const f of normalizedFilters) {
    const val = params[f.key];
    if (val === null || val === undefined || val === "" || val === ALL_VALUE) continue;
    result[f.key] = val;
  }
  return result;
}

// ── Internal components ───────────────────────────────────────────────────────

function ReportIconButton({ title, onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--border-strong)] bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-[var(--shadow-subtle)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function ReportParameterField({ parameter, value, onChange }) {
  if (parameter.type === "date-range") {
    return (
      <FilterDateField
        label={parameter.label}
        mode="range"
        startValue={value?.start ?? ""}
        endValue={value?.end ?? ""}
        onRangeChange={({ start, end }) => onChange(parameter.key, { start, end })}
      />
    );
  }

  if (parameter.type === "date") {
    return (
      <FilterDateField
        label={parameter.label}
        mode="single"
        value={value ?? ""}
        onChange={(nextValue) => onChange(parameter.key, nextValue)}
      />
    );
  }

  const inputClassName =
    "w-full min-w-0 border-none bg-transparent p-0 text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]";

  if (parameter.type === "select") {
    // Build option objects: first option (null value) acts as "show all"
    const optionObjects = parameter.options.map((label, i) => ({
      value: parameter.optionValues?.[i] == null ? ALL_VALUE : String(parameter.optionValues[i]),
      label,
    }));
    const currentValue = value != null ? String(value) : null;
    const selectedValues = currentValue && currentValue !== ALL_VALUE ? [currentValue] : [];

    return (
      <FilterDropdown
        label={parameter.label}
        options={optionObjects}
        selectedValues={selectedValues}
        selectionMode="single"
        onToggleOption={(nextValue) =>
          onChange(parameter.key, nextValue === ALL_VALUE ? null : nextValue)
        }
        onClear={() => onChange(parameter.key, null)}
        title={`Filtrar por ${parameter.label.toLowerCase()}`}
        showTriggerIcon={true}
        triggerClassName="min-h-[66px]"
        buttonHeightClassName="min-h-[66px]"
        menuOffsetClassName="top-[calc(100%+0.55rem)]"
        menuClassName="rounded-[18px]"
        renderSelection={({ label, selectedOptions }) => (
          <>
            <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {label}
            </span>
            <span className="mt-1 block truncate text-sm font-semibold text-[var(--text-primary)]">
              {selectedOptions[0]?.label ?? parameter.options[0]}
            </span>
          </>
        )}
        renderOptionDescription={(option) =>
          option.value === ALL_VALUE ? "Sin restriccion aplicada" : "Selecciona un valor"
        }
        renderOptionLeading={() => (
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
        )}
        getOptionClassName={(_, isActive) =>
          isActive
            ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
            : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"
        }
      />
    );
  }

  return (
    <label className="flex min-h-[66px] min-w-0 items-center gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 shadow-[var(--shadow-subtle)] transition focus-within:border-[var(--accent-strong)]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-panel)] text-[var(--accent-strong)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M11 19a8 8 0 1 1 5.3-14l4.2 4.2-1.4 1.4-4.2-4.2A6 6 0 1 0 17 11h2a8 8 0 0 1-8 8z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <span className="grid min-w-0 flex-1 gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {parameter.label}
        </span>
        <input
          type="search"
          value={value ?? ""}
          onChange={(event) => onChange(parameter.key, event.target.value)}
          placeholder={parameter.placeholder || ""}
          className={inputClassName}
        />
      </span>
    </label>
  );
}

function ReportCategorySection({ category, items, isCollapsed, onToggle, onOpen }) {
  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Categoria
          </p>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{category}</h3>
            <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-1 text-[0.72rem] font-semibold text-[var(--text-secondary)]">
              {items.length} informe{items.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <CollapseToggleButton
          isCollapsed={isCollapsed}
          onClick={onToggle}
          collapsedLabel="Expandir categoria"
          expandedLabel="Colapsar categoria"
        />
      </div>

      {!isCollapsed ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {items.map((report) => {
            const isAvailable = report.status === "active";
            return (
              <article
                key={report.report_code}
                className="flex h-full flex-col rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-panel-muted)] p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h4 className="text-base font-semibold text-[var(--text-primary)]">{report.name}</h4>
                  {!isAvailable && (
                    <span className="shrink-0 rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-1 text-[0.72rem] font-semibold text-[var(--text-muted)]">
                      No disponible
                    </span>
                  )}
                </div>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">{report.description}</p>
                <div className="mt-4 flex justify-center pt-4">
                  <SoftActionButton
                    disabled={!isAvailable}
                    onClick={() => isAvailable && onOpen(report.report_code)}
                  >
                    Ver informe
                  </SoftActionButton>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const [catalog, setCatalog] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);

  const [activeReportCode, setActiveReportCode] = useState(null);
  const [activeDefinition, setActiveDefinition] = useState(null);
  const [isDefinitionLoading, setIsDefinitionLoading] = useState(false);

  const [collapsedCategories, setCollapsedCategories] = useState(() =>
    CATEGORY_ORDER.reduce((acc, category, index) => {
      acc[category] = index !== 0;
      return acc;
    }, {})
  );
  const [isParamsCollapsed, setIsParamsCollapsed] = useState(true);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(true);
  const [reportParams, setReportParams] = useState({});
  const [reportResults, setReportResults] = useState({});
  const [reportVisibleFields, setReportVisibleFields] = useState({});
  const [executeError, setExecuteError] = useState(null);

  // Load catalog on mount
  useEffect(() => {
    let cancelled = false;
    setIsCatalogLoading(true);
    setCatalogError(null);
    getReportCatalog(true)
      .then((items) => {
        if (!cancelled) {
          setCatalog(items);
          setIsCatalogLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCatalogError(err.message || "No fue posible cargar el catalogo de reportes.");
          setIsCatalogLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Load definition when a report is opened
  useEffect(() => {
    if (!activeReportCode) return;
    let cancelled = false;
    setIsDefinitionLoading(true);
    setActiveDefinition(null);
    getReportDefinition(activeReportCode)
      .then((def) => {
        if (!cancelled) {
          const normalizedFilters = normalizeFilters(def.filters);
          setActiveDefinition({ ...def, normalizedFilters });
          setReportParams((curr) => ({
            ...curr,
            [activeReportCode]: curr[activeReportCode] ?? buildDefaultParams(normalizedFilters),
          }));
          setReportVisibleFields((curr) => ({
            ...curr,
            [activeReportCode]: curr[activeReportCode] ?? new Set(def.columns.filter((c) => c.visible !== false).map((c) => c.field)),
          }));
          setIsDefinitionLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsDefinitionLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeReportCode]);

  const groupedReports = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: catalog.filter((r) => r.category === category),
      })).filter((group) => group.items.length),
    [catalog]
  );

  const activeReport = useMemo(
    () => catalog.find((r) => r.report_code === activeReportCode) || null,
    [catalog, activeReportCode]
  );

  const visibleParameters = useMemo(
    () => (activeDefinition ? getVisibleParameters(activeDefinition.normalizedFilters) : []),
    [activeDefinition]
  );

  const activeParams = activeReportCode ? reportParams[activeReportCode] ?? {} : {};
  const activeResult = activeReportCode ? reportResults[activeReportCode] ?? null : null;
  const activeRows = activeResult?.rows ?? [];
  const activeColumns = activeResult?.columns ?? activeDefinition?.columns ?? [];
  const activeVisibleFields = activeReportCode ? reportVisibleFields[activeReportCode] ?? new Set() : new Set();

  const openReport = (reportCode) => {
    setActiveReportCode(reportCode);
    setIsParamsCollapsed(true);
    setIsResultsCollapsed(true);
    setExecuteError(null);
  };

  const closeReport = () => {
    setActiveReportCode(null);
    setActiveDefinition(null);
    setIsParamsCollapsed(true);
    setIsResultsCollapsed(true);
    setExecuteError(null);
  };

  const updateParam = (key, value) => {
    if (!activeReportCode) return;

    if (typeof value === "object" && value !== null && key.includes(":")) {
      const [startKey, endKey] = key.split(":");
      setReportParams((curr) => ({
        ...curr,
        [activeReportCode]: {
          ...(curr[activeReportCode] ?? {}),
          [startKey]: value.start,
          [endKey]: value.end,
        },
      }));
      return;
    }

    setReportParams((curr) => ({
      ...curr,
      [activeReportCode]: {
        ...(curr[activeReportCode] ?? {}),
        [key]: value,
      },
    }));
  };

  const runReport = async () => {
    if (!activeReport || !activeDefinition) return;

    const modalId = ModalManager.loading({ title: "Ejecutando informe...", showProgress: false });
    setExecuteError(null);

    try {
      const filters = buildApiFilters(activeParams, activeDefinition.normalizedFilters);
      const result = await executeReport(activeReport.report_code, filters, { page: 1, page_size: 50 });
      setReportResults((curr) => ({ ...curr, [activeReport.report_code]: result }));
      setIsResultsCollapsed(false);
    } catch (err) {
      const errorMessage = err?.detail?.error?.message || err?.message || "No fue posible ejecutar el reporte.";
      setExecuteError(errorMessage);
      setIsResultsCollapsed(false);
    } finally {
      ModalManager.close(modalId);
    }
  };

  const handleExport = () => {
    if (!activeReport || !activeRows.length || !activeColumns.length) return;

    const exportColumns = activeColumns.filter((c) => c.export !== false);
    const header = exportColumns.map((c) => c.label);
    const csvRows = activeRows.map((row) => exportColumns.map((c) => row[c.field] ?? ""));
    const filename = `${activeReport.name}_${new Date().toISOString().slice(0, 10)}.csv`;

    downloadRowsAsCsv({ filename, header, rows: csvRows });
  };

  const handleConfigureColumns = () => {
    if (!activeDefinition) return;

    const columns = activeDefinition.columns;
    const selectedFields = new Set(activeVisibleFields);

    const toggleField = (field) => {
      if (selectedFields.has(field)) {
        if (selectedFields.size === 1) return;
        selectedFields.delete(field);
      } else {
        selectedFields.add(field);
      }
      ModalManager.update(modalId, { content: renderColumnModalContent() });
    };

    const applyColumns = () => {
      setReportVisibleFields((curr) => ({
        ...curr,
        [activeReportCode]: new Set(selectedFields),
      }));
      ModalManager.close(modalId);
    };

    const renderColumnModalContent = () => (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {columns.map((col) => {
            const isSelected = selectedFields.has(col.field);
            return (
              <button
                key={col.field}
                type="button"
                onClick={() => toggleField(col.field)}
                className={`flex min-h-[108px] flex-col items-center justify-center gap-4 rounded-[18px] border p-4 text-center transition ${
                  isSelected
                    ? "border-[rgba(81,152,194,0.38)] bg-[rgba(81,152,194,0.12)] text-[var(--text-primary)] shadow-[0_10px_22px_rgba(81,152,194,0.12)]"
                    : "border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:border-[var(--accent-strong)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"
                }`}
                aria-pressed={isSelected}
              >
                <span className="block text-sm font-semibold leading-6 text-[var(--text-primary)]">
                  {col.label}
                </span>
                <span className="inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isSelected ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`} />
                  {isSelected ? "Visible" : "Oculta"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => ModalManager.close(modalId)}>
            Cancelar
          </Button>
          <SoftActionButton onClick={applyColumns}>
            Aplicar
          </SoftActionButton>
        </div>
      </div>
    );

    const modalId = ModalManager.custom({
      title: activeReport ? `Columnas de ${activeReport.name}` : "Configurar columnas",
      size: "md",
      showFooter: false,
      content: renderColumnModalContent(),
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-5">
      {!activeReport ? (
        <Panel wide className="grid gap-6">
          <PanelHeader eyebrow="Catalogo" title="Informes disponibles" />

          {isCatalogLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : catalogError ? (
            <div className="rounded-[20px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-8 text-sm text-[var(--danger)]">
              {catalogError}
            </div>
          ) : (
            <div className="grid gap-6">
              {groupedReports.map(({ category, items }, index) => (
                <div
                  key={category}
                  className={index > 0 ? "border-t border-[var(--border-color)] pt-6" : ""}
                >
                  <ReportCategorySection
                    category={category}
                    items={items}
                    isCollapsed={collapsedCategories[category]}
                    onToggle={() =>
                      setCollapsedCategories((curr) => ({
                        ...curr,
                        [category]: !curr[category],
                      }))
                    }
                    onOpen={openReport}
                  />
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <div className="grid gap-5">
          <Panel wide>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={closeReport}
                className="inline-flex h-[52px] w-[52px] min-w-[52px] items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-muted)] text-[var(--text-primary)]"
                title="Volver a menu informes"
                aria-label="Volver a menu informes"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                  <path
                    d="M14.5 5.5L8 12l6.5 6.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div>
                <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Visualizacion de informe
                </p>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{activeReport.name}</h3>
                <p className="mt-2 max-w-[760px] text-sm leading-7 text-[var(--text-secondary)]">
                  {activeReport.description}
                </p>
              </div>
            </div>
          </Panel>

          {isDefinitionLoading ? (
            <Panel wide>
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            </Panel>
          ) : (
            <>
              <Panel wide>
                <PanelHeader
                  eyebrow="Parametros"
                  title="Configuracion del informe"
                  actions={
                    <>
                      <SoftActionButton onClick={runReport} disabled={!activeDefinition}>
                        Cargar datos
                      </SoftActionButton>
                      <CollapseToggleButton
                        isCollapsed={isParamsCollapsed}
                        onClick={() => setIsParamsCollapsed((curr) => !curr)}
                        collapsedLabel="Expandir parametros"
                        expandedLabel="Colapsar parametros"
                      />
                    </>
                  }
                />

                {!isParamsCollapsed && activeDefinition ? (
                  <form className={`grid gap-4 ${getFormColumnClass(visibleParameters.length)}`}>
                    {visibleParameters.map((parameter) => (
                      <ReportParameterField
                        key={parameter.key}
                        parameter={parameter}
                        value={
                          parameter.type === "date-range"
                            ? {
                                start: activeParams[parameter.startKey],
                                end: activeParams[parameter.endKey],
                              }
                            : activeParams[parameter.key]
                        }
                        onChange={updateParam}
                      />
                    ))}
                  </form>
                ) : null}
              </Panel>

              <Panel wide>
                <PanelHeader
                  eyebrow="Datos"
                  title="Resultado del informe"
                  actions={
                    <>
                      <ReportIconButton
                        title="Seleccionar columnas"
                        disabled={!activeDefinition}
                        onClick={handleConfigureColumns}
                      >
                        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" aria-hidden="true">
                          <path
                            d="M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M12 16v4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </ReportIconButton>
                      <ReportIconButton
                        title="Descargar datos"
                        disabled={!activeRows.length}
                        onClick={handleExport}
                      >
                        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" aria-hidden="true">
                          <path
                            d="M12 4v10M8 10l4 4 4-4M5 19h14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </ReportIconButton>
                      <CollapseToggleButton
                        isCollapsed={isResultsCollapsed}
                        onClick={() => setIsResultsCollapsed((curr) => !curr)}
                        collapsedLabel="Expandir resultados"
                        expandedLabel="Colapsar resultados"
                      />
                    </>
                  }
                />

                {!isResultsCollapsed ? (
                  executeError ? (
                    <div className="rounded-[20px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-8 text-sm text-[var(--danger)]">
                      {executeError}
                    </div>
                  ) : activeRows.length ? (
                    <div className="overflow-hidden rounded-[20px] border border-[var(--border-color)]">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-[var(--bg-app)] text-[var(--text-muted)]">
                            <tr>
                              {activeColumns
                                .filter((col) => activeVisibleFields.has(col.field))
                                .map((col) => (
                                  <th key={col.field} className="px-5 py-4 font-semibold uppercase tracking-[0.06em]">
                                    {col.label}
                                  </th>
                                ))}
                            </tr>
                          </thead>
                          <tbody>
                            {activeRows.map((row, rowIndex) => (
                              <tr
                                key={`${activeReportCode}-${rowIndex}`}
                                className="border-t border-[var(--border-color)]"
                              >
                                {activeColumns
                                  .filter((col) => activeVisibleFields.has(col.field))
                                  .map((col) => (
                                    <td
                                      key={col.field}
                                      className="px-5 py-4 text-[var(--text-secondary)]"
                                    >
                                      {row[col.field] ?? "-"}
                                    </td>
                                  ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : activeResult === null ? (
                    <div className="rounded-[20px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-8 text-sm text-[var(--text-secondary)]">
                      Configura los parametros y pulsa &ldquo;Cargar datos&rdquo; para visualizar el listado.
                    </div>
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-8 text-sm text-[var(--text-secondary)]">
                      Sin resultados para los filtros aplicados.
                    </div>
                  )
                ) : null}
              </Panel>
            </>
          )}
        </div>
      )}
    </div>
  );
}
