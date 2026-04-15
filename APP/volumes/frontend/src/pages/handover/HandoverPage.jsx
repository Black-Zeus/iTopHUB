import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, FilterDropdown, KpiCard, Panel, PanelHeader } from "../../components/ui/general";
import { SearchFilterInput } from "../../components/ui/general/SearchFilterInput";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Icon } from "../../components/ui/icon/Icon";
import { Button } from "../../ui/Button";
import {
  getHandoverBootstrap,
  getHandoverDocument,
  listHandoverDocuments,
} from "../../services/handover-service";
import { downloadRowsAsCsv } from "../../utils/export-csv";
import { MessageBanner } from "./handover-editor-shared";

const HANDOVER_FILTER_CONTROL_HEIGHT = "h-[66px]";

function buildKpis(rows) {
  const draftCount = rows.filter((row) => row.status === "En creacion").length;
  const issuedCount = rows.filter((row) => row.status === "Emitida").length;
  const confirmedCount = rows.filter((row) => row.status === "Confirmada").length;

  return [
    {
      label: "Total actas",
      value: String(rows.length).padStart(2, "0"),
      helper: "Registros guardados",
      tone: "default",
    },
    {
      label: "En creacion",
      value: String(draftCount).padStart(2, "0"),
      helper: "Pendientes de cierre",
      tone: "warning",
    },
    {
      label: "Emitidas",
      value: String(issuedCount).padStart(2, "0"),
      helper: "En circulacion",
      tone: "default",
    },
    {
      label: "Confirmadas",
      value: String(confirmedCount).padStart(2, "0"),
      helper: "Cierre completo",
      tone: "success",
    },
  ];
}

function renderHandoverFilterSelection({ label, selectedOptions }) {
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

function getHandoverFilterOptionClassName(_, isActive) {
  return isActive
    ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
    : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]";
}

function downloadListCsv(rows) {
  downloadRowsAsCsv({
    filename: "actas_entrega.csv",
    header: ["Acta", "Destinatario", "Cargo", "Activos", "Fecha", "Estado", "Tipo", "Responsable"],
    rows: rows.map((row) => [
      row.code || "",
      row.person || "",
      row.role || "",
      row.asset || "",
      row.date || "",
      row.status || "",
      row.handoverType || "",
      row.ownerName || "",
    ]),
  });
}

function formatDocumentBackup(document) {
  const lines = [
    `Acta: ${document.documentNumber || ""}`,
    `Fecha emision: ${document.generatedAt || ""}`,
    `Estado: ${document.status || ""}`,
    `Tipo entrega: ${document.handoverType || ""}`,
    `Responsable: ${document.owner?.name || ""}`,
    "",
    "Destinatario",
    `- Codigo: ${document.receiver?.code || ""}`,
    `- Nombre: ${document.receiver?.name || ""}`,
    `- Email: ${document.receiver?.email || ""}`,
    `- Telefono: ${document.receiver?.phone || ""}`,
    `- Cargo: ${document.receiver?.role || ""}`,
    `- Estado: ${document.receiver?.status || ""}`,
    "",
    "Motivo",
    document.reason || "",
    "",
    "Observacion",
    document.notes || "",
    "",
    "Activos",
  ];

  document.items.forEach((item, itemIndex) => {
    lines.push(`${itemIndex + 1}. ${item.asset?.code || ""} - ${item.asset?.name || ""}`);
    lines.push(`   Clase: ${item.asset?.className || ""}`);
    lines.push(`   Marca / Modelo: ${[item.asset?.brand, item.asset?.model].filter(Boolean).join(" / ")}`);
    lines.push(`   Serie: ${item.asset?.serial || ""}`);
    lines.push(`   Estado: ${item.asset?.status || ""}`);
    lines.push(`   Asignado en CMDB: ${item.asset?.assignedUser || ""}`);
    if (item.notes) {
      lines.push(`   Nota item: ${item.notes}`);
    }

    if (!item.checklists?.length) {
      lines.push("   Checklists: sin checklist aplicado");
    } else {
      lines.push("   Checklists:");
      item.checklists.forEach((checklist) => {
        lines.push(`   - ${checklist.templateName}`);
        checklist.answers.forEach((answer) => {
          const renderedValue = answer.type === "Check" ? (answer.value ? "Si" : "No") : (answer.value || "");
          lines.push(`     * ${answer.name}: ${renderedValue}`);
        });
      });
    }
    lines.push("");
  });

  return lines.join("\n");
}

function downloadDocumentBackup(documentDetail) {
  const blob = new Blob([formatDocumentBackup(documentDetail)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `${documentDetail.documentNumber || "acta-entrega"}.txt`;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function HandoverPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState({ query: "", status: "", handoverType: "" });
  const [catalog, setCatalog] = useState({ statusOptions: [], typeOptions: [] });

  const kpis = useMemo(() => buildKpis(rows), [rows]);

  const loadDocuments = async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const payload = await listHandoverDocuments(nextFilters);
      setRows(payload.items || []);
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar las actas de entrega.");
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async () => {
    try {
      const bootstrap = await getHandoverBootstrap();
      setCatalog({
        statusOptions: bootstrap?.statusOptions || [],
        typeOptions: bootstrap?.typeOptions || [],
      });
    } catch (loadError) {
      setError(loadError.message || "No fue posible preparar el modulo.");
    }
  };

  useEffect(() => {
    loadCatalog();
    loadDocuments({ query: "", status: "", handoverType: "" });
  }, []);

  const handleFilterSubmit = async (event) => {
    event.preventDefault();
    setNotice("");
    await loadDocuments(filters);
  };

  const handleDownload = async (documentId) => {
    setError("");
    try {
      const detail = await getHandoverDocument(documentId);
      downloadDocumentBackup(detail);
    } catch (downloadError) {
      setError(downloadError.message || "No fue posible descargar el respaldo del acta.");
    }
  };

  const tableColumns = [
    { key: "code", label: "Acta", sortable: true },
    { key: "person", label: "Destinatario", sortable: true },
    { key: "role", label: "Cargo", sortable: true },
    { key: "asset", label: "Activos" },
    { key: "date", label: "Fecha", sortable: true },
    { key: "status", label: "Estado", render: (value) => <StatusChip status={value} /> },
    { key: "handoverType", label: "Tipo", sortable: true },
    {
      key: "actions",
      label: "Acciones",
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate(`/handover/${row.id}`)}>
            <Icon name="edit" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Editar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => handleDownload(row.id)}>
            <Icon name="download" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Respaldo
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {error ? <MessageBanner tone="danger">{error}</MessageBanner> : null}
      {notice ? <MessageBanner tone="success">{notice}</MessageBanner> : null}

      <Panel>
        <PanelHeader eyebrow="Operacion" title="Filtros Actas de Entrega" />
        <form className="grid gap-4" onSubmit={handleFilterSubmit}>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="grid gap-3">
              <div className="grid gap-3 xl:grid-cols-4">
                <div className="min-w-0 xl:col-span-2">
                  <SearchFilterInput
                    value={filters.query}
                    placeholder="Buscar por acta, colaborador o activo entregado"
                    onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                  />
                </div>

                <div className="min-w-0">
                  <FilterDropdown
                    label="Estado"
                    selectedValues={filters.status ? [filters.status] : []}
                    options={[
                      { value: "all", label: "Todos" },
                      ...catalog.statusOptions,
                    ]}
                    selectionMode="single"
                    onToggleOption={(value) => setFilters((current) => ({ ...current, status: value === "all" ? "" : value }))}
                    onClear={() => setFilters((current) => ({ ...current, status: "" }))}
                    triggerClassName="py-3"
                    buttonHeightClassName={HANDOVER_FILTER_CONTROL_HEIGHT}
                    menuOffsetClassName="top-[calc(100%+0.55rem)]"
                    menuClassName="rounded-[18px]"
                    renderSelection={renderHandoverFilterSelection}
                    renderOptionLeading={() => (
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
                    )}
                    renderOptionDescription={(option) =>
                      option.value === "all" ? "Sin restriccion aplicada" : "Selecciona un estado"
                    }
                    getOptionClassName={getHandoverFilterOptionClassName}
                  />
                </div>

                <div className="min-w-0">
                  <FilterDropdown
                    label="Tipo de entrega"
                    selectedValues={filters.handoverType ? [filters.handoverType] : []}
                    options={[
                      { value: "all", label: "Todos" },
                      ...catalog.typeOptions,
                    ]}
                    selectionMode="single"
                    onToggleOption={(value) => setFilters((current) => ({ ...current, handoverType: value === "all" ? "" : value }))}
                    onClear={() => setFilters((current) => ({ ...current, handoverType: "" }))}
                    triggerClassName="py-3"
                    buttonHeightClassName={HANDOVER_FILTER_CONTROL_HEIGHT}
                    menuOffsetClassName="top-[calc(100%+0.55rem)]"
                    menuClassName="rounded-[18px]"
                    renderSelection={renderHandoverFilterSelection}
                    renderOptionLeading={() => (
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
                    )}
                    renderOptionDescription={(option) =>
                      option.value === "all" ? "Sin restriccion aplicada" : "Selecciona un tipo"
                    }
                    getOptionClassName={getHandoverFilterOptionClassName}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-3 xl:w-[12rem]">
              <Button
                type="submit"
                variant="primary"
                className={`${HANDOVER_FILTER_CONTROL_HEIGHT} w-full`}
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

      <Panel>
        <PanelHeader
          eyebrow="Operacion"
          title="Listado de Actas de Entrega"
          actions={(
            <>
              {rows.length ? (
                <Button variant="secondary" onClick={() => downloadListCsv(rows)}>
                  <Icon name="download" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Descargar Excel
                </Button>
              ) : null}
              <Button variant="primary" onClick={() => navigate("/handover/nueva")}>
                <Icon name="plus" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Nueva acta
              </Button>
            </>
          )}
        />

        <DataTable columns={tableColumns} rows={rows} loading={loading} emptyMessage="No hay actas de entrega registradas con los filtros actuales." />
      </Panel>
    </div>
  );
}
