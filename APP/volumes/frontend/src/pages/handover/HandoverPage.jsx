import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalManager from "../../components/ui/modal";
import { ActaPublicationModalContent, DataTable, FilterDropdown, KpiCard, Panel, PanelHeader } from "../../components/ui/general";
import { SearchFilterInput } from "../../components/ui/general/SearchFilterInput";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Icon } from "../../components/ui/icon/Icon";
import { Button } from "../../ui/Button";
import { Spinner } from "../../ui/Spinner";
import { useToast } from "../../ui";
import {
  createHandoverSignatureSession,
  emitHandoverDocument,
  fetchHandoverEvidenceBlob,
  fetchHandoverGeneratedPdfBlob,
  getHandoverBootstrap,
  getHandoverDocument,
  getHandoverSignatureSession,
  listHandoverDocuments,
  publishSignedHandover,
  rollbackHandoverDocument,
  uploadHandoverEvidence,
  updateHandoverDocument,
  updateHandoverDocumentStatus,
} from "../../services/handover-service";
import { getItopCurrentUserTeams, getItopRequirementCatalog, getItopTicketDefaults, searchItopTeamPeople, searchItopTeams } from "../../services/itop-service";
import { getUsers } from "../../services/user-service";
import { runtimeConfig } from "../../config/runtime";
import { waitForJobNotification } from "../../services/notification-service";
import { downloadRowsAsCsv } from "../../utils/export-csv";
import {
  buildHandoverDocumentLibraryEntries,
  getHandoverDocumentTypeLabel,
  HANDOVER_DOCUMENT_TYPE_OPTIONS,
} from "./handover-document-library";
import { MessageBanner } from "./handover-editor-shared";
import { getHandoverModuleConfig } from "./handover-module-config";
import { buildNormalizationRequesterOptions } from "./normalization-requester-options";

const HANDOVER_FILTER_CONTROL_HEIGHT = "h-[66px]";
const MAX_EVIDENCE_UPLOAD_FILES = 2;

function buildQrImageUrl(value = "") {
  const normalizedValue = String(value || "").trim();
  return normalizedValue
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(normalizedValue)}`
    : "";
}

function buildKpis(rows) {
  const draftCount = rows.filter((row) => row.status === "En creacion").length;
  const issuedCount = rows.filter((row) => row.status === "Emitida").length;
  const signedCount = rows.filter((row) => row.status === "Firmada").length;
  const confirmedCount = rows.filter((row) => row.status === "Confirmada").length;
  const cancelledCount = rows.filter((row) => row.status === "Anulada").length;

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
      value: String(draftCount).padStart(2, "0"),
      helper: "Pendientes de cierre",
      tone: "warning",
      filterValue: "draft",
    },
    {
      label: "Emitidas",
      value: String(issuedCount).padStart(2, "0"),
      helper: "En circulacion",
      tone: "default",
      filterValue: "issued",
    },
    {
      label: "Firmadas",
      value: String(signedCount).padStart(2, "0"),
      helper: "Pendientes de ticket",
      tone: "default",
      filterValue: "signed",
    },
    {
      label: "Confirmadas",
      value: String(confirmedCount).padStart(2, "0"),
      helper: "Cierre completo",
      tone: "success",
      filterValue: "confirmed",
    },
    {
      label: "Anuladas",
      value: String(cancelledCount).padStart(2, "0"),
      helper: "Fuera de flujo",
      tone: "danger",
      filterValue: "cancelled",
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

function buildItopTicketUrl(integrationUrl, ticketId, ticketClass) {
  const base = String(integrationUrl || "").trim().replace(/\/+$/, "");
  const id = String(ticketId || "").trim();
  const cls = String(ticketClass || "UserRequest").trim();
  if (!base || !id) return null;
  return `${base}/pages/UI.php?operation=details&class=${encodeURIComponent(cls)}&id=${encodeURIComponent(id)}`;
}

function buildTicketDescription(row, template, detail, moduleConfig) {
  const code = String(row?.code || "").trim();
  const detailCode = code ? buildDetailDocumentNumber(code) : "";
  const items = detail?.items || [];
  const count = items.length || Number(row?.assetCount ?? 0);
  const returnReason = String(detail?.reason || "").trim();
  const sourcePerson = detail?.additionalReceivers?.find((person) => String(person?.assignmentRole || "").trim().toLowerCase() === "responsable origen")
    || detail?.additionalReceivers?.[0]
    || null;
  const destinationPerson = detail?.receiver || null;

  let assetLine;
  if (count === 1 && items[0]?.asset) {
    const a = items[0].asset;
    const assetIdentifier = a.name || a.code;
    const label = [a.className, assetIdentifier].filter(Boolean).join(" - ");
    assetLine = moduleConfig.ticketSingleAssetLine({
      assetLabel: label,
      assetName: a.name,
    });
  } else {
    assetLine = moduleConfig.ticketMultiAssetLine({ count });
  }

  const lines = [];
  const base = String(template || "").trim();
  if (base) lines.push(base);
  lines.push("");
  if (code) lines.push(`* Acta: ${code}.`);
  if (detailCode) lines.push(`* Detalle: ${detailCode}.`);
  if (moduleConfig?.key === "return" && returnReason) {
    lines.push("");
    lines.push("Motivo de devolucion:");
    lines.push(returnReason);
    lines.push("");
  }
  if (moduleConfig?.key === "reassignment") {
    lines.push("");
    lines.push(`Responsable origen: ${sourcePerson?.name || "Sin registro"}.`);
    lines.push(`Responsable destino: ${destinationPerson?.name || row?.person || "Sin registro"}.`);
    lines.push("");
  }
  lines.push(`* ${assetLine}`);
  return lines.join("\n");
}

const TICKET_PROGRESS_STEPS = [
  "Validando acta y parámetros",
  "Generando ticket iTop",
  "Asociando agente responsable",
  "Asociando contactos relacionados",
  "Asociando activo CMDB",
  "Adjuntando evidencias y documentos",
  "Ejecutando validaciones finales",
];

function openTicketProgressModal(title, currentStep = 0) {
  return ModalManager.progress({
    title,
    steps: TICKET_PROGRESS_STEPS,
    currentStep,
    progress: Math.round(((currentStep + 1) / TICKET_PROGRESS_STEPS.length) * 100),
    message: TICKET_PROGRESS_STEPS[currentStep] || "Procesando...",
    showProgress: true,
    allowCancel: false,
  });
}

function updateTicketProgressModal(modalId, currentStep) {
  ModalManager.update(modalId, {
    steps: TICKET_PROGRESS_STEPS,
    currentStep,
    progress: Math.round(((Math.min(currentStep, TICKET_PROGRESS_STEPS.length - 1) + 1) / TICKET_PROGRESS_STEPS.length) * 100),
    message: TICKET_PROGRESS_STEPS[currentStep] || "Procesando...",
    allowCancel: false,
  });
}

function startTicketProgressPulse(modalId, fromStep = 1, toStep = TICKET_PROGRESS_STEPS.length - 2) {
  const stepScheduleMs = [900, 1300, 1800, 2600, 3600];
  let step = fromStep;
  let timeoutId = null;
  let stopped = false;

  const advanceStep = () => {
    if (stopped) {
      return;
    }
    updateTicketProgressModal(modalId, step);
    const currentDelay = stepScheduleMs[Math.min(Math.max(step - fromStep, 0), stepScheduleMs.length - 1)];
    if (step < toStep) {
      timeoutId = window.setTimeout(() => {
        step += 1;
        advanceStep();
      }, currentDelay);
      return;
    }
    timeoutId = window.setTimeout(() => {
      updateTicketProgressModal(modalId, toStep);
      advanceStep();
    }, currentDelay);
  };

  advanceStep();
  return () => {
    stopped = true;
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  };
}

function downloadListCsv(rows, moduleConfig) {
  const isReassignmentModule = moduleConfig?.key === "reassignment";
  downloadRowsAsCsv({
    filename: moduleConfig.csvFilename,
    header: isReassignmentModule
      ? ["Acta", "Origen", "Destino", "Elaborador", "Folio iTop", "Fecha", "Estado"]
      : ["Acta", moduleConfig.listPersonColumnLabel || "Destinatario", "Elaborador", "Folio iTop", "Fecha", "Estado"],
    rows: rows.map((row) => [
      row.code || "",
      ...(isReassignmentModule
        ? [row.sourcePerson || "", row.destinationPerson || row.person || ""]
        : [row.person || ""]),
      row.elaborador || "",
      row.itopTicketNumber || "",
      row.date || "",
      row.status || "",
    ]),
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
  if (!sessionUser) {
    return null;
  }
  const value = String(sessionUser.itopPersonKey || sessionUser.itopPersonId || "").trim();
  const label = String(sessionUser.name || sessionUser.username || "").trim();
  return value && label ? { value, label } : null;
}

function findCurrentAnalystOption(options = [], sessionUser = null) {
  const normalizedOptions = normalizeTicketOptions(options);
  if (!normalizedOptions.length || !sessionUser) {
    return null;
  }

  const personKey = String(sessionUser.itopPersonKey || sessionUser.itopPersonId || "").trim();
  if (personKey) {
    const byPersonKey = normalizedOptions.find((option) => option.value === personKey);
    if (byPersonKey) {
      return byPersonKey;
    }
  }

  const sessionName = String(sessionUser.name || "").trim().toLowerCase();
  const sessionUsername = String(sessionUser.username || "").trim().toLowerCase();
  return normalizedOptions.find((option) => {
    const label = String(option.label || "").trim().toLowerCase();
    return Boolean(label && (label === sessionName || label === sessionUsername));
  }) || null;
}

function normalizeAnalystOptions(items = [], sessionUser = null, allowFallback = false) {
  const sessionFallback = buildAnalystOption(sessionUser);
  const normalizedSessionKey = String(sessionUser?.itopPersonKey || sessionUser?.itopPersonId || "").trim();
  const normalizedSessionName = String(sessionUser?.name || sessionUser?.username || "").trim().toLowerCase();
  const options = normalizeTicketOptions(items.map((item) => ({
    ...item,
    value: item.id,
    label: item.person || item.name,
  }))).map((option) => ({
    ...option,
    isCurrent: Boolean(
      (normalizedSessionKey && option.value === normalizedSessionKey)
      || (normalizedSessionName && String(option.label || "").trim().toLowerCase() === normalizedSessionName)
    ),
  }));
  if (!options.length && allowFallback && sessionFallback) {
    return [{ ...sessionFallback, isCurrent: true }];
  }
  return options;
}

function buildRequesterOptions(detail, row) {
  const requesterAdmin = detail?.requesterAdmin;
  if (requesterAdmin?.itopPersonKey && requesterAdmin?.name) {
    return [{
      value: String(requesterAdmin.itopPersonKey).trim(),
      label: String(requesterAdmin.name).trim(),
      roleLabel: "Solicitante administrador",
      hubUserId: requesterAdmin.userId || null,
    }];
  }

  const people = [];
  const appendPerson = (person, roleLabel) => {
    const id = String(person?.id || person?.code || person?.name || "").trim();
    const name = String(person?.name || person?.person || "").trim();
    if (!id || !name || people.some((item) => item.value === id)) {
      return;
    }
    people.push({
      value: id,
      label: name,
      roleLabel,
      code: person?.code || "",
      email: person?.email || "",
    });
  };

  appendPerson(detail?.receiver, "Principal");
  (detail?.additionalReceivers || []).forEach((person) => appendPerson(person, person.assignmentRole || "Secundario"));
  if (!people.length && row?.person) {
    appendPerson({ id: row.person, name: row.person }, "Principal");
  }
  return people;
}

function NormalizationRequesterModalContent({
  row,
  requesterOptions = [],
  initialRequesterId = "",
  onCancel,
  onSubmit,
}) {
  const [requesterId, setRequesterId] = useState(initialRequesterId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!requesterId && requesterOptions.length === 1) {
      setRequesterId(requesterOptions[0].value);
    }
  }, [requesterId, requesterOptions]);

  const selectedRequester = useMemo(
    () => requesterOptions.find((option) => option.value === requesterId) || null,
    [requesterId, requesterOptions],
  );

  return (
    <div className="grid gap-4">
      <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
        <p className="text-sm text-[var(--text-secondary)]">
          El PDF de normalización y el ticket iTop usarán este solicitante administrador como responsable asociado.
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Puedes seleccionar administradores activos del Hub. Si el usuario aún no tiene persona iTop vinculada, el acta no podrá procesarse hasta completar ese vínculo.
        </p>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-[var(--text-primary)]">Solicitante administrador</span>
        <select
          value={requesterId}
          onChange={(event) => setRequesterId(event.target.value)}
          className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none"
        >
          <option value="">Selecciona un administrador</option>
          {requesterOptions.map((option) => (
            <option key={`${option.hubUserId}-${option.value}`} value={option.value}>
              {option.hasItopPersonLink ? option.label : `${option.label} (sin persona iTop)`}
            </option>
          ))}
        </select>
      </label>

      {selectedRequester && !selectedRequester.hasItopPersonLink ? (
        <MessageBanner tone="warning">
          El administrador seleccionado aún no tiene persona iTop vinculada. Podrás dejarlo cargado en el acta, pero no procesarla hasta completar ese vínculo.
        </MessageBanner>
      ) : null}

      {selectedRequester?.username ? (
        <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Usuario Hub</p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{selectedRequester.username}</p>
        </div>
      ) : null}

      {error ? <MessageBanner tone="danger">{error}</MessageBanner> : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>Cancelar</Button>
        <Button
          variant="primary"
          disabled={submitting}
          onClick={async () => {
            if (!selectedRequester) {
              setError("Debes seleccionar un solicitante administrador para continuar.");
              return;
            }
            setSubmitting(true);
            setError("");
            try {
              await onSubmit({
                userId: selectedRequester.hubUserId,
                name: selectedRequester.label,
                itopPersonKey: selectedRequester.itopPersonKey,
              });
            } catch (submitError) {
              setError(submitError.message || "No fue posible guardar el solicitante administrador.");
              setSubmitting(false);
            }
          }}
        >
          {submitting ? "Guardando..." : `Procesar ${row.code}`}
        </Button>
      </div>
    </div>
  );
}

function buildPendingEvidenceDocuments(items = []) {
  return items.map((item, index) => ({
    id: `pending-${index}-${item.file?.name || "adjunto"}`,
    originalName: item.file?.name || "Adjunto preparado",
    previewFile: item.file || null,
    documentType: item.documentType || "",
    uploadedAt: "Preparado",
    iconName: "paperclip",
    isAvailable: false,
  }));
}

function buildDetailDocumentNumber(documentNumber = "") {
  const normalized = String(documentNumber || "").trim();
  const separatorIndex = normalized.indexOf("-");
  if (separatorIndex <= 0) {
    return `${normalized}D`;
  }
  return `${normalized.slice(0, separatorIndex)}D-${normalized.slice(separatorIndex + 1)}`;
}

function buildEvidenceStoredName(documentNumber, documentType, originalName = "") {
  const dotIndex = String(originalName || "").lastIndexOf(".");
  const extension = dotIndex >= 0 ? String(originalName || "").slice(dotIndex) : "";
  const baseNumber = documentType === "detalle" ? buildDetailDocumentNumber(documentNumber) : String(documentNumber || "").trim();
  return `${baseNumber}${extension}`;
}

function buildPublicationDocumentItems(detail, pendingItems = []) {
  const entriesByType = new Map();

  buildHandoverDocumentLibraryEntries({
    generatedDocuments: detail?.generatedDocuments || [],
    evidenceAttachments: detail?.evidenceAttachments || [],
    generatedFallbackUploadedAt: detail?.assignmentDate || "",
  }).forEach((documentEntry) => {
    entriesByType.set(documentEntry.documentType, {
      ...documentEntry,
      documentTypeLabel: getHandoverDocumentTypeLabel(documentEntry.documentType) || "Documento",
    });
  });

  buildPendingEvidenceDocuments(pendingItems).forEach((pendingEntry) => {
    const documentType = pendingEntry.documentType;
    if (!documentType) {
      return;
    }
    entriesByType.set(documentType, {
      ...pendingEntry,
      id: `pending-${documentType}`,
      name: buildEvidenceStoredName(detail?.documentNumber, documentType, pendingEntry.originalName),
      documentTypeLabel: getHandoverDocumentTypeLabel(documentType) || "Adjunto",
      isAvailable: true,
    });
  });

  return ["acta", "detalle"].map((documentType) => entriesByType.get(documentType)).filter(Boolean);
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
  const fileInputRef = useRef(null);
  const mountedRef = useRef(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [documentTypes, setDocumentTypes] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [acknowledged, setAcknowledged] = useState(!willConfirmStatus);
  const [dragActive, setDragActive] = useState(false);
  const normalizedAllowedExtensions = (allowedExtensions?.length ? allowedExtensions : ["pdf", "doc", "docx"]).map((item) => String(item).toLowerCase());
  const acceptValue = normalizedAllowedExtensions.map((item) => `.${item}`).join(",");
  const allowedExtensionsLabel = normalizedAllowedExtensions.map((item) => item.toUpperCase()).join(" / ");
  const buildFileKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const appendFiles = (incomingFiles) => {
    const incomingList = Array.from(incomingFiles || []);
    if (!incomingList.length) {
      return;
    }

    const validFiles = incomingList.filter((file) => isAcceptedEvidenceFile(file, normalizedAllowedExtensions));
    const invalidFiles = incomingList.filter((file) => !isAcceptedEvidenceFile(file, normalizedAllowedExtensions));

    if (!validFiles.length && invalidFiles.length) {
      setError(`Formato no autorizado para evidencia. Solo se admiten ${allowedExtensionsLabel}.`);
      return;
    }

    let limitReached = false;
    setSelectedFiles((current) => {
      const seenKeys = new Set(current.map((file) => buildFileKey(file)));
      const merged = [...current];
      validFiles.forEach((file) => {
        const fileKey = buildFileKey(file);
        if (!seenKeys.has(fileKey)) {
          if (merged.length >= MAX_EVIDENCE_UPLOAD_FILES) {
            limitReached = true;
            return;
          }
          merged.push(file);
          seenKeys.add(fileKey);
        }
      });
      return merged;
    });

    if (limitReached) {
      setError(`Solo puedes preparar hasta ${MAX_EVIDENCE_UPLOAD_FILES} adjuntos por carga. El archivo Acta es obligatorio y Detalle es opcional.`);
      return;
    }

    if (invalidFiles.length) {
      setError(`Se cargaron solo los formatos autorizados. Los documentos con formato no admitido fueron omitidos. Formatos validos: ${allowedExtensionsLabel}.`);
      return;
    }

    setError("");
  };

  const handleFilesChange = (event) => {
    event.stopPropagation();
    appendFiles(event.target.files || []);
    event.target.value = "";
  };

  const openFilePicker = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!busy) {
      fileInputRef.current?.click();
    }
  };

  const handleFilePickerKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      openFilePicker(event);
    }
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

    const fileKey = `${fileToRemove.name}-${fileToRemove.size}-${fileToRemove.lastModified}`;
    setSelectedFiles((current) => current.filter((file) => buildFileKey(file) !== fileKey));
    setDocumentTypes((current) => {
      const next = { ...current };
      delete next[fileKey];
      return next;
    });
  };

  const selectedTypes = selectedFiles.map((file) => documentTypes[buildFileKey(file)] || "");
  const selectedNonEmptyTypes = selectedTypes.filter((value) => value);
  const hasMissingDocumentType = selectedTypes.some((value) => !value);
  const hasRepeatedDocumentType = new Set(selectedNonEmptyTypes).size !== selectedNonEmptyTypes.length;
  const hasActaDocument = selectedNonEmptyTypes.includes("acta");
  const submitDisabled = busy
    || selectedFiles.length === 0
    || (willConfirmStatus && !acknowledged)
    || hasMissingDocumentType
    || hasRepeatedDocumentType
    || !hasActaDocument;

  const handleSubmit = async () => {
    if (!selectedFiles.length) {
      setError("Debes seleccionar al menos una evidencia.");
      return;
    }
    if (selectedFiles.length > MAX_EVIDENCE_UPLOAD_FILES) {
      setError(`Solo se admiten ${MAX_EVIDENCE_UPLOAD_FILES} archivos por carga.`);
      return;
    }
    if (willConfirmStatus && !acknowledged) {
      setError("Debes confirmar que la carga cambiara el estado del acta.");
      return;
    }

    if (selectedTypes.some((value) => !value)) {
      setError("Debes seleccionar Acta o Detalle para cada archivo preparado.");
      return;
    }
    if (new Set(selectedTypes).size !== selectedTypes.length) {
      setError("Solo puedes cargar un archivo Acta y, si lo necesitas, un archivo Detalle por vez.");
      return;
    }
    if (!selectedTypes.includes("acta")) {
      setError("Debes cargar obligatoriamente un adjunto de tipo Acta. El tipo Detalle es opcional.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const items = selectedFiles.map((file) => ({
        file,
        documentType: documentTypes[buildFileKey(file)] || "",
      }));
      await onSubmit(items);
    } catch (submitError) {
      setError(submitError?.message || "No fue posible cargar las evidencias.");
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  };

  return (
    <div className="flex max-h-[78vh] min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex min-h-0 flex-col gap-5 border-b border-[var(--border-color)] p-5 xl:border-b-0 xl:border-r">
          <div className="grid flex-1 min-h-0 gap-3">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Agregar evidencia</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptValue}
              onChange={handleFilesChange}
              disabled={busy}
              className="hidden"
            />
            <div
              role="button"
              tabIndex={busy ? -1 : 0}
              className={`flex min-h-[14rem] flex-1 cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed px-4 py-6 text-center transition ${dragActive ? "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)]"} ${busy ? "pointer-events-none opacity-60" : ""}`}
              onClick={openFilePicker}
              onKeyDown={handleFilePickerKeyDown}
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
              <span className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Maximo {MAX_EVIDENCE_UPLOAD_FILES} archivos por carga
              </span>
            </div>
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
              {selectedFiles.length}/{MAX_EVIDENCE_UPLOAD_FILES} {selectedFiles.length === 1 ? "archivo" : "archivos"}
            </span>
          </div>
          <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_10rem_auto] gap-3 border-b border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            <span>Archivo</span>
            <span>Tipo</span>
            <span className="text-right">Accion</span>
          </div>
          <div className="min-h-[22rem] flex-1 overflow-y-auto px-5 py-4">
            {selectedFiles.length ? (
              <ol className="grid gap-3">
                {selectedFiles.map((file) => (
                  <li
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="grid gap-3 rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <EvidenceFileTypeIcon file={file} />
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{file.name}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="shrink-0 px-3 py-1.5 text-[11px]"
                        onClick={() => handleRemoveFile(file)}
                        disabled={busy}
                      >
                        <Icon name="xmark" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Quitar
                      </Button>
                    </div>
                    <select
                      value={documentTypes[buildFileKey(file)] || ""}
                      onChange={(event) => {
                        const fileKey = buildFileKey(file);
                        setDocumentTypes((current) => ({ ...current, [fileKey]: event.target.value }));
                      }}
                      disabled={busy}
                      className="w-full rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                    >
                      <option value="">Selecciona Acta o Detalle</option>
                      {HANDOVER_DOCUMENT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex h-full min-h-[18rem] items-center justify-center px-5 text-center text-sm text-[var(--text-muted)]">
                Sin adjuntos. Agrega hasta dos archivos; Acta es obligatoria y Detalle es opcional.
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

function formatDocumentTimestamp(value, fallbackLabel) {
  const normalizedValue = String(value || "").trim();
  return normalizedValue ? normalizedValue.replace("T", " ") : fallbackLabel;
}

function isPdfDocument(fileName) {
  return String(fileName || "").toLowerCase().endsWith(".pdf");
}

function triggerBlobDownload({ url, fileName }) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function BlobPdfPreviewModal({ blobUrl, fileName, showDownload = true }) {
  useEffect(() => () => URL.revokeObjectURL(blobUrl), [blobUrl]);

  const handleDownload = () => {
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = fileName;
    anchor.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <iframe
        src={blobUrl}
        title={fileName || "Documento PDF"}
        className="h-[60vh] w-full rounded-[16px] border border-[var(--border-color)]"
      />
      {showDownload ? (
        <div className="flex justify-end">
          <Button variant="primary" onClick={handleDownload}>
            <Icon name="export" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Descargar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

async function openBlobPreview({ loadBlob, fallbackName, showDownload = true }) {
  const { url, filename } = await loadBlob();
  const resolvedName = filename || fallbackName;
  if (!isPdfDocument(resolvedName)) {
    triggerBlobDownload({ url, fileName: resolvedName });
    return;
  }

  ModalManager.custom({
    title: resolvedName || "Documento PDF",
    size: "pdfViewer",
    showFooter: false,
    content: <BlobPdfPreviewModal blobUrl={url} fileName={resolvedName || "documento.pdf"} showDownload={showDownload} />,
  });
}

async function openPublicationDocumentPreview(row, document) {
  if (document?.previewFile) {
    await openBlobPreview({
      loadBlob: async () => ({ url: URL.createObjectURL(document.previewFile) }),
      fallbackName: document.originalName || document.name || "adjunto",
      showDownload: false,
    });
    return;
  }

  if (document?.origin === "generated" && document?.payload?.kind) {
    await openBlobPreview({
      loadBlob: () => fetchHandoverGeneratedPdfBlob(row.id, document.payload.kind),
      fallbackName: document.payload.name || `${document.payload.code || document.payload.kind || row.code}.pdf`,
      showDownload: false,
    });
    return;
  }

  if (document?.origin === "attachment" && document?.payload?.storedName) {
    await openBlobPreview({
      loadBlob: () => fetchHandoverEvidenceBlob(row.id, document.payload.storedName),
      fallbackName: document.payload.name || document.payload.storedName || `${row.code || "acta"}-adjunto`,
      showDownload: false,
    });
  }
}

function DocumentLibraryModal({ row, detail, onClose, onOpenGeneratedDocument, onOpenAttachment }) {
  const documents = buildHandoverDocumentLibraryEntries({
    generatedDocuments: detail?.generatedDocuments || [],
    evidenceAttachments: detail?.evidenceAttachments || [],
    generatedFallbackUploadedAt: detail?.assignmentDate || "",
  });
  const handleOpenDocument = (documentEntry) => {
    if (documentEntry.origin === "generated") {
      onOpenGeneratedDocument(documentEntry.payload);
      return;
    }
    onOpenAttachment(documentEntry.payload);
  };

  return (
    <div className="grid max-h-[78vh] gap-5 overflow-y-auto">
      <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4 text-sm text-[var(--text-secondary)]">
        <p className="font-semibold text-[var(--text-primary)]">{row.code}</p>
        <p className="mt-2">
          Revisa los documentos disponibles para esta acta.
        </p>
      </div>

      <div className="grid gap-4">
        {documents.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {documents.map((documentEntry) => (
              <div
                key={documentEntry.id}
                className="rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-panel)]">
                    <Icon name={documentEntry.iconName} size={16} className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      {getHandoverDocumentTypeLabel(documentEntry.documentType)}
                    </p>
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]" title={documentEntry.name}>
                      {documentEntry.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {formatDocumentTimestamp(documentEntry.uploadedAt, "Fecha no registrada")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0 px-3 py-1.5 text-[11px]"
                    onClick={() => handleOpenDocument(documentEntry)}
                    disabled={!documentEntry.isAvailable}
                  >
                    <Icon name="regWindowRestore" size={13} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Ver
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <MessageBanner>No hay documentos asociados todavia.</MessageBanner>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose} className="min-w-[7.5rem]">
          Cerrar
        </Button>
      </div>
    </div>
  );
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

  const isSigned = ["signed", "published"].includes(sessionData?.status) || sessionData?.documentStatus === "Firmada";
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
              El destinatario debe escanear este código desde su móvil para revisar el acta y registrar su firma digital.
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
                        <Spinner size="lg" className="border-[#bfd0e4] border-t-[#2563eb]" />
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
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa9be]">Destino</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{sessionData?.receiver?.name || row.person || "-"}</p>
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
                  ? "La firma del destinatario ya fue registrada. El acta quedó lista para que el agente continúe con la generación del ticket."
                  : isExpired
                    ? "La vigencia del QR terminó. Genera una nueva sesión para retomar la firma."
                    : isOccupied
                      ? "Este QR fue abierto desde otro dispositivo. Genera una nueva sesión si necesitas reiniciar el proceso."
                      : isClaimed
                        ? "La sesión ya fue abierta desde un dispositivo móvil y quedó bloqueada para ese equipo hasta que firme o expire."
                        : "Esperando que el destinatario abra el QR desde su móvil. Esta ventana se actualiza automáticamente."}
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

export function HandoverPage({ moduleVariant = "delivery" }) {
  const navigate = useNavigate();
  const { add } = useToast();
  const moduleConfig = getHandoverModuleConfig(moduleVariant);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ query: "", status: "" });
  const [catalog, setCatalog] = useState({ statusOptions: [] });
  const [actionConfig, setActionConfig] = useState({
    allowEvidenceUpload: true,
    allowQrSignature: true,
    qrSessionTtlMinutes: 20,
    evidenceAllowedExtensions: ["pdf", "doc", "docx"],
  });
  const [itopIntegrationUrl, setItopIntegrationUrl] = useState("");

  const kpis = useMemo(() => buildKpis(rows), [rows]);

  const loadDocuments = async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const payload = await listHandoverDocuments({
        ...nextFilters,
        handoverType: moduleConfig.typeFilter,
      });
      setRows(payload.items || []);
    } catch (loadError) {
      setError(loadError.message || `No fue posible cargar las ${moduleConfig.titleSingular.replace("acta", "actas")}.`);
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
        allowQrSignature: Boolean(bootstrap?.actions?.allowQrSignature ?? true),
        qrSessionTtlMinutes: Number(bootstrap?.actions?.qrSessionTtlMinutes || 20) || 20,
        evidenceAllowedExtensions: bootstrap?.actions?.evidenceAllowedExtensions || ["pdf", "doc", "docx"],
      });
      setItopIntegrationUrl(String(bootstrap?.itopIntegrationUrl || "").replace(/\/+$/, ""));
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
    await loadDocuments(filters);
  };

  const handleKpiFilter = async (statusValue = "") => {
    const nextFilters = { ...filters, status: statusValue };
    setFilters(nextFilters);
    await loadDocuments(nextFilters);
  };

  const handleProcess = async (row) => {
    const runEmit = async () => {
      let loadingModalId = null;
      try {
        const { jobId } = await emitHandoverDocument(row.id);
        loadingModalId = ModalManager.loading({
          title: "Procesando acta",
          message: "Generando documentos PDF y esperando la notificacion del proceso...",
          showProgress: false,
          cancelLabel: "Cerrar",
        });

        await waitForJobNotification(jobId, {
          timeoutMs: runtimeConfig.jobNotificationTimeoutMs,
        });

        ModalManager.close(loadingModalId);
        add({
          title: "Acta emitida",
          description: `El acta ${row.code} quedo en estado Emitida y sus PDFs fueron generados correctamente.`,
          tone: "success",
        });
        await loadDocuments(filters);
      } catch (processError) {
        if (loadingModalId) {
          ModalManager.close(loadingModalId);
        }
        throw processError;
      }
    };

    if (moduleConfig.key === "normalization") {
      const loadingModalId = ModalManager.loading({
        title: `Preparando ${row.code}`,
        message: "Cargando detalle del acta y administradores disponibles...",
        showProgress: false,
        showCancel: false,
      });

      try {
        const [detail, users] = await Promise.all([
          getHandoverDocument(row.id),
          getUsers(),
        ]);
        ModalManager.close(loadingModalId);

        const requesterOptions = buildNormalizationRequesterOptions(users);
        if (!requesterOptions.length) {
          ModalManager.error({
            title: "No hay administradores disponibles",
            message: "Debes vincular al menos un usuario Hub con perfil administrador y persona iTop asociada antes de procesar una acta de normalizacion.",
          });
          return;
        }

        const currentRequesterId = String(detail?.requesterAdmin?.userId || "").trim();
        let requesterModalId = null;
        requesterModalId = ModalManager.custom({
          title: `Procesar ${row.code}`,
          size: "md",
          showFooter: false,
          closeOnOverlayClick: false,
          closeOnEscape: false,
          content: (
            <NormalizationRequesterModalContent
              row={row}
              requesterOptions={requesterOptions}
              initialRequesterId={currentRequesterId}
              onCancel={() => ModalManager.close(requesterModalId)}
              onSubmit={async (requesterAdmin) => {
                const shouldUpdate =
                  String(detail?.requesterAdmin?.userId || "") !== String(requesterAdmin.userId || "")
                  || String(detail?.requesterAdmin?.itopPersonKey || "") !== String(requesterAdmin.itopPersonKey || "")
                  || String(detail?.requesterAdmin?.name || "") !== String(requesterAdmin.name || "");

                if (shouldUpdate) {
                  await updateHandoverDocument(row.id, {
                    ...detail,
                    requesterAdmin,
                  });
                }

                ModalManager.close(requesterModalId);
                await runEmit();
              }}
            />
          ),
        });
        return;
      } catch (prepareError) {
        ModalManager.close(loadingModalId);
        ModalManager.error({
          title: "No fue posible preparar el procesamiento",
          message: prepareError.message || "No fue posible cargar el solicitante administrador para esta acta.",
        });
        return;
      }
    }

    const confirmed = await ModalManager.confirm({
      title: `Procesar ${row.code}`,
      message: "Se generaran los documentos PDF del acta.",
      content: "El acta quedara en estado Emitida. El registro iTop se validara en el siguiente estado, al cargar la evidencia de cierre.",
      buttons: { cancel: "Cancelar", confirm: "Procesar" },
    });

    if (!confirmed) {
      return;
    }

    try {
      await runEmit();
    } catch (processError) {
      ModalManager.error({
        title: "No fue posible procesar el acta",
        message: processError.message || "Ocurrio un error al iniciar el proceso.",
      });
    }
  };

  const openTicketPublicationFlow = async ({ row, detail, items = [], onSuccess }) => {
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

      if (!ticketConfig.requirementEnabled) {
        await onSuccess?.(null);
        return;
      }

      const fallbackTeams = (teamsPayload.items || []).length ? [] : await searchItopTeams({ query: "" });
      const groupOptions = normalizeTicketOptions((teamsPayload.items || []).length ? teamsPayload.items : fallbackTeams);
      const initialGroupId = groupOptions.length === 1 ? groupOptions[0].value : "";
      const initialGroupAnalysts = initialGroupId ? await searchItopTeamPeople({ teamId: initialGroupId }) : [];
      const analystOptions = normalizeAnalystOptions(initialGroupAnalysts, teamsPayload.sessionUser, Boolean(initialGroupId));
      const analystOption = findCurrentAnalystOption(analystOptions, teamsPayload.sessionUser) || (analystOptions.length === 1 ? analystOptions[0] : null);
      const currentAnalystOption = buildAnalystOption(teamsPayload.sessionUser);
      const requesterOptions = buildRequesterOptions(detail, row);
      const selectedRequester = requesterOptions[0] || null;
      const documentItems = buildPublicationDocumentItems(detail, items);
      let publicationModalId = null;
      publicationModalId = ModalManager.custom({
        title: `Registrar en iTop ${row.code}`,
        size: "personDetail",
        showFooter: false,
        closeOnOverlayClick: false,
        closeOnEscape: false,
        content: (
          <ActaPublicationModalContent
            initialValues={{
              actaType: row.handoverType || "Acta",
              requesterId: selectedRequester?.value || "",
              requester: selectedRequester?.label || row.person || "",
              groupId: initialGroupId,
              groupName: initialGroupId ? groupOptions[0].label : "",
              analystId: analystOption?.value || "",
              analystName: analystOption?.label || "",
              subject: ticketConfig.requirementSubject || "",
              description: buildTicketDescription(row, ticketConfig.requirementTicketTemplate, detail, moduleConfig),
              origin: ticketConfig.requirementOrigin || "",
              impact: ticketConfig.requirementImpact || "",
              urgency: ticketConfig.requirementUrgency || "",
              priority: ticketConfig.requirementPriority || "",
              category: ticketConfig.requirementServiceId || "",
              subcategory: ticketConfig.requirementServiceSubcategoryId || "",
            }}
            options={{
              requesterOptions,
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
            documents={documentItems}
            onLoadAnalystOptions={async (teamId) => normalizeAnalystOptions(await searchItopTeamPeople({ teamId }), teamsPayload.sessionUser, Boolean(teamId))}
            onPreviewDocument={async (document) => {
              const previewLoadingId = ModalManager.loading({
                title: `Abriendo ${document.name || "adjunto"}`,
                message: "Obteniendo el documento para previsualizacion...",
                showProgress: false,
                cancelLabel: "Cerrar",
              });
              try {
                await openPublicationDocumentPreview(row, document);
              } catch (previewError) {
                ModalManager.error({
                  title: "No fue posible abrir el adjunto",
                  message: previewError.message || "El documento seleccionado no esta disponible.",
                });
              } finally {
                ModalManager.close(previewLoadingId);
              }
            }}
            submitLabel="Publicar"
            submittingLabel="Publicando..."
            onCancel={() => ModalManager.close(publicationModalId)}
            onSubmit={async (ticketPayload) => {
              ModalManager.close(publicationModalId);
              await onSuccess?.(ticketPayload);
            }}
          />
        ),
      });
    } catch (prepareError) {
      ModalManager.close(loadingModalId);
      throw prepareError;
    }
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
      setError("");
      add({
        title: "Acta anulada",
        description: `El acta ${row.code} fue marcada como Anulada en el Hub.`,
        tone: "success",
      });
      await loadDocuments(filters);
    } catch (cancelError) {
      setError(cancelError.message || "No fue posible anular el acta.");
    }
  };

  const handleRollback = async (row) => {
    const rollbackContent = actionConfig.allowEvidenceUpload
      ? "Confirma para devolver esta acta a En creacion. La fecha de asignacion se limpiara, el documento volvera a quedar editable y los PDFs generados del acta seran eliminados de forma permanente, sin posibilidad de recuperacion. Las evidencias ya registradas se conservaran."
      : "Confirma para devolver esta acta a En creacion. La fecha de asignacion se limpiara, el documento volvera a quedar editable y los PDFs generados del acta seran eliminados de forma permanente, sin posibilidad de recuperacion.";

    const confirmed = await ModalManager.confirm({
      title: "Cancelar emision",
      message: `Se revertira ${row.code} a En creacion.`,
      content: rollbackContent,
      buttons: { cancel: "Cerrar", confirm: "Cancelar emision" },
    });

    if (!confirmed) {
      return;
    }

    try {
      await rollbackHandoverDocument(row.id);
      setError("");
      add({
        title: "Emisión cancelada",
        description: `El acta ${row.code} volvió a estado En creación y quedó editable nuevamente.`,
        tone: "success",
      });
      await loadDocuments(filters);
    } catch (rollbackError) {
      setError(rollbackError.message || "No fue posible cancelar la emision del acta.");
    }
  };

  const openPdfModal = async (row) => {
    const loadingModalId = ModalManager.loading({
      title: `Preparando documentos ${row.code}`,
      message: "Obteniendo los documentos generados y adjuntos asociados a esta acta...",
      showProgress: false,
      cancelLabel: "Cerrar",
    });

    try {
      const detail = await getHandoverDocument(row.id);
      let modalId = null;
      const handleClose = () => {
        if (modalId) {
          ModalManager.close(modalId);
        }
      };

      const handleOpenGeneratedDocument = async (generatedDocument) => {
        if (!generatedDocument?.kind) {
          ModalManager.error({
            title: "Documento no disponible",
            message: "El documento seleccionado no tiene un identificador valido para su previsualizacion.",
          });
          return;
        }

        const previewLoadingId = ModalManager.loading({
          title: `Abriendo ${generatedDocument.name || generatedDocument.code || "PDF generado"}`,
          message: "Obteniendo el PDF generado para previsualizacion...",
          showProgress: false,
          cancelLabel: "Cerrar",
        });

        try {
          await openBlobPreview({
            loadBlob: () => fetchHandoverGeneratedPdfBlob(row.id, generatedDocument.kind),
            fallbackName: generatedDocument.name || `${generatedDocument.code || generatedDocument.kind || row.code}.pdf`,
          });
        } catch (downloadError) {
          ModalManager.error({
            title: "No fue posible abrir el PDF",
            message: downloadError.message || "El documento seleccionado no esta disponible para esta acta.",
          });
        } finally {
          ModalManager.close(previewLoadingId);
        }
      };

      const handleOpenAttachment = async (attachment) => {
        if (!attachment?.storedName) {
          ModalManager.error({
            title: "Adjunto no disponible",
            message: "El adjunto seleccionado no tiene una referencia valida para su apertura.",
          });
          return;
        }

        const previewLoadingId = ModalManager.loading({
          title: `Abriendo ${attachment.name || "adjunto"}`,
          message: "Obteniendo el adjunto seleccionado para previsualizacion...",
          showProgress: false,
          cancelLabel: "Cerrar",
        });

        try {
          await openBlobPreview({
            loadBlob: () => fetchHandoverEvidenceBlob(row.id, attachment.storedName),
            fallbackName: attachment.name || attachment.storedName || `${row.code || "acta"}-adjunto`,
          });
        } catch (downloadError) {
          ModalManager.error({
            title: "No fue posible abrir el adjunto",
            message: downloadError.message || "El adjunto seleccionado no esta disponible para esta acta.",
          });
        } finally {
          ModalManager.close(previewLoadingId);
        }
      };

      modalId = ModalManager.custom({
        title: `Documentos ${row.code}`,
        size: "personDetail",
        showFooter: false,
        content: (
          <DocumentLibraryModal
            row={row}
            detail={detail}
            onClose={handleClose}
            onOpenGeneratedDocument={handleOpenGeneratedDocument}
            onOpenAttachment={handleOpenAttachment}
          />
        ),
      });
    } catch (downloadError) {
      ModalManager.error({
        title: "No fue posible abrir la biblioteca documental",
        message: downloadError.message || "No fue posible cargar los documentos asociados a esta acta.",
      });
    } finally {
      ModalManager.close(loadingModalId);
    }
  };

  const openEvidenceModal = (row) => {
    const willConfirmStatus = row.status === "Emitida";
    let modalId = null;
    modalId = ModalManager.custom({
      title: `Cargar evidencia ${row.code}`,
      size: "personDetail",
      showFooter: false,
      closeOnOverlayClick: false,
      closeOnEscape: false,
      content: (
        <EvidenceUploadModal
          row={row}
          willConfirmStatus={willConfirmStatus}
          allowedExtensions={actionConfig.evidenceAllowedExtensions}
          onCancel={() => ModalManager.close(modalId)}
          onSubmit={async (items) => {
            if (willConfirmStatus) {
              try {
                const detail = await getHandoverDocument(row.id);
                const ticketConfig = await getItopTicketDefaults();

                if (!ticketConfig.requirementEnabled) {
                  const confirmLoadingModalId = ModalManager.loading({
                    title: "Confirmando acta",
                    message: "Registrando evidencias y actualizando el acta...",
                    showProgress: false,
                    showCancel: false,
                  });
                  try {
                    await uploadHandoverEvidence(row.id, items);
                    ModalManager.close(confirmLoadingModalId);
                    ModalManager.close(modalId);
                    setError("");
                    add({
                      title: "Acta confirmada",
                      description: `El acta ${row.code} quedo Confirmada y las evidencias fueron registradas correctamente.`,
                      tone: "success",
                    });
                    await loadDocuments(filters);
                  } catch (publishError) {
                    ModalManager.close(confirmLoadingModalId);
                    ModalManager.error({
                      title: "No fue posible confirmar el acta",
                      message: publishError.message || "No fue posible registrar las evidencias del acta.",
                    });
                  }
                  return;
                }

                await openTicketPublicationFlow({
                  row,
                  detail,
                  items,
                  onSuccess: async (ticketPayload) => {
                    const publishLoadingModalId = openTicketProgressModal("Finalizando acta en iTop", 0);
                    const stopProgressPulse = startTicketProgressPulse(publishLoadingModalId, 1);
                    try {
                      await uploadHandoverEvidence(row.id, items, ticketPayload);
                      stopProgressPulse();
                      updateTicketProgressModal(publishLoadingModalId, TICKET_PROGRESS_STEPS.length - 1);
                      ModalManager.close(publishLoadingModalId);
                      ModalManager.close(modalId);
                      setError("");
                      add({
                        title: "Acta confirmada",
                        description: `El acta ${row.code} quedo Confirmada y las evidencias fueron registradas correctamente.`,
                        tone: "success",
                      });
                      await loadDocuments(filters);
                    } catch (publishError) {
                      stopProgressPulse();
                      ModalManager.close(publishLoadingModalId);
                      ModalManager.error({
                        title: "No fue posible publicar el acta",
                        message: publishError.message || "No fue posible registrar el ticket y los adjuntos en iTop.",
                      });
                    }
                  },
                });
                return;
              } catch (prepareError) {
                throw prepareError;
              }
            }

            await uploadHandoverEvidence(row.id, items);
            ModalManager.close(modalId);
            setError("");
            add({
              title: willConfirmStatus ? "Acta confirmada" : "Evidencias registradas",
              description: willConfirmStatus
                ? `El acta ${row.code} quedó Confirmada y las evidencias fueron registradas correctamente.`
                : `Las evidencias del acta ${row.code} fueron registradas correctamente.`,
              tone: "success",
            });
            await loadDocuments(filters);
          }}
        />
      ),
    });
  };

  const openQrModal = async (row) => {
    const loadingModalId = ModalManager.loading({
      title: `Preparando QR ${row.code}`,
      message: "Generando la sesión de firma móvil...",
      showProgress: false,
      showCancel: false,
    });

    try {
      const sessionData = await createHandoverSignatureSession(row.id);
      ModalManager.close(loadingModalId);
      let modalId = null;
      let transitioningToTicket = false;
      const refreshSession = async () => {
        const refreshed = await getHandoverSignatureSession(row.id);
        if ((["signed", "published"].includes(refreshed.status) || refreshed.documentStatus === "Firmada") && !transitioningToTicket) {
          transitioningToTicket = true;
          if (modalId) {
            ModalManager.close(modalId);
          }
          try {
            await loadDocuments(filters);
            await handlePublishSigned({ ...row, status: "Firmada" });
          } catch (autoPublishError) {
            ModalManager.error({
              title: "No fue posible continuar con el ticket",
              message: autoPublishError.message || "La firma fue recibida, pero no se pudo abrir la finalización del ticket.",
            });
          }
          return;
        }
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
          const refreshed = await createHandoverSignatureSession(row.id, { forceNew: true });
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

  const handlePublishSigned = async (row) => {
    try {
      const detail = await getHandoverDocument(row.id);
      await openTicketPublicationFlow({
        row,
        detail,
        items: [],
        onSuccess: async (ticketPayload) => {
          const publishLoadingModalId = openTicketProgressModal("Finalizando ticket del acta firmada", 0);
          const stopProgressPulse = startTicketProgressPulse(publishLoadingModalId, 1);
          try {
            await publishSignedHandover(row.id, ticketPayload);
            stopProgressPulse();
            updateTicketProgressModal(publishLoadingModalId, TICKET_PROGRESS_STEPS.length - 1);
            ModalManager.close(publishLoadingModalId);
            setError("");
            add({
              title: "Acta confirmada",
              description: `El acta ${row.code} quedó Confirmada y su ticket se registró usando el PDF firmado por QR.`,
              tone: "success",
            });
            await loadDocuments(filters);
          } catch (publishError) {
            stopProgressPulse();
            ModalManager.close(publishLoadingModalId);
            ModalManager.error({
              title: "No fue posible publicar el ticket",
              message: publishError.message || "No fue posible cerrar el acta firmada en iTop.",
            });
          }
        },
      });
    } catch (prepareError) {
      ModalManager.error({
        title: "No fue posible continuar con el ticket",
        message: prepareError.message || "No fue posible cargar el detalle del acta firmada.",
      });
    }
  };

  const identityColumns = moduleConfig.key === "reassignment"
    ? [
        { key: "code", label: "Acta", sortable: true, headerClassName: "w-[9rem] min-w-[9rem]", cellClassName: "w-[9rem] min-w-[9rem]" },
        { key: "sourcePerson", label: "Origen", sortable: true },
        { key: "destinationPerson", label: "Destino", sortable: true },
        { key: "elaborador", label: "Elaborador", sortable: true },
      ]
    : [
        { key: "code", label: "Acta", sortable: true, headerClassName: "w-[9rem] min-w-[9rem]", cellClassName: "w-[9rem] min-w-[9rem]" },
        { key: "person", label: moduleConfig.listPersonColumnLabel || "Destinatario", sortable: true },
        { key: "elaborador", label: "Elaborador", sortable: true },
      ];

  const tableColumns = [
    ...identityColumns,
    {
      key: "itopTicketNumber",
      label: "Folio iTop",
      sortable: true,
      headerClassName: "w-[8rem] min-w-[8rem]",
      cellClassName: "w-[8rem] min-w-[8rem]",
      render: (value, row) => {
        const url = buildItopTicketUrl(itopIntegrationUrl, row.itopTicketId, row.itopTicketClass);
        if (!value) return null;
        return url
          ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-strong)] underline underline-offset-2 hover:opacity-70">{value}</a>
          : <span>{value}</span>;
      },
    },
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
      headerClassName: "w-[20rem] min-w-[20rem] text-right",
      cellClassName: "w-[20rem] min-w-[20rem] align-top",
      render: (_, row) => {
        const isDraft = row.status === "En creacion";
        const isIssued = row.status === "Emitida";
        const isSigned = row.status === "Firmada";
        const isConfirmed = row.status === "Confirmada";
        const isCancelled = row.status === "Anulada";

        const actions = [];

        if (isDraft) {
          actions.push({
            key: "edit",
            label: "Editar",
            icon: "edit",
            onClick: () => navigate(`${moduleConfig.basePath}/${row.id}`),
          });
        }

        if (isConfirmed || isIssued || isSigned || isCancelled) {
          actions.push({
            key: "view",
            label: "Ver",
            icon: "eye",
            onClick: () => navigate(`${moduleConfig.basePath}/${row.id}`),
          });
        }

        if (isDraft) {
          actions.push({
            key: "process",
            label: "Procesar",
            icon: "check",
            onClick: () => handleProcess(row),
          });
        }

        if (actionConfig.allowEvidenceUpload && isIssued) {
          actions.push({
            key: "attachment",
            label: "Adjunto",
            icon: "paperclip",
            onClick: () => openEvidenceModal(row),
          });
        }

        if (actionConfig.allowQrSignature && isIssued) {
          actions.push({
            key: "qr",
            label: "QR",
            icon: "comment",
            onClick: () => openQrModal(row),
          });
        }

        if (isSigned) {
          actions.push({
            key: "publish",
            label: "Ticket",
            icon: "paperPlane",
            onClick: () => handlePublishSigned(row),
          });
        }

        if (isIssued || isSigned || isConfirmed) {
          actions.push({
            key: "pdf",
            label: "Docs",
            icon: "download",
            onClick: () => openPdfModal(row),
          });
        }

        if (isIssued) {
          actions.push({
            key: "rollback",
            label: "Cancelar",
            icon: "history",
            onClick: () => handleRollback(row),
          });
        }

        if (isDraft || isIssued) {
          actions.push({
            key: "void",
            label: "Anular",
            icon: "xmark",
            onClick: () => handleCancel(row),
          });
        }

        const actionButtonClassName =
          "inline-flex w-full min-h-[36px] items-center justify-center gap-1.5 whitespace-nowrap px-2 py-1.5 text-[11px]";

        const renderActionButton = (action) => (
          <Button
            key={action.key}
            size="sm"
            variant="secondary"
            className={actionButtonClassName}
            onClick={action.onClick}
          >
            <Icon
              name={action.icon}
              size={14}
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            {action.label}
          </Button>
        );

        const rows = chunkActions(actions, 3);

        return (
          <div className="ml-auto flex w-full max-w-[20rem] flex-col gap-1.5">
            {rows.map((actionRow, index) => (
              <div
                key={`action-row-${row.id}-${index}`}
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${Math.max(actionRow.length, 1)}, minmax(0, 1fr))` }}
              >
                {actionRow.map(renderActionButton)}
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

      {error ? <MessageBanner tone="danger">{error}</MessageBanner> : null}

      <Panel>
        <PanelHeader eyebrow="Operacion" title={moduleConfig.filterTitle} />
        <form className="grid gap-4" onSubmit={handleFilterSubmit}>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="grid gap-3">
              <div className="grid gap-3 xl:grid-cols-4">
                <div className="min-w-0 xl:col-span-3">
                  <SearchFilterInput
                    value={filters.query}
                    placeholder={moduleConfig.searchPlaceholder}
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
          title={moduleConfig.listTitle}
          actions={(
            <>
              {rows.length ? (
                <Button variant="secondary" onClick={() => downloadListCsv(rows, moduleConfig)}>
                  <Icon name="download" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Descargar Excel
                </Button>
              ) : null}
              <Button variant="primary" onClick={() => navigate(`${moduleConfig.basePath}/nueva`)}>
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
          emptyMessage={moduleConfig.emptyListMessage}
          pagination
          pageSize={30}
          paginationAlwaysVisible
        />
      </Panel>
    </div>
  );
}
