import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalManager from "../../components/ui/modal";
import { ActaPublicationModalContent, DataTable, FilterDropdown, KpiCard, Panel, PanelHeader } from "../../components/ui/general";
import { SearchFilterInput } from "../../components/ui/general/SearchFilterInput";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Icon } from "../../components/ui/icon/Icon";
import { Button } from "../../ui/Button";
import { useToast } from "../../ui";
import {
  emitHandoverDocument,
  fetchHandoverEvidenceBlob,
  fetchHandoverGeneratedPdfBlob,
  getHandoverBootstrap,
  getHandoverDocument,
  listHandoverDocuments,
  rollbackHandoverDocument,
  uploadHandoverEvidence,
  updateHandoverDocumentStatus,
} from "../../services/handover-service";
import { getItopCurrentUserTeams, getItopRequirementCatalog, getItopTicketDefaults, searchItopTeamPeople, searchItopTeams } from "../../services/itop-service";
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

const HANDOVER_FILTER_CONTROL_HEIGHT = "h-[66px]";
const MAX_EVIDENCE_UPLOAD_FILES = 2;

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
      setError(`Solo puedes preparar hasta ${MAX_EVIDENCE_UPLOAD_FILES} adjuntos por carga. Usa un archivo de tipo Acta y otro de tipo Detalle.`);
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
  const submitDisabled = busy
    || selectedFiles.length === 0
    || (willConfirmStatus && !acknowledged)
    || hasMissingDocumentType
    || hasRepeatedDocumentType;

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
      setError("Solo puedes cargar un archivo Acta y un archivo Detalle por vez.");
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
                Sin adjuntos. Agrega hasta dos archivos y asigna su tipo antes de confirmar.
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

export function HandoverPage({ moduleVariant = "delivery" }) {
  const navigate = useNavigate();
  const { add } = useToast();
  const moduleConfig = getHandoverModuleConfig(moduleVariant);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ query: "", status: "" });
  const [catalog, setCatalog] = useState({ statusOptions: [] });
  const [actionConfig, setActionConfig] = useState({ allowEvidenceUpload: true, evidenceAllowedExtensions: ["pdf", "doc", "docx"] });
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

  const handleProcess = async (row) => {
    const confirmed = await ModalManager.confirm({
      title: `Procesar ${row.code}`,
      message: "Se generaran los documentos PDF del acta.",
      content: "El acta quedara en estado Emitida. El registro iTop se validara en el siguiente estado, al cargar la evidencia de cierre.",
      buttons: { cancel: "Cancelar", confirm: "Procesar" },
    });

    if (!confirmed) {
      return;
    }

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
      ModalManager.error({
        title: "No fue posible procesar el acta",
        message: processError.message || "Ocurrio un error al iniciar el proceso.",
      });
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
              let loadingModalId = null;
              try {
                loadingModalId = ModalManager.loading({
                  title: "Preparando ticket iTop",
                  message: "Cargando configuracion, catalogos y grupos del usuario conectado...",
                  showProgress: false,
                  cancelLabel: "Cerrar",
                });

                const [ticketConfig, catalogPayload, teamsPayload, detail] = await Promise.all([
                  getItopTicketDefaults(),
                  getItopRequirementCatalog(),
                  getItopCurrentUserTeams(),
                  getHandoverDocument(row.id),
                ]);

                ModalManager.close(loadingModalId);

                if (!ticketConfig.requirementEnabled) {
                  const confirmLoadingModalId = ModalManager.loading({
                    title: "Confirmando acta",
                    message: "Registrando evidencias y actualizando el acta...",
                    showProgress: false,
                    cancelLabel: "Cerrar",
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
                        const publishLoadingModalId = ModalManager.loading({
                          title: "Publicando en iTop",
                          message: "Registrando ticket, vinculando activos y cargando adjuntos...",
                          showProgress: false,
                          cancelLabel: "Cerrar",
                        });
                        try {
                          await uploadHandoverEvidence(row.id, items, ticketPayload);
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
                          ModalManager.close(publishLoadingModalId);
                          ModalManager.error({
                            title: "No fue posible publicar el acta",
                            message: publishError.message || "No fue posible registrar el ticket y los adjuntos en iTop.",
                          });
                        }
                      }}
                    />
                  ),
                });
                return;
              } catch (prepareError) {
                if (loadingModalId) {
                  ModalManager.close(loadingModalId);
                }
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

        if (isConfirmed || isIssued || isCancelled) {
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

        if (isIssued || isConfirmed) {
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

        const totalActions = actions.length;

        if (totalActions <= 2) {
          return (
            <div className="ml-auto grid w-full max-w-[20rem] grid-cols-2 gap-1.5">
              {actions.map(renderActionButton)}
            </div>
          );
        }

        if (totalActions === 3) {
          return (
            <div className="ml-auto grid w-full max-w-[20rem] grid-cols-3 gap-1.5">
              {actions.map(renderActionButton)}
            </div>
          );
        }

        const firstRow = actions.slice(0, 3);
        const secondRow = actions.slice(3);

        return (
          <div className="ml-auto flex w-full max-w-[20rem] flex-col gap-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              {firstRow.map(renderActionButton)}
            </div>

            <div className={`grid gap-1.5 ${secondRow.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {secondRow.map(renderActionButton)}
            </div>
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

        <DataTable columns={tableColumns} rows={rows} loading={loading} emptyMessage={moduleConfig.emptyListMessage} />
      </Panel>
    </div>
  );
}
