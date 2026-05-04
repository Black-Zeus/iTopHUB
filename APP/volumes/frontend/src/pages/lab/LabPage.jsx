import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalManager from "../../components/ui/modal";
import { DataTable, FilterDropdown, KpiCard, Panel, PanelHeader } from "../../components/ui/general";
import { SearchFilterInput } from "../../components/ui/general/SearchFilterInput";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Icon } from "../../components/ui/icon/Icon";
import { Button } from "../../ui/Button";
import { useToast } from "../../ui";
import {
  createLabSignatureSession,
  getLabSignatureSession,
  listLabRecords,
} from "../../services/lab-service";
import { downloadRowsAsCsv } from "../../utils/export-csv";
import { LAB_REASON_OPTIONS, LAB_STATUS_OPTIONS, getReasonLabel } from "./lab-module-config";

const FILTER_CONTROL_HEIGHT = "h-[66px]";

function buildQrImageUrl(value = "") {
  const normalizedValue = String(value || "").trim();
  return normalizedValue
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(normalizedValue)}`
    : "";
}

function buildKpis(rows) {
  const draft = rows.filter((row) => row.statusCode === "draft").length;
  const inLab = rows.filter((row) => row.statusCode === "in_lab").length;
  const pendingSignature = rows.filter((row) => row.statusCode === "pending_signature").length;
  const closed = rows.filter((row) => ["signed", "completed"].includes(row.statusCode)).length;
  const derived = rows.filter((row) => row.statusCode === "derived_obsolete").length;
  const cancelled = rows.filter((row) => row.statusCode === "cancelled").length;

  return [
    { label: "Total actas", value: String(rows.length).padStart(2, "0"), helper: "Registros guardados", tone: "default", filterValue: "" },
    { label: "En creacion", value: String(draft).padStart(2, "0"), helper: "Pendientes de inicio", tone: "warning", filterValue: "draft" },
    { label: "En laboratorio", value: String(inLab).padStart(2, "0"), helper: "Trabajo en curso", tone: "default", filterValue: "in_lab" },
    { label: "Pendiente firma", value: String(pendingSignature).padStart(2, "0"), helper: "Salida emitida con QR", tone: "default", filterValue: "pending_signature" },
    { label: "Cerradas", value: String(closed).padStart(2, "0"), helper: "Firmadas o completadas", tone: "success", filterValue: "" },
    { label: "Derivadas", value: String(derived + cancelled).padStart(2, "0"), helper: "Obsoletas o anuladas", tone: "danger", filterValue: "" },
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
            <span key={option.value} className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]">
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

function SignatureQrModal({ row, sessionData, onRefresh, onRegenerate, onClose }) {
  const publicUrl = String(sessionData?.publicUrl || "").trim();
  const qrImageUrl = buildQrImageUrl(publicUrl);
  const [qrLoading, setQrLoading] = useState(Boolean(qrImageUrl));
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    if (!sessionData?.documentId) {
      return undefined;
    }
    if (!["pending", "claimed", "signed", "published"].includes(sessionData.status)) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      onRefresh?.();
    }, 4000);
    return () => window.clearInterval(intervalId);
  }, [onRefresh, sessionData?.documentId, sessionData?.status]);

  useEffect(() => {
    setQrLoading(Boolean(qrImageUrl));
    setQrFailed(false);
  }, [qrImageUrl]);

  const isSigned = ["signed", "published"].includes(sessionData?.status) || ["Firmada", "Completada", "Derivada a obsoleto"].includes(sessionData?.documentStatus);
  const isExpired = sessionData?.status === "expired";
  const isClaimed = sessionData?.status === "claimed";
  const isOccupied = sessionData?.status === "occupied";
  const canRenderQr = Boolean(qrImageUrl) && !isExpired && !isOccupied && !qrFailed;
  const statusLabel = isSigned ? "Firmada" : isExpired ? "Expirada" : isOccupied ? "Ocupada" : isClaimed ? "En uso" : "Disponible";
  const statusClassName = isSigned
    ? "bg-[#dcfce7] text-[#15803d]"
    : isExpired || isOccupied
      ? "bg-[#fef3c7] text-[#92400e]"
      : isClaimed
        ? "bg-[#e0f2fe] text-[#0369a1]"
        : "bg-[#dbeafe] text-[#1d4ed8]";

  return (
    <div className="grid gap-5">
      <div className="rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-4 rounded-t-[24px] bg-[#0f172a] px-6 py-5 text-white">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Firma digital</p>
            <h2 className="mt-2 text-xl font-bold">QR para {row.code}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              El responsable actual del activo debe escanear este código desde su móvil para revisar el acta de salida y registrar su firma digital.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${statusClassName}`}>
            {statusLabel}
          </span>
        </div>

        <div className="grid gap-5 p-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5 text-center">
            <div className="relative mx-auto flex h-[260px] w-[260px] items-center justify-center overflow-hidden rounded-[18px] border border-[#2d465b] bg-[#edf3fa] shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
              {canRenderQr ? (
                <>
                  {qrLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#edf3fa]">
                      <div className="flex flex-col items-center gap-3">
                        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#bfd0e4] border-t-[#2563eb]" />
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Generando QR...
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <img
                    src={qrImageUrl}
                    alt={`QR de firma para ${row.code}`}
                    className={`h-[250px] w-[250px] object-contain transition-opacity duration-200 ${qrLoading ? "opacity-0" : "opacity-100"}`}
                    onLoad={() => setQrLoading(false)}
                    onError={() => {
                      setQrLoading(false);
                      setQrFailed(true);
                    }}
                  />
                </>
              ) : (
                <span className="px-6 text-sm font-semibold text-slate-500">
                  {isExpired || isOccupied ? "Genera una nueva sesión QR para continuar." : "No fue posible preparar el código QR."}
                </span>
              )}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Este QR está pensado para uso móvil y queda reservado al primer dispositivo que lo abra.
            </p>
          </section>

          <section className="grid gap-4">
            <div className="grid gap-3 rounded-[20px] border border-[#2d465b] bg-[var(--bg-app)] p-4 md:grid-cols-2">
              <div className="rounded-[16px] bg-[#101b28] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa9be]">Acta</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{sessionData?.documentNumber || row.code}</p>
              </div>
              <div className="rounded-[16px] bg-[#101b28] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa9be]">Expira</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{sessionData?.expiresAt || "-"}</p>
              </div>
              <div className="rounded-[16px] bg-[#101b28] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa9be]">Responsable del activo</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{sessionData?.receiver?.name || row.assetAssignedUser || "-"}</p>
              </div>
              <div className="rounded-[16px] bg-[#101b28] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa9be]">Estado Hub</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{sessionData?.documentStatus || row.status || "-"}</p>
              </div>
            </div>

            <div className={`rounded-[20px] border px-4 py-4 ${
              isSigned
                ? "border-[#1f6a45] bg-[#112c21]"
                : isExpired || isOccupied
                  ? "border-[#7c5b18] bg-[#33250d]"
                  : "border-[#2d5f88] bg-[#11283f]"
            }`}>
              <p className="text-sm font-semibold text-slate-100">
                {isSigned
                  ? "La firma del responsable ya fue registrada. El acta de laboratorio quedó cerrada con su PDF firmado."
                  : isExpired
                    ? "La vigencia del QR terminó. Genera una nueva sesión para retomar la firma."
                    : isOccupied
                      ? "Este QR fue abierto desde otro dispositivo. Genera una nueva sesión si necesitas reiniciar el proceso."
                      : isClaimed
                        ? "La sesión ya fue abierta desde un dispositivo móvil y quedó bloqueada para ese equipo hasta que firme o expire."
                        : "Esperando que el responsable del activo abra el QR desde su móvil. Esta ventana se actualiza automáticamente."}
              </p>
              {sessionData?.claimedAt && !isSigned ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">
                  Abierto en dispositivo móvil: {sessionData.claimedAt}
                </p>
              ) : null}
              {sessionData?.completedAt ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">
                  Firmada en {sessionData.completedAt}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end">
              <div className="flex flex-wrap justify-end gap-3">
                {!isSigned ? (
                  <Button variant="secondary" onClick={onRegenerate}>Regenerar QR</Button>
                ) : null}
                <Button variant="secondary" onClick={onRefresh}>Actualizar estado</Button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose} className="min-w-[7.5rem]">Cerrar</Button>
      </div>
    </div>
  );
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

  const openQrModal = async (row) => {
    const loadingModalId = ModalManager.loading({
      title: `Preparando QR ${row.code}`,
      message: "Generando la sesión de firma móvil...",
      showProgress: false,
      showCancel: false,
    });

    try {
      const sessionData = row.statusCode === "signed"
        ? await getLabSignatureSession(row.id)
        : await createLabSignatureSession(row.id);
      ModalManager.close(loadingModalId);
      let modalId = null;

      const refreshSession = async () => {
        const refreshed = await getLabSignatureSession(row.id);
        if (modalId) {
          ModalManager.update(modalId, {
            content: (
              <SignatureQrModal
                row={row}
                sessionData={refreshed}
                onRefresh={refreshSession}
                onRegenerate={regenerateSession}
                onClose={() => ModalManager.close(modalId)}
              />
            ),
          });
        }
        if (["Firmada", "Completada", "Derivada a obsoleto"].includes(refreshed.documentStatus)) {
          await loadRecords(filters);
        }
      };

      const regenerateSession = async () => {
        const confirmed = await ModalManager.confirm({
          title: "Regenerar QR",
          message: `Se invalidará el QR actual de ${row.code}.`,
          content: "El código actualmente abierto quedará dado de baja y se emitirá uno nuevo para continuar la firma desde otro dispositivo.",
          buttons: { cancel: "Cancelar", confirm: "Regenerar QR" },
        });
        if (!confirmed) {
          return;
        }

        const regenerateLoadingId = ModalManager.loading({
          title: "Regenerando QR",
          message: "Dando de baja la sesión actual y emitiendo un nuevo código...",
          showProgress: false,
          showCancel: false,
        });
        try {
          const refreshed = await createLabSignatureSession(row.id, { forceNew: true });
          if (modalId) {
            ModalManager.update(modalId, {
              content: (
                <SignatureQrModal
                  row={row}
                  sessionData={refreshed}
                  onRefresh={refreshSession}
                  onRegenerate={regenerateSession}
                  onClose={() => ModalManager.close(modalId)}
                />
              ),
            });
          }
          add({
            title: "QR regenerado",
            description: `El código anterior de ${row.code} quedó invalidado y ya puedes usar el nuevo QR.`,
            tone: "success",
          });
        } catch (regenerateError) {
          ModalManager.error({
            title: "No fue posible regenerar el QR",
            message: regenerateError.message || "No fue posible invalidar la sesión actual de firma.",
          });
        } finally {
          ModalManager.close(regenerateLoadingId);
        }
      };

      modalId = ModalManager.custom({
        title: `Firma QR ${row.code}`,
        size: "clientWide",
        showFooter: false,
        content: (
          <SignatureQrModal
            row={row}
            sessionData={sessionData}
            onRefresh={refreshSession}
            onRegenerate={regenerateSession}
            onClose={() => ModalManager.close(modalId)}
          />
        ),
      });
    } catch (signatureError) {
      ModalManager.close(loadingModalId);
      ModalManager.error({
        title: "No fue posible abrir el QR",
        message: signatureError.message || "No fue posible preparar la sesión de firma digital.",
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
      headerClassName: "w-[16rem] min-w-[16rem] text-right",
      cellClassName: "w-[16rem] min-w-[16rem] align-top",
      render: (_, row) => {
        const isEditable = ["draft", "in_lab"].includes(row.statusCode);
        const hasDocuments = Boolean(row.entryGeneratedDocument || row.processingGeneratedDocument || row.exitGeneratedDocument);
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
            onClick: () => navigate(`/lab/${row.id}`),
          });
        }

        if (row.canOpenQr && ["pending_signature", "signed"].includes(row.statusCode)) {
          actions.push({
            key: "qr",
            label: "QR",
            icon: "mobile",
            onClick: () => openQrModal(row),
          });
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
                    onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                  />
                </div>

                <div className="min-w-0">
                  <FilterDropdown
                    label="Estado"
                    selectedValues={filters.status ? [filters.status] : []}
                    options={[{ value: "all", label: "Todos" }, ...LAB_STATUS_OPTIONS]}
                    selectionMode="single"
                    onToggleOption={(value) => setFilters((current) => ({ ...current, status: value === "all" ? "" : value }))}
                    onClear={() => setFilters((current) => ({ ...current, status: "" }))}
                    triggerClassName="py-3"
                    buttonHeightClassName={FILTER_CONTROL_HEIGHT}
                    menuOffsetClassName="top-[calc(100%+0.55rem)]"
                    menuClassName="rounded-[18px]"
                    renderSelection={renderFilterSelection}
                    renderOptionLeading={() => <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />}
                    renderOptionDescription={(option) => option.value === "all" ? "Sin restricción aplicada" : "Selecciona un estado"}
                    getOptionClassName={getFilterOptionClassName}
                  />
                </div>

                <div className="min-w-0">
                  <FilterDropdown
                    label="Motivo"
                    selectedValues={filters.reason ? [filters.reason] : []}
                    options={[{ value: "all", label: "Todos" }, ...LAB_REASON_OPTIONS]}
                    selectionMode="single"
                    onToggleOption={(value) => setFilters((current) => ({ ...current, reason: value === "all" ? "" : value }))}
                    onClear={() => setFilters((current) => ({ ...current, reason: "" }))}
                    triggerClassName="py-3"
                    buttonHeightClassName={FILTER_CONTROL_HEIGHT}
                    menuOffsetClassName="top-[calc(100%+0.55rem)]"
                    menuClassName="rounded-[18px]"
                    renderSelection={renderFilterSelection}
                    renderOptionLeading={() => <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />}
                    renderOptionDescription={(option) => option.value === "all" ? "Sin restricción aplicada" : "Selecciona un motivo"}
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
