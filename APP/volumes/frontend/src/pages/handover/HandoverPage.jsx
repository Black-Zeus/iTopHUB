import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalManager from "../../components/ui/modal";
import { DataTable, FilterDropdown, KpiCard, Panel, PanelHeader } from "../../components/ui/general";
import { SearchFilterInput } from "../../components/ui/general/SearchFilterInput";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Icon } from "../../components/ui/icon/Icon";
import { Button } from "../../ui/Button";
import {
  getHandoverBootstrap,
  listHandoverDocuments,
  updateHandoverDocumentStatus,
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
    header: ["Acta", "Destinatario", "Cargo", "Activos", "Fecha", "Estado", "Responsable"],
    rows: rows.map((row) => [
      row.code || "",
      row.person || "",
      row.role || "",
      row.asset || "",
      row.date || "",
      row.status || "",
      row.ownerName || "",
    ]),
  });
}

export function HandoverPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState({ query: "", status: "" });
  const [catalog, setCatalog] = useState({ statusOptions: [] });
  const [actionConfig, setActionConfig] = useState({ allowEvidenceUpload: true });

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
      });
      setActionConfig({
        allowEvidenceUpload: Boolean(bootstrap?.actions?.allowEvidenceUpload ?? true),
      });
    } catch (loadError) {
      setError(loadError.message || "No fue posible preparar el modulo.");
    }
  };

  useEffect(() => {
    loadCatalog();
    loadDocuments({ query: "", status: "" });
  }, []);

  const handleFilterSubmit = async (event) => {
    event.preventDefault();
    setNotice("");
    await loadDocuments(filters);
  };

  const handleProcess = async (row) => {
    const modalId = ModalManager.custom({
      title: `Procesar ${row.code}`,
      size: "medium",
      showFooter: false,
      content: (
        <div className="grid gap-5">
          <p className="text-sm text-[var(--text-secondary)]">
            Este flujo quedara a cargo de la generacion PDF del documento. Por ahora se deja listo el modal y el cambio de estado operacional.
          </p>
          <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4 text-sm text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">{row.code}</p>
            <p className="mt-2">Al confirmar, el acta cambiara desde <strong>En creacion</strong> a <strong>Emitida</strong>.</p>
            <p className="mt-2">La generacion y descarga real del PDF quedara conectada en una siguiente etapa.</p>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="secondary" onClick={() => ModalManager.close(modalId)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await updateHandoverDocumentStatus(row.id, "Emitida");
                  ModalManager.close(modalId);
                  setNotice(`El acta ${row.code} quedo en estado Emitida.`);
                  setError("");
                  await loadDocuments(filters);
                } catch (processError) {
                  ModalManager.error({
                    title: "No fue posible procesar el acta",
                    message: processError.message || "Ocurrio un error al cambiar el estado.",
                  });
                }
              }}
            >
              Procesar
            </Button>
          </div>
        </div>
      ),
    });
  };

  const handleCancel = async (row) => {
    const confirmed = await ModalManager.confirm({
      title: "Anular acta",
      message: `Se anulara ${row.code}.`,
      content: "Confirma para marcar esta acta como anulada. El cambio quedara persistido en el Hub.",
      buttons: { cancel: "Cancelar", confirm: "Anular" },
    });

    if (!confirmed) {
      return;
    }

    try {
      await updateHandoverDocumentStatus(row.id, "Anulada");
      setNotice(`El acta ${row.code} fue anulada.`);
      setError("");
      await loadDocuments(filters);
    } catch (cancelError) {
      setError(cancelError.message || "No fue posible anular el acta.");
    }
  };

  const openPdfModal = (row) => {
    ModalManager.info({
      title: `PDF ${row.code}`,
      message: "La descarga PDF real aun no esta conectada.",
      content: "Este boton queda reservado para descargar la version PDF generada del documento cuando se integre el pipeline documental.",
    });
  };

  const openEvidenceModal = (row) => {
    const modalId = ModalManager.custom({
      title: `Cargar evidencia ${row.code}`,
      size: "medium",
      showFooter: false,
      content: (
        <div className="grid gap-5">
          <p className="text-sm text-[var(--text-secondary)]">
            Este flujo quedara reservado para cargar manualmente el PDF firmado o documento final de respaldo cuando el archivo aun no venga generado desde el Hub.
          </p>
          <div className="rounded-[18px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] p-5 text-sm text-[var(--text-secondary)]">
            Placeholder de carga manual de evidencia PDF.
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => ModalManager.close(modalId)}>
              Cerrar
            </Button>
          </div>
        </div>
      ),
    });
  };

  const tableColumns = [
    { key: "code", label: "Acta", sortable: true },
    { key: "person", label: "Destinatario", sortable: true },
    { key: "role", label: "Cargo", sortable: true },
    { key: "asset", label: "Activos" },
    { key: "date", label: "Fecha", sortable: true },
    { key: "status", label: "Estado", render: (value) => <StatusChip status={value} /> },
    {
      key: "actions",
      label: "Acciones",
      headerClassName: "w-[19rem] min-w-[19rem] text-right",
      cellClassName: "w-[19rem] min-w-[19rem] text-right",
      render: (_, row) => (
        <div className="flex max-w-[19rem] flex-wrap items-center justify-end gap-1.5 ml-auto">
          <Button size="sm" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => navigate(`/handover/${row.id}`)}>
            <Icon name="edit" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Editar
          </Button>
          {row.status === "En creacion" ? (
            <Button size="sm" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => handleProcess(row)}>
              <Icon name="check" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Procesar
            </Button>
          ) : null}
          {row.status !== "Anulada" ? (
            <Button size="sm" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => handleCancel(row)}>
              <Icon name="xmark" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Anular
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => openPdfModal(row)}>
            <Icon name="download" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            PDF
          </Button>
          {actionConfig.allowEvidenceUpload ? (
            <Button size="sm" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => openEvidenceModal(row)}>
              <Icon name="paperclip" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Cargar evidencia
            </Button>
          ) : null}
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
                <div className="min-w-0 xl:col-span-3">
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
