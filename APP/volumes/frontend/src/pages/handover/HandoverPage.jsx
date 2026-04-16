import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalManager from "../../components/ui/modal";
import { DataTable, FilterDropdown, KpiCard, Panel, PanelHeader } from "../../components/ui/general";
import { SearchFilterInput } from "../../components/ui/general/SearchFilterInput";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Icon } from "../../components/ui/icon/Icon";
import { Button } from "../../ui/Button";
import {
  emitHandoverDocument,
  getHandoverBootstrap,
  listHandoverDocuments,
  rollbackHandoverDocument,
  uploadHandoverEvidence,
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

function isAcceptedEvidenceFile(file, allowedExtensions = []) {
  const normalizedName = String(file?.name || "").toLowerCase();
  return allowedExtensions.some((extension) => normalizedName.endsWith(`.${extension}`));
}

function getEvidenceFileTypeMeta(file) {
  const normalizedName = String(file?.name || "").toLowerCase();
  const normalizedType = String(file?.type || "").toLowerCase();

  if (normalizedType.includes("pdf") || normalizedName.endsWith(".pdf")) {
    return {
      label: "PDF",
      className: "bg-[rgba(210,138,138,0.16)] text-[var(--danger)]",
    };
  }

  if (normalizedName.endsWith(".doc") || normalizedName.endsWith(".docx")) {
    return {
      label: normalizedName.endsWith(".docx") ? "DOCX" : "DOC",
      className: "bg-[rgba(81,152,194,0.16)] text-[var(--accent-strong)]",
    };
  }

  return {
    label: "TXT",
    className: "bg-[rgba(81,152,194,0.16)] text-[var(--accent-strong)]",
  };
}

function EvidenceFileTypeIcon({ file }) {
  const meta = getEvidenceFileTypeMeta(file);
  const extensionLabel = meta.label === "DOCX" ? "W" : meta.label === "DOC" ? "W" : meta.label === "PDF" ? "P" : "T";
  return (
    <span
      aria-label={meta.label}
      title={meta.label}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold ${meta.className}`}
    >
      {extensionLabel}
    </span>
  );
}

function EvidenceUploadModal({ row, willConfirmStatus, allowedExtensions, onCancel, onSubmit }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [acknowledged, setAcknowledged] = useState(!willConfirmStatus);
  const [dragActive, setDragActive] = useState(false);
  const normalizedAllowedExtensions = (allowedExtensions?.length ? allowedExtensions : ["pdf", "doc", "docx"]).map((item) => String(item).toLowerCase());
  const acceptValue = normalizedAllowedExtensions.map((item) => `.${item}`).join(",");
  const allowedExtensionsLabel = normalizedAllowedExtensions.map((item) => item.toUpperCase()).join(" / ");

  const appendFiles = (incomingFiles) => {
    const incomingList = Array.from(incomingFiles || []);
    if (!incomingList.length) {
      return;
    }

    const validFiles = incomingList.filter((file) => isAcceptedEvidenceFile(file, normalizedAllowedExtensions));
    const invalidFiles = incomingList.filter((file) => !isAcceptedEvidenceFile(file, normalizedAllowedExtensions));

    if (!validFiles.length && invalidFiles.length) {
      setError(`Formato no admitido. Solo se permiten ${allowedExtensionsLabel}: ${invalidFiles.map((file) => file.name).join(", ")}`);
      return;
    }

    setSelectedFiles((current) => {
      const seenKeys = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const merged = [...current];
      validFiles.forEach((file) => {
        const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seenKeys.has(fileKey)) {
          merged.push(file);
          seenKeys.add(fileKey);
        }
      });
      return merged;
    });
    setError(
      invalidFiles.length
        ? `Se omitieron archivos no admitidos. Solo se permiten ${allowedExtensionsLabel}: ${invalidFiles.map((file) => file.name).join(", ")}`
        : ""
    );
  };

  const handleFilesChange = (event) => {
    appendFiles(event.target.files || []);
    event.target.value = "";
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!busy) {
      setDragActive(true);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!busy) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const relatedTarget = event.relatedTarget;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
      return;
    }
    setDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (busy) {
      return;
    }
    appendFiles(event.dataTransfer?.files || []);
  };

  const handleRemoveFile = async (fileToRemove) => {
    const confirmed = await ModalManager.confirm({
      title: "Quitar adjunto",
      message: `Se quitara ${fileToRemove.name}.`,
      content: "Confirma para remover este adjunto de la carga actual.",
      buttons: { cancel: "Cancelar", confirm: "Quitar" },
    });

    if (!confirmed) {
      return;
    }

    setSelectedFiles((current) =>
      current.filter((file) => `${file.name}-${file.size}-${file.lastModified}` !== `${fileToRemove.name}-${fileToRemove.size}-${fileToRemove.lastModified}`)
    );
  };

  const selectedCountLabel = selectedFiles.length === 1 ? "1 adjunto preparado" : `${selectedFiles.length} adjuntos preparados`;
  const submitDisabled = busy || selectedFiles.length === 0 || (willConfirmStatus && !acknowledged);

  const handleSubmit = async () => {
    if (!selectedFiles.length) {
      setError("Debes seleccionar al menos una evidencia.");
      return;
    }
    if (willConfirmStatus && !acknowledged) {
      setError("Debes confirmar que la carga cambiara el estado del acta.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await onSubmit(selectedFiles);
    } catch (submitError) {
      setError(submitError?.message || "No fue posible cargar las evidencias.");
      setBusy(false);
    }
  };

  return (
    <div className="flex max-h-[78vh] min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-panel)]">
      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex min-h-0 flex-col gap-5 border-b border-[var(--border-color)] p-5 xl:border-b-0 xl:border-r">
          <div className="grid flex-1 min-h-0 gap-3">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Agregar evidencia</span>
            <input
              type="file"
              multiple
              accept={acceptValue}
              onChange={handleFilesChange}
              disabled={busy}
              className="hidden"
              id={`handover-evidence-${row.id}`}
            />
            <label
              htmlFor={`handover-evidence-${row.id}`}
              className={`flex min-h-[14rem] flex-1 cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed px-4 py-6 text-center transition ${dragActive ? "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)]"} ${busy ? "pointer-events-none opacity-60" : ""}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Icon name="paperclip" size={18} className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
              <span className="mt-3 text-lg font-semibold text-[var(--text-primary)]">
                {dragActive ? "Suelta archivos aqui" : "Arrastra archivos aqui"}
              </span>
              <span className="mt-1 text-sm text-[var(--text-muted)]">{allowedExtensionsLabel} · click para seleccionar</span>
            </label>
          </div>

          {willConfirmStatus ? (
            <label className="flex items-start gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                disabled={busy}
                className="mt-0.5 h-4 w-4 rounded border border-[var(--border-color)]"
              />
              <span className="leading-6">
                Confirmo que al aceptar esta carga el acta cambiara desde <strong className="text-[var(--text-primary)]">Emitida</strong> a{" "}
                <strong className="text-[var(--success)]">Confirmada</strong>.
              </span>
            </label>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-color)] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Adjuntos preparados</p>
            <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
              {selectedFiles.length} {selectedFiles.length === 1 ? "archivo" : "archivos"}
            </span>
          </div>
          <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            <span>Archivo</span>
            <span className="text-right">Accion</span>
          </div>
          <div className="min-h-[22rem] flex-1 overflow-y-auto px-5 py-4">
            {selectedFiles.length ? (
              <ol className="grid gap-3">
                {selectedFiles.map((file) => (
                  <li
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="grid gap-3 rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <EvidenceFileTypeIcon file={file} />
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{file.name}</p>
                      </div>
                      <p className="mt-1 break-all text-xs text-[var(--text-muted)]">
                        {getEvidenceFileTypeMeta(file).label} / {file.size} B
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="px-3 py-1.5 text-[11px]"
                        onClick={() => handleRemoveFile(file)}
                        disabled={busy}
                      >
                        <Icon name="xmark" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Quitar
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex h-full min-h-[18rem] items-center justify-center px-5 text-center text-sm text-[var(--text-muted)]">
                Sin adjuntos. Agrega archivos desde el panel izquierdo.
              </div>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mx-5 mb-0 shrink-0 rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
          {error}
        </div>
      ) : null}

      <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-[var(--border-color)] px-5 py-4">
        <Button variant="secondary" onClick={onCancel} disabled={busy} className="min-w-[7.5rem]">
          Cerrar
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={submitDisabled} className="min-w-[11.5rem]">
          {busy ? "Cargando..." : willConfirmStatus ? "Cargar y confirmar" : "Cargar evidencias"}
        </Button>
      </div>
    </div>
  );
}

export function HandoverPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState({ query: "", status: "" });
  const [catalog, setCatalog] = useState({ statusOptions: [] });
  const [actionConfig, setActionConfig] = useState({ allowEvidenceUpload: true, evidenceAllowedExtensions: ["pdf", "doc", "docx"] });

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
        evidenceAllowedExtensions: bootstrap?.actions?.evidenceAllowedExtensions || ["pdf", "doc", "docx"],
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
                  await emitHandoverDocument(row.id);
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

  const handleRollback = async (row) => {
    const confirmed = await ModalManager.confirm({
      title: "Cancelar emision",
      message: `Se revertira ${row.code} a En creacion.`,
      content: "Confirma para devolver esta acta al estado anterior. La fecha de asignacion se limpiara y el documento volvera a quedar editable.",
      buttons: { cancel: "Cerrar", confirm: "Cancelar emision" },
    });

    if (!confirmed) {
      return;
    }

    try {
      await rollbackHandoverDocument(row.id);
      setNotice(`El acta ${row.code} volvio a estado En creacion.`);
      setError("");
      await loadDocuments(filters);
    } catch (rollbackError) {
      setError(rollbackError.message || "No fue posible cancelar la emision del acta.");
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
    const willConfirmStatus = row.status === "Emitida";
    let modalId = null;
    modalId = ModalManager.custom({
      title: (
        <span className="inline-flex items-center gap-3">
          <Icon name="warning" size={16} className="h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
          <span>Cargar evidencia {row.code}</span>
        </span>
      ),
      size: "personDetail",
      showFooter: false,
      content: (
        <EvidenceUploadModal
          row={row}
          willConfirmStatus={willConfirmStatus}
          allowedExtensions={actionConfig.evidenceAllowedExtensions}
          onCancel={() => ModalManager.close(modalId)}
          onSubmit={async (files) => {
            await uploadHandoverEvidence(row.id, files);
            ModalManager.close(modalId);
            setNotice(
              willConfirmStatus
                ? `El acta ${row.code} quedo Confirmada y las evidencias fueron registradas.`
                : `Las evidencias del acta ${row.code} fueron registradas.`
            );
            setError("");
            await loadDocuments(filters);
          }}
        />
      ),
    });
  };

  const tableColumns = [
    { key: "code", label: "Acta", sortable: true, headerClassName: "w-[9rem] min-w-[9rem]", cellClassName: "w-[9rem] min-w-[9rem]" },
    { key: "person", label: "Destinatario", sortable: true },
    { key: "role", label: "Cargo", sortable: true },
    { key: "asset", label: "Activos" },
    { key: "date", label: "Fecha", sortable: true, headerClassName: "w-[7.5rem] min-w-[7.5rem]", cellClassName: "w-[7.5rem] min-w-[7.5rem]" },
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
      headerClassName: "w-[16.5rem] min-w-[16.5rem] text-right",
      cellClassName: "w-[16.5rem] min-w-[16.5rem] text-right",
      render: (_, row) => {
        const isDraft = row.status === "En creacion";
        const isIssued = row.status === "Emitida";
        const isConfirmed = row.status === "Confirmada";
        const actionContainerClassName = isDraft
          ? "ml-auto flex max-w-[16.5rem] flex-nowrap items-center justify-end gap-1.5"
          : "ml-auto grid max-w-[16.5rem] grid-cols-2 justify-items-end gap-1.5";
        const sharedButtonClassName = "inline-flex min-h-[36px] items-center justify-center whitespace-nowrap px-2.5 py-1.5 text-[11px]";
        const draftButtonClassName = `${sharedButtonClassName} min-w-[5.75rem]`;
        const compactActionButtonClassName = `${sharedButtonClassName} min-w-[5.5rem]`;
        const evidenceButtonClassName = `${sharedButtonClassName} min-w-[7rem]`;
        const evidenceButtonLabel = isIssued ? "Evidencia" : "Cargar evidencia";

        return (
          <div className={actionContainerClassName}>
            {isDraft ? (
              <Button size="sm" variant="secondary" className={draftButtonClassName} onClick={() => navigate(`/handover/${row.id}`)}>
                <Icon name="edit" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Editar
              </Button>
            ) : null}
            {isDraft ? (
              <Button size="sm" variant="secondary" className={draftButtonClassName} onClick={() => handleProcess(row)}>
                <Icon name="check" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Procesar
              </Button>
            ) : null}
            {isIssued ? (
              <Button size="sm" variant="secondary" className={compactActionButtonClassName} onClick={() => handleRollback(row)}>
                <Icon name="history" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Cancelar
              </Button>
            ) : null}
            {isDraft || isIssued ? (
              <Button size="sm" variant="secondary" className={compactActionButtonClassName} onClick={() => handleCancel(row)}>
                <Icon name="xmark" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Anular
              </Button>
            ) : null}
            {isIssued || isConfirmed ? (
              <Button size="sm" variant="secondary" className={compactActionButtonClassName} onClick={() => openPdfModal(row)}>
                <Icon name="download" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                PDF
              </Button>
            ) : null}
            {actionConfig.allowEvidenceUpload && (isIssued || isConfirmed) ? (
              <Button size="sm" variant="secondary" className={evidenceButtonClassName} onClick={() => openEvidenceModal(row)}>
                <Icon name="paperclip" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {evidenceButtonLabel}
              </Button>
            ) : null}
          </div>
        );
      },
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
