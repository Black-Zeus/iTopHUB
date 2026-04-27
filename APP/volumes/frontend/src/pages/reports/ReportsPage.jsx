import { useEffect, useMemo, useState } from "react";
import { FilterDateField } from "../../components/ui/general/FilterDateField";
import { FilterDropdown } from "../../components/ui/general/FilterDropdown";
import { Panel, PanelHeader } from "../../components/ui/general/Panel";
import { SoftActionButton } from "../../components/ui/general/SoftActionButton";
import { CollapseToggleButton } from "../../components/ui/general/CollapseToggleButton";
import { SearchFilterInput } from "../../components/ui/general/SearchFilterInput";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Button } from "../../ui/Button";
import { Spinner } from "../../ui/Spinner";
import ModalManager from "../../components/ui/modal";
import {
  downloadReportCsv,
  executeReport,
  getReportCatalog,
  getReportDefinition,
} from "../../services/reports-service";

const CATEGORY_ORDER = [
  "Inventario",
  "Asignacion",
  "Movimientos",
  "Laboratorio",
  "Documental",
  "Renovacion",
  "Calidad CMDB",
];

const ALL_VALUE = "__all__";
const DEFAULT_PAGE_SIZE = 100;

function getDateOffset(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

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

function buildApiFilters(params, normalizedFilters) {
  const result = {};
  for (const f of normalizedFilters) {
    const rawValue = params[f.key];
    const val = typeof rawValue === "string" ? rawValue.trim() : rawValue;
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

function ViewToggleButton({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] border transition ${
        active
          ? "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          : "border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
      }`}
    >
      {children}
    </button>
  );
}

function TagChip({ tag, active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(tag)}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-semibold transition ${
        active
          ? "border border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          : "border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
      }`}
    >
      {tag}
    </button>
  );
}

function TablePaginator({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-[var(--border-color)] px-5 py-3">
      <span className="text-[0.78rem] text-[var(--text-muted)]">
        {total > 0 ? `${start}–${end} de ${total} registros` : "Sin registros"}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 text-[0.78rem] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Anterior
        </button>
        <span className="min-w-[80px] text-center text-[0.78rem] text-[var(--text-secondary)]">
          Página {page} de {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 text-[0.78rem] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente →
        </button>
      </div>
    </div>
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

function ReportCard({ report, onOpen, onTagClick, activeTagFilters }) {
  return (
    <article className="flex h-full flex-col rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-panel-muted)] p-5">
      <div className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
        {report.category}
      </div>
      <h4 className="mb-3 text-base font-semibold leading-snug text-[var(--text-primary)]">
        {report.name}
      </h4>
      <p className="flex-1 text-sm leading-6 text-[var(--text-secondary)]">{report.description}</p>

      {Array.isArray(report.tags) && report.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {report.tags.map((tag) => (
            <TagChip
              key={tag}
              tag={tag}
              active={activeTagFilters.has(tag)}
              onClick={onTagClick}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-center pt-4" style={{ marginTop: "auto", paddingTop: "1rem" }}>
        <SoftActionButton onClick={() => onOpen(report.report_code)}>
          Ver informe
        </SoftActionButton>
      </div>
    </article>
  );
}

function ReportCategorySection({
  category,
  items,
  isCollapsed,
  onToggle,
  onOpen,
  onTagClick,
  activeTagFilters,
}) {
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

      {!isCollapsed && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {items.map((report) => (
            <ReportCard
              key={report.report_code}
              report={report}
              onOpen={onOpen}
              onTagClick={onTagClick}
              activeTagFilters={activeTagFilters}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const [catalog, setCatalog] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTagFilters, setActiveTagFilters] = useState(new Set());
  const [viewMode, setViewMode] = useState("grouped");
  const [collapsedCategories, setCollapsedCategories] = useState(() =>
    CATEGORY_ORDER.reduce((acc, category, index) => {
      acc[category] = index !== 0;
      return acc;
    }, {})
  );

  const [activeReportCode, setActiveReportCode] = useState(null);
  const [activeDefinition, setActiveDefinition] = useState(null);
  const [isDefinitionLoading, setIsDefinitionLoading] = useState(false);

  const [isParamsCollapsed, setIsParamsCollapsed] = useState(true);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(true);
  const [reportParams, setReportParams] = useState({});
  const [reportResults, setReportResults] = useState({});
  const [reportVisibleFields, setReportVisibleFields] = useState({});
  const [reportPaginations, setReportPaginations] = useState({});
  const [executeError, setExecuteError] = useState(null);

  // Load catalog on mount — only active / available reports
  useEffect(() => {
    let cancelled = false;
    setIsCatalogLoading(true);
    setCatalogError(null);
    getReportCatalog(false)
      .then((items) => {
        if (!cancelled) {
          setCatalog(items.filter((r) => r.available !== false));
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
          const pageSize =
            def.output?.table?.pagination?.default_page_size ?? DEFAULT_PAGE_SIZE;
          setActiveDefinition({ ...def, normalizedFilters, pageSize });
          setReportParams((curr) => ({
            ...curr,
            [activeReportCode]: curr[activeReportCode] ?? buildDefaultParams(normalizedFilters),
          }));
          setReportVisibleFields((curr) => ({
            ...curr,
            [activeReportCode]:
              curr[activeReportCode] ??
              new Set(
                def.columns.filter((c) => c.visible !== false).map((c) => c.field)
              ),
          }));
          setReportPaginations((curr) => ({
            ...curr,
            [activeReportCode]: curr[activeReportCode] ?? { page: 1, page_size: pageSize },
          }));
          setIsDefinitionLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsDefinitionLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeReportCode]);

  // ── Derived values ──────────────────────────────────────────────────────────

  const allTags = useMemo(() => {
    const set = new Set();
    catalog.forEach((r) => (r.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalog.filter((r) => {
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q);
      const matchesTags =
        activeTagFilters.size === 0 ||
        (r.tags || []).some((t) => activeTagFilters.has(t));
      return matchesSearch && matchesTags;
    });
  }, [catalog, searchQuery, activeTagFilters]);

  const groupedFiltered = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: filteredCatalog.filter((r) => r.category === category),
      })).filter((g) => g.items.length > 0),
    [filteredCatalog]
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
  const activeVisibleFields = activeReportCode
    ? reportVisibleFields[activeReportCode] ?? new Set()
    : new Set();
  const activePagination = activeReportCode
    ? reportPaginations[activeReportCode] ?? { page: 1, page_size: DEFAULT_PAGE_SIZE }
    : { page: 1, page_size: DEFAULT_PAGE_SIZE };
  const activeTotal = activeResult?.total ?? 0;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const toggleTagFilter = (tag) => {
    setActiveTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

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
      [activeReportCode]: { ...(curr[activeReportCode] ?? {}), [key]: value },
    }));
  };

  const runReport = async (pageOverride) => {
    if (!activeReport || !activeDefinition) return;
    const pageSize = activePagination.page_size;
    const page = pageOverride ?? 1;

    const modalId = ModalManager.loading({ title: "Ejecutando informe...", showProgress: false });
    setExecuteError(null);

    try {
      const filters = buildApiFilters(activeParams, activeDefinition.normalizedFilters);
      const result = await executeReport(activeReport.report_code, filters, { page, page_size: pageSize });
      setReportResults((curr) => ({ ...curr, [activeReport.report_code]: result }));
      setReportPaginations((curr) => ({
        ...curr,
        [activeReport.report_code]: { page, page_size: pageSize },
      }));
      setIsResultsCollapsed(false);
    } catch (err) {
      const errorMessage =
        err?.detail?.error?.message || err?.message || "No fue posible ejecutar el reporte.";
      setExecuteError(errorMessage);
      setIsResultsCollapsed(false);
    } finally {
      ModalManager.close(modalId);
    }
  };

  const handleExport = async () => {
    if (!activeReport || !activeDefinition) return;
    const modalId = ModalManager.loading({ title: "Preparando exportacion...", showProgress: false });
    try {
      const filters = buildApiFilters(activeParams, activeDefinition.normalizedFilters);
      await downloadReportCsv(activeReport.report_code, filters);
    } catch (err) {
      const msg = err?.message || "No fue posible exportar el reporte.";
      setExecuteError(msg);
    } finally {
      ModalManager.close(modalId);
    }
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
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${
                      isSelected ? "bg-[var(--success)]" : "bg-[var(--danger)]"
                    }`}
                  />
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
          <SoftActionButton onClick={applyColumns}>Aplicar</SoftActionButton>
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
          <div className="flex items-start justify-between gap-4">
            <PanelHeader eyebrow="Catalogo" title="Informes disponibles" />
            <div className="flex items-center gap-2 pt-1">
              <ViewToggleButton
                active={viewMode === "grouped"}
                onClick={() => setViewMode("grouped")}
                title="Vista agrupada"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 6h16M4 10h16M4 14h10M4 18h10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </ViewToggleButton>
              <ViewToggleButton
                active={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
                title="Vista cuadricula"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M3 3h7v7H3zm0 11h7v7H3zm11-11h7v7h-7zm0 11h7v7h-7z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </ViewToggleButton>
            </div>
          </div>

          {/* Filter bar */}
          {!isCatalogLoading && !catalogError && catalog.length > 0 && (
            <div className="grid gap-3">
              <SearchFilterInput
                value={searchQuery}
                placeholder="Buscar por nombre o descripcion..."
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => (
                    <TagChip
                      key={tag}
                      tag={tag}
                      active={activeTagFilters.has(tag)}
                      onClick={toggleTagFilter}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {isCatalogLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : catalogError ? (
            <div className="rounded-[20px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-8 text-sm text-[var(--danger)]">
              {catalogError}
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-8 text-center text-sm text-[var(--text-muted)]">
              Sin informes para los filtros aplicados.
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {filteredCatalog.map((report) => (
                <ReportCard
                  key={report.report_code}
                  report={report}
                  onOpen={openReport}
                  onTagClick={toggleTagFilter}
                  activeTagFilters={activeTagFilters}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-6">
              {groupedFiltered.map(({ category, items }, index) => (
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
                    onTagClick={toggleTagFilter}
                    activeTagFilters={activeTagFilters}
                  />
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <div className="grid gap-5">
          {/* Report header */}
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
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {activeReport.name}
                </h3>
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
              {/* Parameters panel */}
              <Panel wide>
                <PanelHeader
                  eyebrow="Parametros"
                  title="Configuracion del informe"
                  actions={
                    <>
                      <SoftActionButton onClick={() => runReport()} disabled={!activeDefinition}>
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
                {!isParamsCollapsed && activeDefinition && (
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
                )}
              </Panel>

              {/* Results panel */}
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
                        title="Exportar todos los registros a CSV"
                        disabled={!activeDefinition}
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

                {!isResultsCollapsed && (
                  executeError ? (
                    <div className="rounded-[20px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-8 text-sm text-[var(--danger)]">
                      {executeError}
                    </div>
                  ) : activeResult === null ? (
                    <div className="rounded-[20px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-8 text-sm text-[var(--text-secondary)]">
                      Configura los parametros y pulsa &ldquo;Cargar datos&rdquo; para visualizar el listado.
                    </div>
                  ) : activeRows.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-8 text-sm text-[var(--text-secondary)]">
                      Sin resultados para los filtros aplicados.
                    </div>
                  ) : (
                    <>
                      <div className="overflow-hidden rounded-[20px] border border-[var(--border-color)]">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-[var(--bg-app)] text-[var(--text-muted)]">
                              <tr>
                                <th className="w-12 px-4 py-4 font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                                  #
                                </th>
                                {activeColumns
                                  .filter((col) => activeVisibleFields.has(col.field))
                                  .map((col) => (
                                    <th
                                      key={col.field}
                                      className={`px-5 py-4 font-semibold uppercase tracking-[0.06em] ${
                                        col.wide ? "min-w-[280px] w-full" : ""
                                      }`}
                                    >
                                      {col.label}
                                    </th>
                                  ))}
                              </tr>
                            </thead>
                            <tbody>
                              {activeRows.map((row, rowIndex) => {
                                const globalIndex =
                                  (activePagination.page - 1) * activePagination.page_size +
                                  rowIndex +
                                  1;
                                return (
                                  <tr
                                    key={`${activeReportCode}-${rowIndex}`}
                                    className="border-t border-[var(--border-color)]"
                                  >
                                    <td className="w-12 px-4 py-4 text-[var(--text-muted)] text-xs font-semibold">
                                      {globalIndex}
                                    </td>
                                    {activeColumns
                                      .filter((col) => activeVisibleFields.has(col.field))
                                      .map((col) => (
                                        <td
                                          key={col.field}
                                          className={`px-5 py-4 text-[var(--text-secondary)] ${
                                            col.wide
                                              ? "min-w-[280px] w-full whitespace-normal break-words"
                                              : ""
                                          }`}
                                        >
                                          {col.format === "badge" ? (
                                            <StatusChip status={row[col.field] ?? "-"} />
                                          ) : (
                                            row[col.field] ?? "-"
                                          )}
                                        </td>
                                      ))}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {activeTotal > activePagination.page_size && (
                          <TablePaginator
                            page={activePagination.page}
                            pageSize={activePagination.page_size}
                            total={activeTotal}
                            onPageChange={(newPage) => runReport(newPage)}
                          />
                        )}
                      </div>
                      <p className="mt-2 text-right text-[0.72rem] text-[var(--text-muted)]">
                        {activeTotal} registro{activeTotal === 1 ? "" : "s"} en total
                      </p>
                    </>
                  )
                )}
              </Panel>
            </>
          )}
        </div>
      )}
    </div>
  );
}
