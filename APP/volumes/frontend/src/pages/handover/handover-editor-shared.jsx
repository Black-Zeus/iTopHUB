import { useEffect, useState } from "react";
import { CollapseToggleButton, Panel, PanelHeader } from "../../components/ui/general";
import { Icon } from "../../components/ui/icon/Icon";
import ModalManager from "../../components/ui/modal";
import { Button } from "../../ui/Button";
import { fetchHandoverEvidenceBlob, fetchHandoverGeneratedPdfBlob } from "../../services/handover-service";
import {
  buildHandoverDocumentLibraryEntries,
  getHandoverDocumentTypeLabel,
} from "./handover-document-library";

export const INPUT_CLASS_NAME = "h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none";
export const TEXTAREA_CLASS_NAME = "w-full rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none";
const SECONDARY_RECEIVER_ROLE_OPTIONS = ["Contraturno", "Referente de area", "Respaldo operativo", "Testigo"];

const formatAttachmentName = (filename = "") => {
  const lastDot = filename.lastIndexOf(".");
  const maxLength = 10;
  if (lastDot <= 0) {
    return filename.length > maxLength ? `${filename.slice(0, (maxLength - 3))}...` : filename;
  }

  const baseName = filename.slice(0, lastDot);
  const extension = filename.slice(lastDot + 1);

  if (baseName.length <= maxLength) {
    return `${baseName}.${extension}`;
  }

  return `${baseName.slice(0, (maxLength - 3))}...${extension}`;
}

function normalizeComparisonText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function matchesTemplateCmdbClass(assetClassName, templateClassLabel) {
  const normalizedAssetClass = normalizeComparisonText(assetClassName);
  const normalizedTemplateClass = normalizeComparisonText(templateClassLabel);

  if (!normalizedTemplateClass) {
    return true;
  }

  return normalizedAssetClass === normalizedTemplateClass;
}

export { matchesTemplateCmdbClass };

export function getAssetAssignmentRestriction(asset) {
  const status = String(asset?.status || "").trim();
  const assignedUser = String(asset?.assignedUser || "").trim();
  const normalizedStatus = normalizeComparisonText(status);
  const normalizedAssignedUser = normalizeComparisonText(assignedUser);

  if (normalizedStatus !== "stock") {
    return `No se puede asignar porque esta en estado ${status || "desconocido"}.`;
  }

  if (normalizedAssignedUser && normalizedAssignedUser !== "sin asignar") {
    return `No se puede asignar porque ya esta asociado a ${assignedUser}.`;
  }

  return "";
}

function normalizeSecondaryReceiverRole(value) {
  if (value === "Apoyo") {
    return "Respaldo operativo";
  }
  return SECONDARY_RECEIVER_ROLE_OPTIONS.includes(value) ? value : "Contraturno";
}

export function createEmptyForm(bootstrap) {
  return {
    documentNumber: "",
    creationDate: bootstrap?.defaults?.creationDate || bootstrap?.defaults?.generatedAt || "",
    assignmentDate: bootstrap?.defaults?.assignmentDate || "",
    evidenceDate: bootstrap?.defaults?.evidenceDate || "",
    generatedDocuments: [],
    evidenceAttachments: bootstrap?.defaults?.evidenceAttachments || [],
    itopTicket: null,
    status: "En creacion",
    handoverType: "Entrega inicial",
    reason: "",
    notes: "",
    owner: bootstrap?.sessionUser || { id: null, name: "", username: "" },
    receiver: null,
    additionalReceivers: [],
    items: [],
  };
}

export function createFormFromDetail(detail, bootstrap) {
  return {
    documentNumber: detail.documentNumber || "",
    creationDate: detail.creationDate || detail.generatedAt || bootstrap?.defaults?.creationDate || "",
    assignmentDate: detail.assignmentDate || "",
    evidenceDate: detail.evidenceDate || "",
    generatedDocuments: detail.generatedDocuments || [],
    evidenceAttachments: detail.evidenceAttachments || [],
    itopTicket: detail.itopTicket || null,
    status: detail.status || "En creacion",
    handoverType: detail.handoverType || "Entrega inicial",
    reason: detail.reason || "",
    notes: detail.notes || "",
    owner: {
      id: detail.owner?.userId || bootstrap?.sessionUser?.id || null,
      name: detail.owner?.name || bootstrap?.sessionUser?.name || "",
      username: bootstrap?.sessionUser?.username || "",
    },
    receiver: detail.receiver || null,
    additionalReceivers: (detail.additionalReceivers || []).map((person) => ({
      ...person,
      assignmentRole: normalizeSecondaryReceiverRole(person.assignmentRole),
    })),
    items: detail.items || [],
  };
}

export function cloneTemplate(template) {
  return {
    templateId: template.id,
    templateName: template.name,
    templateDescription: template.description,
    answers: (template.checks || []).map((check) => ({
      checklistItemId: check.id,
      name: check.name,
      description: check.description,
      type: check.type,
      optionA: check.optionA || "",
      optionB: check.optionB || "",
      value: check.type === "Check" ? false : "",
    })),
  };
}

export function MessageBanner({ tone = "default", children }) {
  const className = tone === "danger"
    ? "border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)]"
    : tone === "success"
      ? "border-[rgba(127,191,156,0.45)] bg-[rgba(127,191,156,0.12)]"
      : "border-[var(--border-color)] bg-[var(--bg-app)]";

  return (
    <div className={`rounded-[18px] border px-4 py-3 text-sm text-[var(--text-primary)] ${className}`}>
      {children}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
      {children}
    </label>
  );
}

function ReadOnlyValue({ value, placeholder = "Sin dato" }) {
  return (
    <div className="min-h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)]">
      {String(value || "").trim() || placeholder}
    </div>
  );
}

function ResultCard({ title, subtitle, helper, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        {subtitle ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p> : null}
        {helper ? <p className="mt-1 text-xs text-[var(--text-muted)]">{helper}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function RoleChip({ label, tone = "default" }) {
  const className = tone === "primary"
    ? "border-[rgba(99,177,255,0.38)] bg-[rgba(99,177,255,0.14)] text-[var(--text-primary)]"
    : "border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-secondary)]";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${className}`}>
      {label}
    </span>
  );
}

function SecondaryRoleMenu({ personId, currentRole, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center gap-2"
      >
        <RoleChip label={currentRole} />
        <Icon name={isOpen ? "chevronUp" : "chevronDown"} size={12} className="h-3 w-3 text-[var(--text-muted)]" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+0.45rem)] z-20 min-w-[220px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-soft)]">
          <div className="grid gap-1">
            {SECONDARY_RECEIVER_ROLE_OPTIONS.map((option) => (
              <button
                key={`${personId}-${option}`}
                type="button"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`rounded-[12px] px-3 py-2 text-left text-sm transition ${option === currentRole
                  ? "bg-[var(--bg-app)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"
                  }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChecklistTemplatePicker({
  assetId,
  availableTemplates,
  selectedTemplateId,
  onChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedTemplate = availableTemplates.find((template) => String(template.id) === String(selectedTemplateId || ""));

  if (!availableTemplates.length) {
    return (
      <div className="rounded-[16px] border border-dashed border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-secondary)]">
        No hay plantillas disponibles para este activo.
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-left transition hover:border-[var(--border-strong)]"
      >
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Seleccionar plantilla
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
            {selectedTemplate?.name || "Selecciona una plantilla"}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">
            {selectedTemplate?.description || "Elige un checklist disponible para este activo."}
          </p>
        </div>
        <Icon name={isOpen ? "chevronUp" : "chevronDown"} size={14} className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-[min(320px,calc(100vh-12rem))] overflow-y-auto rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-soft)]">
          <div className="grid gap-2">
            {availableTemplates.map((template) => {
              const isSelected = String(template.id) === String(selectedTemplateId || "");

              return (
                <button
                  key={`${assetId}-${template.id}`}
                  type="button"
                  onClick={() => {
                    onChange(String(template.id));
                    setIsOpen(false);
                  }}
                  className={`rounded-[14px] border px-4 py-3 text-left transition ${isSelected
                    ? "border-[rgba(81,152,194,0.26)] bg-[var(--accent-soft)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
                    : "border-transparent bg-[var(--bg-app)] hover:border-[var(--border-color)]"
                    }`}
                >
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{template.name}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{template.description || "Sin descripcion adicional."}</p>
                  <p className="mt-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {template.checks?.length || 0} checks
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CornerIconButton({ iconName, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
      aria-label={label}
      title={label}
    >
      <Icon name={iconName} size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </button>
  );
}

function ChecklistAnswerField({ answer, onChange, groupName }) {
  if (answer.type === "Input text") {
    return <input type="text" value={answer.value || ""} onChange={(event) => onChange(event.target.value)} className={INPUT_CLASS_NAME} placeholder="Completar campo" />;
  }

  if (answer.type === "Text area") {
    return <textarea rows="4" value={answer.value || ""} onChange={(event) => onChange(event.target.value)} className={TEXTAREA_CLASS_NAME} placeholder="Completar detalle" />;
  }

  if (answer.type === "Check") {
    return (
      <label className="inline-flex items-center gap-3 rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)]">
        <input type="checkbox" checked={Boolean(answer.value)} onChange={(event) => onChange(event.target.checked)} />
        <span>Validado</span>
      </label>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {[answer.optionA, answer.optionB].filter(Boolean).map((option) => (
        <label key={option} className="inline-flex items-center gap-3 rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)]">
          <input type="radio" name={groupName} checked={answer.value === option} onChange={() => onChange(option)} />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function ChecklistAnswerReadOnly({ answer }) {
  const plainValue = (() => {
    if (answer.type === "Check") {
      return answer.value ? "Si" : "No";
    }

    if (answer.type === "Option / Radio") {
      return String(answer.value || "").trim() || "Sin respuesta registrada";
    }

    return String(answer.value || "").trim() || "Sin respuesta registrada";
  })();

  const isLongText = answer.type === "Text area";

  return (
    <div className={`text-sm text-[var(--text-primary)] ${isLongText ? "whitespace-pre-wrap leading-6" : ""}`}>
      {plainValue}
    </div>
  );
}

function AttachmentPreviewContent({ attachment, documentId }) {
  const [state, setState] = useState("loading");
  const [blobUrl, setBlobUrl] = useState(null);
  const isPdf = String(attachment.name || "").toLowerCase().endsWith(".pdf");

  useEffect(() => {
    let revoked = false;
    fetchHandoverEvidenceBlob(documentId, attachment.storedName)
      .then(({ url }) => {
        if (!revoked) {
          setBlobUrl(url);
          setState("ready");
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (!revoked) {
          setState("error");
        }
      });

    return () => {
      revoked = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, []);

  const handleDownload = () => {
    if (!blobUrl) {
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = attachment.name || attachment.storedName || "adjunto";
    anchor.click();
  };

  if (state === "loading") {
    return (
      <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
        Cargando adjunto...
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-[var(--text-secondary)]">No fue posible obtener el adjunto.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isPdf ? (
        <iframe
          src={blobUrl}
          title={attachment.name || "Adjunto"}
          className="h-[60vh] w-full rounded-[16px] border border-[var(--border-color)]"
        />
      ) : (
        <div className="flex min-h-[120px] items-center justify-center rounded-[16px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] text-sm text-[var(--text-secondary)]">
          Vista previa no disponible para este formato.
        </div>
      )}
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleDownload}>
          <Icon name="export" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Descargar
        </Button>
      </div>
    </div>
  );
}

function openAttachmentPreview(attachment, documentId) {
  const isPdf = String(attachment.name || "").toLowerCase().endsWith(".pdf");
  ModalManager.custom({
    title: attachment.name || "Adjunto",
    size: isPdf ? "pdfViewer" : "medium",
    showFooter: false,
    content: <AttachmentPreviewContent attachment={attachment} documentId={documentId} />,
  });
}

function GeneratedDocumentPreviewContent({ generatedDocument, documentId }) {
  const [state, setState] = useState("loading");
  const [blobUrl, setBlobUrl] = useState(null);
  const [resolvedFilename, setResolvedFilename] = useState(null);

  useEffect(() => {
    let revoked = false;
    fetchHandoverGeneratedPdfBlob(documentId, generatedDocument.kind)
      .then(({ url, filename }) => {
        if (!revoked) {
          setBlobUrl(url);
          setResolvedFilename(filename || generatedDocument.name || `${generatedDocument.code || generatedDocument.kind}.pdf`);
          setState("ready");
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (!revoked) {
          setState("error");
        }
      });

    return () => {
      revoked = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, []);

  const handleDownload = () => {
    if (!blobUrl) {
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = resolvedFilename || generatedDocument.name || `${generatedDocument.code || generatedDocument.kind}.pdf`;
    anchor.click();
  };

  if (state === "loading") {
    return (
      <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
        Cargando PDF...
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-[var(--text-secondary)]">No fue posible obtener el PDF generado.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <iframe
        src={blobUrl}
        title={generatedDocument.name || generatedDocument.code || "PDF generado"}
        className="h-[60vh] w-full rounded-[16px] border border-[var(--border-color)]"
      />
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleDownload}>
          <Icon name="export" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Descargar
        </Button>
      </div>
    </div>
  );
}

function openGeneratedDocumentPreview(generatedDocument, documentId) {
  ModalManager.custom({
    title: generatedDocument.name || generatedDocument.code || "PDF generado",
    size: "pdfViewer",
    showFooter: false,
    content: <GeneratedDocumentPreviewContent generatedDocument={generatedDocument} documentId={documentId} />,
  });
}

function EditorSectionPanel({ eyebrow, title, helper, isCollapsed, onToggle, children, className = "" }) {
  return (
    <Panel className={`bg-[var(--bg-app)] transition-[padding,box-shadow] duration-300 ease-out ${className}`}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {eyebrow}
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
          {helper ? (
            <div
              className={`grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-out ${isCollapsed ? "overflow-hidden" : "overflow-visible"}`}
              style={{
                gridTemplateRows: isCollapsed ? "0fr" : "1fr",
                opacity: isCollapsed ? 0 : 1,
                marginTop: isCollapsed ? 0 : 16,
              }}
            >
              <div className="min-h-0">
                <p className="max-w-3xl text-sm text-[var(--text-secondary)]">{helper}</p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex md:justify-end">
          <CollapseToggleButton
            isCollapsed={isCollapsed}
            onClick={onToggle}
            collapsedLabel={`Expandir ${title}`}
            expandedLabel={`Contraer ${title}`}
          />
        </div>
      </div>
      <div
        className={`grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-out ${isCollapsed ? "overflow-hidden" : "overflow-visible"}`}
        style={{
          gridTemplateRows: isCollapsed ? "0fr" : "1fr",
          opacity: isCollapsed ? 0 : 1,
          marginTop: isCollapsed ? 0 : 20,
        }}
      >
        <div className="min-h-0">
          <div className={`grid gap-4 ${isCollapsed ? "pointer-events-none" : ""}`}>
            {children}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function HandoverEditorSections({
  form,
  statusOptions,
  peopleLoading,
  peopleResults,
  personSearchQuery,
  setPersonSearchQuery,
  personSearchInputRef,
  receiverSelectionEndRef,
  setForm,
  assetLoading,
  assetResults,
  assetSearchQuery,
  setAssetSearchQuery,
  activeTemplates,
  selectedTemplateByAsset,
  setSelectedTemplateByAsset,
  addAssetToForm,
  requestRemoveAssetFromForm,
  updateItemNotes,
  addChecklistToAsset,
  requestRemoveChecklistFromAsset,
  updateChecklistAnswer,
  collapsedSections,
  toggleSection,
  isCreateMode,
  notesPlaceholder,
  minCharsPeople,
  minCharsAssets,
  selectPrimaryReceiver,
  promoteAdditionalReceiverToPrimary,
  requestRemovePrimaryReceiver,
  addAdditionalReceiver,
  requestRemoveAdditionalReceiver,
  updateAdditionalReceiverRole,
  readOnly = false,
  documentId = null,
  itopIntegrationUrl = "",
}) {
  const topPanelsExpanded = !collapsedSections.document && !collapsedSections.receiver;
  const shouldShowItopSection = readOnly && form.status === "Confirmada";
  const [collapsedAssets, setCollapsedAssets] = useState({});
  const [collapsedChecklists, setCollapsedChecklists] = useState({});
  const libraryDocuments = buildHandoverDocumentLibraryEntries({
    generatedDocuments: form.generatedDocuments || [],
    evidenceAttachments: form.evidenceAttachments || [],
    generatedFallbackUploadedAt: form.assignmentDate || "",
  });

  const toggleAsset = (assetId) => {
    setCollapsedAssets((current) => ({
      ...current,
      [assetId]: !current[assetId],
    }));
  };

  const toggleChecklist = (assetId, templateId) => {
    const checklistKey = `${assetId}-${templateId}`;
    setCollapsedChecklists((current) => ({
      ...current,
      [checklistKey]: !current[checklistKey],
    }));
  };

  const openLibraryDocumentPreview = (documentEntry) => {
    if (!documentId) {
      return;
    }
    if (documentEntry.origin === "generated") {
      openGeneratedDocumentPreview(documentEntry.payload, documentId);
      return;
    }
    openAttachmentPreview(documentEntry.payload, documentId);
  };

  return (
    <div className="grid gap-5">
      <div className={`grid gap-5 xl:grid-cols-2 ${topPanelsExpanded ? "xl:items-stretch" : "xl:items-start"}`}>
        <EditorSectionPanel
          eyebrow="Emision"
          title="Datos del documento"
          helper="Completa la informacion base del acta antes de asociar destinatario y activos."
          isCollapsed={collapsedSections.document}
          onToggle={() => toggleSection("document")}
          className={topPanelsExpanded ? "h-full" : ""}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {!isCreateMode ? (
              <div className="md:col-span-2 grid gap-4">
                <div className="grid gap-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 md:grid-cols-3">
                  <Field label="Estado del acta">
                    <ReadOnlyValue value={form.status} />
                  </Field>
                  <Field label="Fecha creacion">
                    <ReadOnlyValue value={form.creationDate} />
                  </Field>
                  <Field label="Fecha asignacion">
                    <ReadOnlyValue value={form.assignmentDate} placeholder="Sin dato" />
                  </Field>
                </div>

                <div className="grid gap-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Documentos asociados</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Vista unificada de los documentos disponibles para esta acta.</p>
                  </div>

                  {libraryDocuments.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {libraryDocuments.map((documentEntry) => (
                        <div key={documentEntry.id} className="rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-panel)]">
                              <Icon name={documentEntry.iconName} size={16} className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                                {getHandoverDocumentTypeLabel(documentEntry.documentType)}
                              </p>
                              <p className="text-sm font-semibold text-[var(--text-primary)]" title={documentEntry.name}>
                                {formatAttachmentName(documentEntry.name)}
                              </p>
                              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                {(documentEntry.uploadedAt || "Fecha no registrada").replace("T", " ")}
                              </p>
                            </div>
                            {documentId ? (
                              <button
                                type="button"
                                onClick={() => openLibraryDocumentPreview(documentEntry)}
                                className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                                disabled={!documentEntry.isAvailable}
                              >
                                <Icon name="regWindowRestore" size={13} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                Ver
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <MessageBanner>No hay documentos asociados todavia.</MessageBanner>
                  )}
                </div>
              </div>
            ) : null}
            <div className="md:col-span-2">
              <Field label="Motivo de entrega">
                {readOnly
                  ? <ReadOnlyValue value={form.reason} placeholder="Sin motivo registrado" />
                  : <textarea rows="3" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} className={TEXTAREA_CLASS_NAME} placeholder="Indica por que se emite esta acta" />
                }
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Observaciones generales">
                {readOnly
                  ? <ReadOnlyValue value={form.notes} placeholder="Sin observaciones registradas" />
                  : <textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={TEXTAREA_CLASS_NAME} placeholder={notesPlaceholder || "Registra condiciones de entrega, accesorios, estado visible y acuerdos relevantes"} />
                }
              </Field>
            </div>
          </div>
        </EditorSectionPanel>

        <div className="grid gap-5">
          {shouldShowItopSection ? (
            <EditorSectionPanel
              eyebrow="iTop"
              title="Ticket asociado"
              helper="Datos principales registrados en iTop para esta acta."
              isCollapsed={Boolean(collapsedSections.itop)}
              onToggle={() => toggleSection("itop")}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Numero de ticket">
                  {(() => {
                    const base = String(itopIntegrationUrl || "").trim().replace(/\/+$/, "");
                    const ticketId = String(form.itopTicket?.id || "").trim();
                    const ticketClass = String(form.itopTicket?.className || "UserRequest").trim();
                    const url = base && ticketId
                      ? `${base}/pages/UI.php?operation=details&class=${encodeURIComponent(ticketClass)}&id=${encodeURIComponent(ticketId)}`
                      : null;
                    return (
                      <div className="flex items-stretch gap-2">
                        <div className="flex-1 min-w-0">
                          <ReadOnlyValue value={form.itopTicket?.number} placeholder="Sin ticket registrado" />
                        </div>
                        {url && (
                          <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir en iTop" className="flex-shrink-0 flex items-center justify-center w-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--accent-strong)] hover:bg-[var(--accent-soft)] transition-colors">
                            <Icon name="external-link" size={15} />
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </Field>
                <Field label="Solicitante">
                  <ReadOnlyValue value={form.itopTicket?.requester} />
                </Field>
                <Field label="Asignado">
                  <ReadOnlyValue value={form.itopTicket?.analystName || form.itopTicket?.groupName} />
                </Field>
                <Field label="Criticidad">
                  <ReadOnlyValue
                    value={[
                      form.itopTicket?.impactLabel || form.itopTicket?.impact,
                      form.itopTicket?.urgencyLabel || form.itopTicket?.urgency,
                      form.itopTicket?.priorityLabel || form.itopTicket?.priority,
                    ].filter(Boolean).join(" / ")}
                  />
                </Field>
                <Field label="Categoria">
                  <ReadOnlyValue value={form.itopTicket?.categoryLabel || form.itopTicket?.category} />
                </Field>
                <Field label="Subcategoria">
                  <ReadOnlyValue value={form.itopTicket?.subcategoryLabel || form.itopTicket?.subcategory} />
                </Field>
              </div>
            </EditorSectionPanel>
          ) : null}

          <EditorSectionPanel
            eyebrow="Destino"
            title="Persona que recibe"
            helper="Busca en Personas de iTop, define una persona principal y, si hace falta, agrega participantes secundarios con un motivo claro."
            isCollapsed={collapsedSections.receiver}
            onToggle={() => toggleSection("receiver")}
            className={topPanelsExpanded ? "h-full" : ""}
          >
            <div className="grid gap-4">
              {!readOnly ? (
                <div className="relative z-10">
                  <Field label="Buscar persona">
                    <input ref={personSearchInputRef} type="search" value={personSearchQuery} onChange={(event) => setPersonSearchQuery(event.target.value)} className={INPUT_CLASS_NAME} placeholder={`Escribe nombre, identificador o correo (${minCharsPeople}+ caracteres)`} />
                  </Field>

                  {personSearchQuery.trim().length > 0 && personSearchQuery.trim().length < minCharsPeople ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20">
                      <MessageBanner>Ingresa al menos {minCharsPeople} caracteres para buscar en Personas de iTop.</MessageBanner>
                    </div>
                  ) : null}

                  {peopleResults.length ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 max-h-[320px] overflow-y-auto rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-soft)]">
                      <div className="grid gap-3">
                        {peopleResults.map((person) => (
                          <ResultCard
                            key={person.id}
                            title={person.name}
                            subtitle={`${person.code}${person.email ? ` / ${person.email}` : ""}`}
                            helper={[person.role, person.status].filter(Boolean).join(" / ")}
                            actions={(
                              <>
                                <Button size="sm" variant="secondary" onClick={() => selectPrimaryReceiver(person)}>Principal</Button>
                                <Button size="sm" variant="secondary" onClick={() => addAdditionalReceiver(person)}>Agregar secundario</Button>
                              </>
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  ) : peopleLoading ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20">
                      <MessageBanner>Buscando personas...</MessageBanner>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {form.receiver ? (
                <div className="grid gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Responsable principal</div>
                  <div className="rounded-[18px] border border-[rgba(99,177,255,0.38)] bg-[rgba(99,177,255,0.08)] px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <RoleChip label="Principal" tone="primary" />
                        <p className="mt-3 truncate text-sm font-semibold text-[var(--text-primary)]">{form.receiver.name}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{`${form.receiver.code || "Sin codigo"}${form.receiver.email ? ` / ${form.receiver.email}` : ""}`}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{[form.receiver.role, form.receiver.status].filter(Boolean).join(" / ")}</p>
                      </div>
                      {!readOnly ? (
                        <div className="flex items-center gap-2">
                          <CornerIconButton iconName="xmark" label="Quitar principal" onClick={requestRemovePrimaryReceiver} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <MessageBanner>No hay persona principal seleccionada para esta acta.</MessageBanner>
              )}

              {form.additionalReceivers?.length ? (
                <div className="grid gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Participantes secundarios</div>
                  {form.additionalReceivers.map((person) => (
                    <div key={`secondary-${person.id}`} className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {readOnly
                            ? <RoleChip label={normalizeSecondaryReceiverRole(person.assignmentRole)} />
                            : (
                              <SecondaryRoleMenu
                                personId={person.id}
                                currentRole={normalizeSecondaryReceiverRole(person.assignmentRole)}
                                onChange={(nextRole) => updateAdditionalReceiverRole(person.id, nextRole)}
                              />
                            )
                          }
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{person.name}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">{`${person.code || "Sin codigo"}${person.email ? ` / ${person.email}` : ""}`}</p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">{[person.role, person.status].filter(Boolean).join(" / ")}</p>
                        </div>
                        {!readOnly ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" variant="secondary" onClick={() => promoteAdditionalReceiverToPrimary(person.id)}>
                              Hacer principal
                            </Button>
                            <CornerIconButton iconName="xmark" label="Quitar secundario" onClick={() => requestRemoveAdditionalReceiver(person.id)} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div ref={receiverSelectionEndRef} />
            </div>
          </EditorSectionPanel>
        </div>
      </div>
{!readOnly ? (
      <EditorSectionPanel
        eyebrow="Activos"
        title="Activos incluidos"
        
        isCollapsed={collapsedSections.assets}
        onToggle={() => toggleSection("assets")}
      >
        {!readOnly ? (
          <div className="relative z-10 mb-16">
            <Field label="Buscar activo">
              <input type="search" value={assetSearchQuery} onChange={(event) => setAssetSearchQuery(event.target.value)} className={INPUT_CLASS_NAME} placeholder={`Codigo, nombre o serie (${minCharsAssets}+ caracteres)`} />
            </Field>

            {assetSearchQuery.trim().length > 0 && assetSearchQuery.trim().length < minCharsAssets ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20">
                <MessageBanner>Ingresa al menos {minCharsAssets} caracteres para buscar dispositivos autorizados en CMDB.</MessageBanner>
              </div>
            ) : null}

            {assetResults.length ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 max-h-[min(320px,calc(100vh-12rem))] overflow-y-auto rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-soft)]">
                <div className="grid gap-3">
                  {assetResults.map((asset) => {
                    const restrictionMessage = getAssetAssignmentRestriction(asset);

                    return (
                      <ResultCard
                        key={asset.id}
                        title={`${asset.code} / ${asset.name}`}
                        subtitle={[asset.className, asset.serial].filter(Boolean).join(" / ")}
                        helper={[asset.status, asset.assignedUser, restrictionMessage].filter(Boolean).join(" / ")}
                        actions={<Button size="sm" variant="secondary" onClick={() => addAssetToForm(asset)} disabled={Boolean(restrictionMessage)}>Agregar</Button>}
                      />
                    );
                  })}
                </div>
              </div>
            ) : assetLoading ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20">
                <MessageBanner>Buscando activos autorizados...</MessageBanner>
              </div>
            ) : null}
          </div>
        ) : null}
      </EditorSectionPanel>
) : null}
      {form.items.length ? (
        <div className="grid gap-4">
          {form.items.map((item) => {
            const assetId = item.asset?.id;
            const availableTemplates = activeTemplates.filter((template) => (
              matchesTemplateCmdbClass(item.asset?.className, template.cmdbClassLabel)
              && !item.checklists.some((checklist) => checklist.templateId === template.id)
            ));
            const isCollapsed = Boolean(collapsedAssets[assetId]);

            return (
              <Panel key={assetId} className="bg-[var(--bg-app)]">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div className="min-w-0">
                    <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Activo agregado</p>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">{item.asset?.code} / {item.asset?.name}</h3>
                    <p className="mt-3 text-sm text-[var(--text-secondary)]">{[item.asset?.className, item.asset?.brand, item.asset?.model].filter(Boolean).join(" / ")}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{[item.asset?.serial, item.asset?.status, item.asset?.assignedUser].filter(Boolean).join(" / ")}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-3">
                    {!readOnly ? (
                      <Button size="sm" variant="secondary" onClick={() => requestRemoveAssetFromForm(item.asset)}>
                        <Icon name="xmark" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Quitar
                      </Button>
                    ) : null}
                    <CollapseToggleButton
                      isCollapsed={isCollapsed}
                      onClick={() => toggleAsset(assetId)}
                      collapsedLabel={`Expandir ${item.asset?.code || "activo"}`}
                      expandedLabel={`Contraer ${item.asset?.code || "activo"}`}
                    />
                  </div>
                </div>

                <div
                  className={`grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-out ${isCollapsed ? "overflow-hidden" : "overflow-visible"}`}
                  style={{
                    gridTemplateRows: isCollapsed ? "0fr" : "1fr",
                    opacity: isCollapsed ? 0 : 1,
                    marginTop: isCollapsed ? 0 : 20,
                  }}
                >
                  <div className="min-h-0">
                    <div className={`grid gap-5 ${isCollapsed ? "pointer-events-none" : ""}`}>
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)]">
                        <section className="rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                          <Field label="Observacion del item">
                            {readOnly
                              ? <ReadOnlyValue value={item.notes} placeholder="Sin observacion registrada" />
                              : <textarea rows="4" value={item.notes || ""} onChange={(event) => updateItemNotes(assetId, event.target.value)} className={TEXTAREA_CLASS_NAME} placeholder="Accesorios, condiciones particulares o acuerdos asociados al activo" />
                            }
                          </Field>
                        </section>

                        {!readOnly ? (
                          <section className="relative z-10 mb-16 rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                            <div className="grid gap-3">
                              <Field label="Agregar checklist">
                                <ChecklistTemplatePicker
                                  assetId={assetId}
                                  availableTemplates={availableTemplates}
                                  selectedTemplateId={selectedTemplateByAsset[assetId] || ""}
                                  onChange={(value) => setSelectedTemplateByAsset((current) => ({ ...current, [assetId]: value }))}
                                />
                              </Field>
                              <div className="flex justify-start xl:justify-end">
                                <Button variant="secondary" onClick={() => addChecklistToAsset(assetId)} disabled={!availableTemplates.length || !selectedTemplateByAsset[assetId]}>
                                  <Icon name="plus" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  Agregar checklist
                                </Button>
                              </div>
                            </div>
                          </section>
                        ) : null}
                      </div>

                      {item.checklists.length ? (
                        <div className="grid gap-4">
                          {item.checklists.map((checklist) => {
                            const checklistKey = `${assetId}-${checklist.templateId}`;
                            const isChecklistCollapsed = Boolean(collapsedChecklists[checklistKey]);

                            return (
                              <section key={checklistKey} className="rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Checklist aplicado</p>
                                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{checklist.templateName}</p>
                                    {checklist.templateDescription ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{checklist.templateDescription}</p> : null}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3">
                                    {!readOnly ? (
                                      <Button size="sm" variant="secondary" onClick={() => requestRemoveChecklistFromAsset(assetId, checklist.templateId)}>
                                        <Icon name="xmark" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                        Quitar
                                      </Button>
                                    ) : null}
                                    <CollapseToggleButton
                                      isCollapsed={isChecklistCollapsed}
                                      onClick={() => toggleChecklist(assetId, checklist.templateId)}
                                      collapsedLabel={`Expandir ${checklist.templateName || "checklist"}`}
                                      expandedLabel={`Contraer ${checklist.templateName || "checklist"}`}
                                    />
                                  </div>
                                </div>

                                <div
                                  className={`grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-out ${isChecklistCollapsed ? "overflow-hidden" : "overflow-visible"}`}
                                  style={{
                                    gridTemplateRows: isChecklistCollapsed ? "0fr" : "1fr",
                                    opacity: isChecklistCollapsed ? 0 : 1,
                                    marginTop: isChecklistCollapsed ? 0 : 16,
                                  }}
                                >
                                  <div className="min-h-0">
                                    <div className={`grid gap-3 ${isChecklistCollapsed ? "pointer-events-none" : ""}`}>
                                      {checklist.answers.map((answer) => (
                                        <div key={answer.checklistItemId} className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4">
                                          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.9fr)] xl:items-start">
                                            <div className="min-w-0">
                                              <p className="text-sm font-semibold text-[var(--text-primary)]">{answer.name}</p>
                                              {answer.description ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{answer.description}</p> : null}
                                            </div>
                                            <div className="min-w-0">
                                              <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Respuesta</p>
                                              {readOnly
                                                ? <ChecklistAnswerReadOnly answer={answer} />
                                                : <ChecklistAnswerField answer={answer} groupName={`asset-${assetId}-template-${checklist.templateId}-check-${answer.checklistItemId}`} onChange={(value) => updateChecklistAnswer(assetId, checklist.templateId, answer.checklistItemId, value)} />
                                              }
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </section>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
