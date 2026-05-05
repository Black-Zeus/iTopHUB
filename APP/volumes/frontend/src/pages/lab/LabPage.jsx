import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalManager from "../../components/ui/modal";
import { ActaPublicationModalContent, DataTable, FilterDropdown, KpiCard, Panel, PanelHeader } from "../../components/ui/general";
import { SearchFilterInput } from "../../components/ui/general/SearchFilterInput";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Icon } from "../../components/ui/icon/Icon";
import { Button } from "../../ui/Button";
import { useToast } from "../../ui";
import {
  cancelLabRecord,
  fetchLabDocumentBlob,
  finalizeLabClosure,
  getLabRecord,
  listLabRecords,
} from "../../services/lab-service";
import {
  getItopAssetDetail,
  getItopCurrentUserTeams,
  getItopRequirementCatalog,
  getItopTicketDefaults,
  searchItopTeamPeople,
  searchItopTeams,
} from "../../services/itop-service";
import { downloadRowsAsCsv } from "../../utils/export-csv";
import { LAB_REASON_OPTIONS, LAB_STATUS_OPTIONS, getReasonLabel } from "./lab-module-config";

const FILTER_CONTROL_HEIGHT = "h-[66px]";

const IN_LAB_CODES = ["in_execution", "ready_for_closure"];
const CLOSED_CODES = ["completed_return_to_stock", "completed_obsolete"];
const EDITABLE_CODES = ["draft", "in_execution", "ready_for_closure"];
const CANCELLABLE_CODES = [...EDITABLE_CODES, "pending_itop_sync"];

function buildKpis(rows) {
  return [
    {
      label: "Total actas",
      value: String(rows.length).padStart(2, "0"),
      helper: "Registros guardados",
      tone: "default",
      filterValue: "",
    },
    {
      label: "En creacion",
      value: String(rows.filter((r) => r.statusCode === "draft").length).padStart(2, "0"),
      helper: "Pendientes de inicio",
      tone: "warning",
      filterValue: "draft",
    },
    {
      label: "En laboratorio",
      value: String(rows.filter((r) => IN_LAB_CODES.includes(r.statusCode)).length).padStart(2, "0"),
      helper: "Trabajo en curso",
      tone: "accent",
      filterValue: "in_execution",
    },
    {
      label: "Sync iTop",
      value: String(rows.filter((r) => r.statusCode === "pending_itop_sync").length).padStart(2, "0"),
      helper: "Pendiente registro en iTop",
      tone: "warning",
      filterValue: "pending_itop_sync",
    },
    {
      label: "Cerradas",
      value: String(rows.filter((r) => CLOSED_CODES.includes(r.statusCode)).length).padStart(2, "0"),
      helper: "Completadas o derivadas",
      tone: "success",
      filterValue: "completed_return_to_stock",
    },
  ];
}

function chunkActions(actions = [], size = 3) {
  const rows = [];
  for (let index = 0; index < actions.length; index += size) {
    rows.push(actions.slice(index, index + size));
  }
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

function formatDate(isoDate) {
  if (!isoDate) return "—";
  try {
    return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(`${isoDate}T12:00:00`));
  } catch {
    return isoDate;
  }
}

function DocsModal({ row, onClose }) {
  const docs = [
    row.entryGeneratedDocument      && { ...row.entryGeneratedDocument,      phaseLabel: "Entrada" },
    row.processingGeneratedDocument && { ...row.processingGeneratedDocument, phaseLabel: "Procesamiento" },
    row.exitGeneratedDocument       && { ...row.exitGeneratedDocument,        phaseLabel: "Salida" },
  ].filter(Boolean);

  const [selected, setSelected] = useState(docs[0] || null);
  const [blobUrl, setBlobUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selected?.storedName) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    setBlobUrl("");
    fetchLabDocumentBlob(row.id, selected.storedName)
      .then(({ url, filename: fn }) => {
        if (!cancelled) { setBlobUrl(url); setFilename(fn); }
      })
      .catch((err) => { if (!cancelled) setError(err.message || "No fue posible cargar el documento."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [row.id, selected?.storedName]);

  return (
    <div className="grid gap-4">
      {docs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {docs.map((doc) => (
            <button
              key={doc.storedName}
              type="button"
              onClick={() => setSelected(doc)}
              className={`rounded-[10px] border px-3 py-1.5 text-xs font-semibold transition ${
                selected?.storedName === doc.storedName
                  ? "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
              }`}
            >
              {doc.phaseLabel}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex h-40 items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent-strong)] border-t-transparent" />
        </div>
      )}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {blobUrl && !loading && (
        <iframe
          src={blobUrl}
          title={filename}
          className="h-[520px] w-full rounded-[12px] border border-[var(--border-color)]"
        />
      )}

      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        {blobUrl && (
          <a href={blobUrl} download={filename}>
            <Button variant="primary">
              <Icon name="download" size={14} className="mr-1.5" />
              Descargar
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

function openDocsModal(row) {
  const modalId = ModalManager.custom({
    title: `Documentos — ${row.code}`,
    size: "pdfViewer",
    showFooter: false,
    content: <DocsModal row={row} onClose={() => ModalManager.close(modalId)} />,
  });
}

function normalizeTicketOptions(options = []) {
  return options
    .map((option) => ({
      ...option,
      value: String(option?.value ?? option?.id ?? "").trim(),
      label: String(option?.label ?? option?.name ?? option?.person ?? "").trim(),
    }))
    .filter((option) => option.value && option.label);
}

function buildAnalystOption(sessionUser) {
  const value = String(sessionUser?.itopPersonKey || sessionUser?.itopPersonId || "").trim();
  const label = String(sessionUser?.name || sessionUser?.username || "").trim();
  return value && label ? { value, label } : null;
}

function normalizeAnalystOptions(items = [], sessionUser = null, allowFallback = false) {
  const fallback = buildAnalystOption(sessionUser);
  const sessionKey = String(sessionUser?.itopPersonKey || sessionUser?.itopPersonId || "").trim();
  const sessionName = String(sessionUser?.name || sessionUser?.username || "").trim().toLowerCase();
  const options = normalizeTicketOptions(items.map((item) => ({
    ...item,
    value: item.id,
    label: item.person || item.name,
  }))).map((option) => ({
    ...option,
    isCurrent: Boolean(
      (sessionKey && option.value === sessionKey)
      || (sessionName && String(option.label || "").trim().toLowerCase() === sessionName)
    ),
  }));
  return options.length ? options : (allowFallback && fallback ? [{ ...fallback, isCurrent: true }] : []);
}

function findCurrentAnalystOption(options = [], sessionUser = null) {
  const normalizedOptions = normalizeTicketOptions(options);
  const personKey = String(sessionUser?.itopPersonKey || sessionUser?.itopPersonId || "").trim();
  if (personKey) {
    const byKey = normalizedOptions.find((option) => option.value === personKey);
    if (byKey) return byKey;
  }
  const sessionName = String(sessionUser?.name || sessionUser?.username || "").trim().toLowerCase();
  return normalizedOptions.find((option) => String(option.label || "").trim().toLowerCase() === sessionName) || null;
}

function normalizeLabAssetText(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveLabTicketAssetName(detail) {
  const invalidNames = new Set([
    detail?.assetAssignedUser,
    detail?.requesterAdmin?.name,
    detail?.ownerName,
    "Sin asignar",
  ].map(normalizeLabAssetText).filter(Boolean));
  const assetName = String(detail?.assetName || "").trim();
  if (assetName && !invalidNames.has(normalizeLabAssetText(assetName))) {
    return assetName;
  }
  return String(detail?.assetCode || assetName || "Activo CMDB").trim();
}

function resolveLabTicketAssetLabel(detail) {
  const assetName = resolveLabTicketAssetName(detail);
  const assetCode = String(detail?.assetCode || "").trim();
  if (assetCode && normalizeLabAssetText(assetCode) !== normalizeLabAssetText(assetName)) {
    return `${assetCode} / ${assetName}`;
  }
  return assetName || "Sin activo";
}

async function enrichLabDetailWithItopAsset(detail) {
  const assetId = String(detail?.assetItopId || "").trim();
  if (!assetId) return detail;
  try {
    const asset = await getItopAssetDetail(assetId);
    if (!asset) return detail;
    return {
      ...detail,
      assetCode: asset.code || detail?.assetCode,
      assetName: asset.name || detail?.assetName,
      assetClass: asset.className || detail?.assetClass,
      assetSerial: asset.serial || detail?.assetSerial,
      assetStatus: asset.status || detail?.assetStatus,
      assetAssignedUser: asset.assignedUser || detail?.assetAssignedUser,
    };
  } catch {
    return detail;
  }
}

function buildLabTicketDescription(detail) {
  const requestedActions = (detail?.requestedActionLabels || []).join(", ");
  const lines = [
    `Acta: ${detail?.code || ""}`,
    `Activo: ${resolveLabTicketAssetLabel(detail)}`,
    `Motivo principal: ${detail?.reasonLabel || detail?.reason || "Sin detalle"}`,
    `Acciones solicitadas: ${requestedActions || "Sin detalle"}`,
    `Estado base / condicion: ${detail?.entryConditionNotes || "Sin detalle"}`,
    `Observaciones de ingreso: ${detail?.entryObservations || "Sin observaciones"}`,
    `Notas recibidas: ${detail?.entryReceivedNotes || "Sin notas"}`,
    `Observaciones de ejecucion: ${detail?.processingObservations || "Sin observaciones"}`,
    `Trabajo realizado: ${detail?.workPerformed || "Sin detalle"}`,
    `Observaciones de cierre: ${detail?.exitObservations || "Sin observaciones"}`,
  ];
  if (detail?.exitFinalState && detail.exitFinalState !== "no_change") {
    lines.push(`Derivacion a normalizacion: cambio de estado CMDB a ${detail.exitFinalState}.`);
    if (detail?.obsoleteNotes) lines.push(`Justificacion: ${detail.obsoleteNotes}`);
  }
  return lines.join("\n");
}

function buildLabTicketSubject(detail) {
  const assetName = resolveLabTicketAssetName(detail);
  return `Registro Movimiento de Inventario // Laboratorio de Activo // ${assetName || "Activo CMDB"}`;
}

function buildLabPublicationDocuments(detail) {
  return [
    { documentType: "Recepcion", document: detail?.entryGeneratedDocument },
    { documentType: "Procesamiento", document: detail?.processingGeneratedDocument },
    { documentType: "Cierre", document: detail?.exitGeneratedDocument },
  ].filter((item) => item.document?.storedName).map((item) => ({
    id: item.document.storedName,
    name: item.document.filename || item.document.storedName,
    documentType: item.documentType,
    uploadedAt: item.document.generatedAt || "",
    origin: "generated",
    iconName: "fileLines",
    isAvailable: true,
    payload: item.document,
  }));
}

export function LabPage() {
  const navigate = useNavigate();
  const { add } = useToast();
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

  const handleCancelRecord = async (row) => {
    const confirmed = await ModalManager.confirm({
      title: "Anular acta",
      message: `¿Confirmas la anulación del acta ${row.code}?`,
      content: "Esta acción es irreversible. El acta quedará marcada como Anulada y no podrá continuar el flujo de laboratorio.",
      buttons: { cancel: "Cancelar", confirm: "Anular acta" },
    });
    if (!confirmed) return;

    const cancelLoadingId = ModalManager.loading({
      title: "Anulando acta",
      message: `Procesando anulación de ${row.code}...`,
      showProgress: false,
      showCancel: false,
    });
    try {
      await cancelLabRecord(row.id);
      add({ title: "Acta anulada", description: `El acta ${row.code} fue anulada correctamente.`, tone: "success" });
      await loadRecords(filters);
    } catch (cancelError) {
      ModalManager.error({
        title: "No fue posible anular el acta",
        message: cancelError.message || "Ocurrió un error al intentar anular el acta.",
      });
    } finally {
      ModalManager.close(cancelLoadingId);
    }
  };

  const openLabTicketPublicationFlow = async ({ row, detail, onSuccess }) => {
    const loadingModalId = ModalManager.loading({
      title: "Preparando ticket iTop",
      message: "Cargando configuracion, catalogos y grupos del usuario conectado...",
      showProgress: false,
      showCancel: false,
    });
    try {
      const [ticketConfig, catalogPayload, teamsPayload] = await Promise.all([
        getItopTicketDefaults(),
        getItopRequirementCatalog(),
        getItopCurrentUserTeams(),
      ]);
      ModalManager.close(loadingModalId);

      const requesterOption = buildAnalystOption(teamsPayload.sessionUser);
      if (!requesterOption) {
        throw new Error("No hay solicitante iTop disponible. Registra tu persona iTop antes de cerrar.");
      }

      const fallbackTeams = (teamsPayload.items || []).length ? [] : await searchItopTeams({ query: "" });
      const groupOptions = normalizeTicketOptions((teamsPayload.items || []).length ? teamsPayload.items : fallbackTeams);
      const initialGroupId = groupOptions.length === 1 ? groupOptions[0].value : "";
      const initialGroupAnalysts = initialGroupId ? await searchItopTeamPeople({ teamId: initialGroupId }) : [];
      const analystOptions = normalizeAnalystOptions(initialGroupAnalysts, teamsPayload.sessionUser, Boolean(initialGroupId));
      const analystOption = findCurrentAnalystOption(analystOptions, teamsPayload.sessionUser) || (analystOptions.length === 1 ? analystOptions[0] : null);
      const currentAnalystOption = buildAnalystOption(teamsPayload.sessionUser);
      const documents = buildLabPublicationDocuments(detail);
      let publicationModalId = null;

      publicationModalId = ModalManager.custom({
        title: `Registrar en iTop ${detail?.code || row.code}`.trim(),
        size: "personDetail",
        showFooter: false,
        closeOnOverlayClick: false,
        closeOnEscape: false,
        content: (
          <ActaPublicationModalContent
            initialValues={{
              actaType: "Laboratorio",
              requesterId: requesterOption.value,
              requester: requesterOption.label,
              groupId: initialGroupId,
              groupName: initialGroupId ? groupOptions[0].label : "",
              analystId: analystOption?.value || "",
              analystName: analystOption?.label || "",
              subject: buildLabTicketSubject(detail),
              description: buildLabTicketDescription(detail),
              origin: ticketConfig.requirementOrigin || "",
              impact: ticketConfig.requirementImpact || "",
              urgency: ticketConfig.requirementUrgency || "",
              priority: ticketConfig.requirementPriority || "",
              category: ticketConfig.requirementServiceId || "",
              subcategory: ticketConfig.requirementServiceSubcategoryId || "",
            }}
            options={{
              requesterOptions: [requesterOption],
              originOptions: catalogPayload.origins || [],
              impactOptions: catalogPayload.impacts || [],
              urgencyOptions: catalogPayload.urgencies || [],
              priorityOptions: catalogPayload.priorities || [],
              categoryOptions: catalogPayload.services || [],
              subcategoryOptions: catalogPayload.serviceSubcategories || [],
              groupOptions,
              analystOptions,
              currentAnalystOption,
            }}
            documents={documents}
            onLoadAnalystOptions={async (teamId) => normalizeAnalystOptions(await searchItopTeamPeople({ teamId }), teamsPayload.sessionUser, Boolean(teamId))}
            onPreviewDocument={() => openDocsModal(detail)}
            submitLabel="Registrar en iTop"
            submittingLabel="Registrando..."
            onCancel={() => ModalManager.close(publicationModalId)}
            onSubmit={async (ticketPayload) => {
              ModalManager.close(publicationModalId);
              await onSuccess(ticketPayload);
            }}
          />
        ),
      });
    } catch (prepareError) {
      ModalManager.close(loadingModalId);
      throw prepareError;
    }
  };

  const handleFinalizeItop = async (row) => {
    try {
      const detail = await getLabRecord(row.id)
        .then((response) => enrichLabDetailWithItopAsset(response?.item || row));
      await openLabTicketPublicationFlow({
        row,
        detail,
        onSuccess: async (ticketPayload) => {
          const loadingModalId = ModalManager.loading({
            title: "Registrando ticket iTop",
            message: "Creando ticket, adjuntando actas y preparando normalizacion si corresponde...",
            showProgress: false,
            showCancel: false,
          });
          try {
            await finalizeLabClosure(row.id, ticketPayload);
            add({ title: "Ticket registrado", description: `El acta ${row.code} fue registrada en iTop.`, tone: "success" });
            await loadRecords(filters);
          } finally {
            ModalManager.close(loadingModalId);
          }
        },
      });
    } catch (publishError) {
      ModalManager.error({
        title: "No fue posible continuar con el ticket",
        message: publishError.message || "No fue posible preparar el registro iTop.",
      });
    }
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
      key: "reasonLabel",
      label: "Motivo",
      sortable: true,
      render: (_, row) => getReasonLabel(row.reason),
    },
    {
      key: "ownerName",
      label: "Especialista",
      sortable: true,
      render: (value) => value || "—",
    },
    {
      key: "assetAssignedUser",
      label: "Responsable activo",
      sortable: true,
      render: (value) => value || "Sin asignar",
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
      key: "currentPhaseLabel",
      label: "Fase actual",
      headerClassName: "w-[9rem] min-w-[9rem]",
      cellClassName: "w-[9rem] min-w-[9rem]",
      render: (value) => value || "Entrada",
    },
    {
      key: "status",
      label: "Estado",
      headerClassName: "w-[9rem] min-w-[9rem]",
      cellClassName: "w-[9rem] min-w-[9rem]",
      render: (value) => <StatusChip status={value} />,
    },
    {
      key: "actions",
      label: "Acciones",
      headerClassName: "w-[18rem] min-w-[18rem] text-right",
      cellClassName: "w-[18rem] min-w-[18rem] align-top",
      render: (_, row) => {
        const isEditable = EDITABLE_CODES.includes(row.statusCode);
        const isCancellable = CANCELLABLE_CODES.includes(row.statusCode);
        const isPendingItop = row.statusCode === "pending_itop_sync";
        const hasDocuments = Boolean(
          row.entryGeneratedDocument || row.processingGeneratedDocument || row.exitGeneratedDocument
        );
        const actions = [];

        actions.push({
          key: isEditable ? "edit" : "view",
          label: isEditable ? "Editar" : "Ver",
          icon: isEditable ? "edit" : "eye",
          onClick: () => navigate(`/lab/${row.id}`),
        });

        if (hasDocuments) {
          actions.push({
            key: "docs",
            label: "Docs",
            icon: "fileLines",
            onClick: () => openDocsModal(row),
          });
        }

        if (isPendingItop) {
          actions.push({
            key: "itop",
            label: "Ticket",
            icon: "paperPlane",
            onClick: () => handleFinalizeItop(row),
          });
        }

        if (isCancellable) {
          actions.push({
            key: "cancel",
            label: "Anular",
            icon: "ban",
            danger: true,
            onClick: () => handleCancelRecord(row),
          });
        }

        const actionRows = chunkActions(actions, 3);
        return (
          <div className="ml-auto flex w-full max-w-[18rem] flex-col gap-1.5">
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
                    className={`${actionButtonClassName}${action.danger ? " text-[var(--danger)] hover:border-[rgba(210,138,138,0.4)] hover:bg-[rgba(210,138,138,0.08)]" : ""}`}
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
      <div
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-[repeat(var(--kpi-count),minmax(0,1fr))]"
        style={{ "--kpi-count": Math.max(kpis.length, 1) }}
      >
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

      <Panel>
        <PanelHeader eyebrow="Laboratorio" title="Filtros Actas de Laboratorio" />
        <form className="grid gap-4" onSubmit={handleFilterSubmit}>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="grid gap-3">
              <div className="grid gap-3 xl:grid-cols-4">
                <div className="min-w-0 xl:col-span-2">
                  <SearchFilterInput
                    value={filters.query}
                    placeholder="Buscar por acta, motivo, responsable, especialista o activo"
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, query: event.target.value }))
                    }
                  />
                </div>

                <div className="min-w-0">
                  <FilterDropdown
                    label="Estado"
                    selectedValues={filters.status ? [filters.status] : []}
                    options={[{ value: "all", label: "Todos" }, ...LAB_STATUS_OPTIONS]}
                    selectionMode="single"
                    onToggleOption={(value) =>
                      setFilters((current) => ({ ...current, status: value === "all" ? "" : value }))
                    }
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
                      option.value === "all" ? "Sin restricción aplicada" : "Selecciona un estado"
                    }
                    getOptionClassName={getFilterOptionClassName}
                  />
                </div>

                <div className="min-w-0">
                  <FilterDropdown
                    label="Motivo"
                    selectedValues={filters.reason ? [filters.reason] : []}
                    options={[{ value: "all", label: "Todos" }, ...LAB_REASON_OPTIONS]}
                    selectionMode="single"
                    onToggleOption={(value) =>
                      setFilters((current) => ({ ...current, reason: value === "all" ? "" : value }))
                    }
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
                      option.value === "all" ? "Sin restricción aplicada" : "Selecciona un motivo"
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
                    header: ["Acta", "Motivo", "Especialista", "Responsable activo", "Ingreso", "Fase actual", "Estado"],
                    rows: rows.map((row) => [
                      row.code,
                      row.reasonLabel || getReasonLabel(row.reason),
                      row.ownerName || "",
                      row.assetAssignedUser || "",
                      formatDate(row.entryDate),
                      row.currentPhaseLabel || "",
                      row.status,
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
