import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CollapseToggleButton, FilterDropdown, Panel } from "../../components/ui/general";
import { ScrollToTopButton } from "../../components/ui/general/ScrollToTopButton";
import { Icon } from "../../components/ui/icon/Icon";
import ModalManager from "../../components/ui/modal";
import { Button } from "../../ui/Button";
import { useToast } from "../../ui";
import { searchItopAssets } from "../../services/itop-service";
import { cloneTemplate } from "../handover/handover-editor-shared";

import {
  cancelLabRecord,
  createLabRecord,
  fetchLabDocumentBlob,
  fetchLabEvidenceBlob,
  finalizeLabClosure,
  generateLabDocument,
  getLabBootstrap,
  getLabRecord,
  rollbackLabPhase,
  updateLabRecord,
  uploadLabEvidences,
} from "../../services/lab-service";
import {
  LAB_EXIT_FINAL_STATE_OPTIONS,
  LAB_OBSOLETE_EXIT_STATES,
  LAB_REASON_OPTIONS,
  createEmptyLabForm,
  createFormFromDetail,
} from "./lab-module-config";
import { openLabQrModal } from "./LabSignatureQrModal";

const INPUT_CLASS = "h-[50px] w-full rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none";
const TEXTAREA_CLASS = "w-full rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none";
const SECTION_PANEL_CLASS = "rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-subtle)]";

const CLOSED_STATUSES = [
  "Pendiente firma administrador",
  "Pendiente registro iTop",
  "Cerrada a stock",
  "Cerrada por obsolescencia",
  "Anulada",
];

function renderReasonDropdownSelection({ label, selectedOptions }) {
  const selected = selectedOptions[0] || null;
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {label}
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-[var(--text-primary)]">
          {selected?.label || "Selecciona un motivo"}
        </span>
      </span>
    </span>
  );
}

function getReasonDropdownOptionClassName(_, isActive) {
  return isActive
    ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
    : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]";
}

function Field({ label, children, helper }) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </label>
      {children}
      {helper && <p className="text-xs text-[var(--text-muted)]">{helper}</p>}
    </div>
  );
}

function SectionPanel({ title, eyebrow, children, accent }) {
  const borderClass = accent === "exit"
    ? "border-l-4 border-l-[var(--success)]"
    : accent === "entry"
    ? "border-l-4 border-l-[var(--accent-strong)]"
    : accent === "processing"
    ? "border-l-4 border-l-[rgba(106,63,160,0.7)]"
    : accent === "itop"
    ? "border-l-4 border-l-[var(--warning)]"
    : "";
  return (
    <div className={`${SECTION_PANEL_CLASS} ${borderClass} p-5`}>
      {eyebrow && (
        <p className="mb-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
          {eyebrow}
        </p>
      )}
      {title && (
        <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      )}
      {children}
    </div>
  );
}

function PhasePanel({ eyebrow, title, accent, isCollapsed, onToggle, summary, children }) {
  const borderClass = accent === "exit"
    ? "border-l-4 border-l-[var(--success)]"
    : accent === "entry"
    ? "border-l-4 border-l-[var(--accent-strong)]"
    : accent === "processing"
    ? "border-l-4 border-l-[rgba(106,63,160,0.7)]"
    : "";
  return (
    <div className={`${SECTION_PANEL_CLASS} ${borderClass} overflow-hidden`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 hover:bg-[var(--bg-app)] transition-colors">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
        >
          {eyebrow && (
            <p className="mb-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              {eyebrow}
            </p>
          )}
          {title && (
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          )}
          {isCollapsed && summary && (
            <p className="mt-1 text-xs text-[var(--text-muted)] truncate">{summary}</p>
          )}
        </button>
        <CollapseToggleButton
          isCollapsed={isCollapsed}
          onClick={onToggle}
          collapsedLabel="Expandir"
          expandedLabel="Colapsar"
        />
      </div>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isCollapsed ? "overflow-hidden" : "overflow-visible"}`}
        style={{ gridTemplateRows: isCollapsed ? "0fr" : "1fr", opacity: isCollapsed ? 0 : 1 }}
      >
        <div className="min-h-0">
          <div className="px-5 pb-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBanner({ type = "info", children }) {
  const styles = {
    info:    "bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[rgba(81,152,194,0.25)]",
    warning: "bg-[rgba(224,181,107,0.12)] text-[rgba(166,107,18,0.95)] border-[rgba(224,181,107,0.35)]",
    success: "bg-[rgba(127,191,156,0.12)] text-[var(--success)] border-[rgba(127,191,156,0.3)]",
    danger:  "bg-[rgba(210,138,138,0.12)] text-[var(--danger)] border-[rgba(210,138,138,0.3)]",
  };
  return (
    <div className={`rounded-[12px] border px-4 py-3 text-sm ${styles[type] || styles.info}`}>
      {children}
    </div>
  );
}

function SignatureBadge({ status }) {
  if (!status) return null;
  const isSigned = ["signed", "published"].includes(status);
  const isPending = ["pending", "claimed"].includes(status);
  const isExpired = status === "expired";

  if (isSigned) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(127,191,156,0.15)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--success)]">
        <Icon name="check" size={10} />
        Firmada
      </span>
    );
  }
  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(224,181,107,0.15)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[rgba(166,107,18,0.95)]">
        <Icon name="clock" size={10} />
        Pendiente firma
      </span>
    );
  }
  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(210,138,138,0.12)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--danger)]">
        <Icon name="exclamationTriangle" size={10} />
        QR expirado
      </span>
    );
  }
  return null;
}

function UploadedEvidenceCard({ evidence, recordId, onView, onRemove, onChangeCaption, readOnly = false }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(true);

  useEffect(() => {
    if (!recordId) { setLoadingPreview(false); return; }
    let cancelled = false;
    fetchLabEvidenceBlob(recordId, evidence.storedName)
      .then(({ url }) => { if (!cancelled) setPreviewUrl(url); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingPreview(false); });
    return () => { cancelled = true; };
  }, [recordId, evidence.storedName]);

  const name = evidence.originalName || evidence.storedName || "imagen";
  return (
    <div className="relative grid gap-2 overflow-hidden rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] p-2 text-left">
      <button
        type="button"
        onClick={() => onView?.(evidence)}
        className="grid gap-2 text-left hover:opacity-80 transition-opacity"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[10px] bg-[var(--bg-panel)]">
          {loadingPreview ? (
            <div className="flex h-full items-center justify-center">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent-strong)] border-t-transparent" />
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Icon name="image" size={20} className="text-[var(--text-muted)]" />
            </div>
          )}
        </div>
      </button>
      <div className="grid gap-2 px-1">
        <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{name}</p>
        {readOnly ? (
          evidence.caption ? (
            <p className="line-clamp-3 text-[0.68rem] text-[var(--text-muted)]">{evidence.caption}</p>
          ) : (
            <p className="text-[0.68rem] italic text-[var(--text-muted)]">Sin glosa</p>
          )
        ) : (
          <textarea
            rows={4}
            value={evidence.caption || ""}
            onChange={(event) => onChangeCaption?.(evidence.storedName, event.target.value)}
            placeholder="Observacion (opcional)"
            className="w-full rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] resize-none"
          />
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(evidence.storedName)}
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(0,0,0,0.45)] text-white hover:bg-[rgba(0,0,0,0.7)] transition-colors"
          title="Eliminar imagen"
        >
          <Icon name="times" size={10} />
        </button>
      )}
    </div>
  );
}

const EvidenceUploader = forwardRef(function EvidenceUploader(
  { evidences = [], onView, recordId, onRemove, onChangeCaption, readOnly = false },
  ref
) {
  const fileInputRef = useRef(null);
  const [staged, setStaged] = useState([]);
  const stagedRef = useRef(staged);
  useEffect(() => { stagedRef.current = staged; }, [staged]);
  useEffect(() => () => { stagedRef.current.forEach((s) => URL.revokeObjectURL(s.previewUrl)); }, []);

  function handleFileChange(event) {
    const newFiles = Array.from(event.target.files || []);
    event.target.value = "";
    if (!newFiles.length) return;
    setStaged((prev) => [
      ...prev,
      ...newFiles.map((f) => ({ file: f, previewUrl: URL.createObjectURL(f), glosa: "" })),
    ]);
  }

  function removeStaged(i) {
    setStaged((prev) => {
      URL.revokeObjectURL(prev[i].previewUrl);
      return prev.filter((_, j) => j !== i);
    });
  }

  useImperativeHandle(ref, () => ({
    getFiles: () => stagedRef.current.map((s) => { s.file.caption = s.glosa; return s.file; }),
    clear: () => {
      setStaged((prev) => {
        prev.forEach((s) => URL.revokeObjectURL(s.previewUrl));
        return [];
      });
    },
  }));

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={readOnly}
        className="flex w-fit items-center gap-2 rounded-[12px] border border-dashed border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)] transition-colors"
      >
        <Icon name="plus" size={12} />
        Agregar imagen
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileChange}
      />

      {(staged.length > 0 || evidences.length > 0) && (
        <div className="grid grid-cols-3 gap-3">
          {staged.map((item, i) => (
            <div
              key={`stage-${i}`}
              className="grid gap-2 overflow-hidden rounded-[14px] border border-dashed border-[var(--accent-strong)] bg-[var(--accent-soft)] p-2"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[10px] bg-[var(--bg-panel)]">
                <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeStaged(i)}
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(0,0,0,0.45)] text-white hover:bg-[rgba(0,0,0,0.7)] transition-colors"
                >
                  <Icon name="times" size={10} />
                </button>
              </div>
              <p className="truncate px-1 text-[0.7rem] font-semibold text-[var(--accent-strong)]">{item.file.name}</p>
              <textarea
                rows={4}
                value={item.glosa}
                onChange={(e) => setStaged((prev) => prev.map((s, j) => j === i ? { ...s, glosa: e.target.value } : s))}
                placeholder="Observacion (opcional)"
                className="w-full rounded-[8px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] resize-none"
              />
            </div>
          ))}
          {evidences.map((ev) => (
            <UploadedEvidenceCard
              key={ev.storedName}
              evidence={ev}
              recordId={recordId}
              onView={onView}
              onRemove={!readOnly && onRemove ? (name) => onRemove(name) : undefined}
              onChangeCaption={onChangeCaption}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
});

function AssetResultCard({ asset, onSelect }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
          {asset.code} / {asset.name}
        </p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {[asset.className, asset.serial].filter(Boolean).join(" / ")}
        </p>
        {asset.status || asset.assignedUser ? (
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {[asset.status, asset.assignedUser].filter(Boolean).join(" / ")}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => onSelect(asset)}>
          Seleccionar
        </Button>
      </div>
    </div>
  );
}

function ChecklistTemplatePicker({ templates, selectedTemplateId, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = templates.find((t) => String(t.id) === String(selectedTemplateId || ""));

  if (!templates.length) {
    return (
      <div className="rounded-[16px] border border-dashed border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-secondary)]">
        No hay plantillas de laboratorio disponibles.
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-left transition hover:border-[var(--border-strong)]"
      >
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Seleccionar plantilla</p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{selected?.name || "Selecciona una plantilla de laboratorio"}</p>
          <p className="mt-1 line-clamp-1 text-sm text-[var(--text-secondary)]">{selected?.description || "Elige un checklist disponible."}</p>
        </div>
        <Icon name={isOpen ? "chevronUp" : "chevronDown"} size={14} className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-[min(320px,calc(100vh-12rem))] overflow-y-auto rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-soft)]">
          <div className="grid gap-2">
            {templates.map((t) => {
              const isSelected = String(t.id) === String(selectedTemplateId || "");
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { onChange(String(t.id)); setIsOpen(false); }}
                  className={`rounded-[14px] border px-4 py-3 text-left transition ${isSelected ? "border-[rgba(81,152,194,0.26)] bg-[var(--accent-soft)]" : "border-transparent bg-[var(--bg-app)] hover:border-[var(--border-color)]"}`}
                >
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{t.name}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{t.description || "Sin descripcion adicional."}</p>
                  <p className="mt-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t.checks?.length || 0} checks</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistAnswerField({ answer, onChange, groupName }) {
  if (answer.type === "Input text") {
    return <input type="text" value={answer.value || ""} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} placeholder="Completar campo" />;
  }
  if (answer.type === "Text area") {
    return <textarea rows={3} value={answer.value || ""} onChange={(e) => onChange(e.target.value)} className={TEXTAREA_CLASS} placeholder="Completar detalle" />;
  }
  if (answer.type === "Check") {
    return (
      <label className="inline-flex items-center gap-3 rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)]">
        <input type="checkbox" checked={Boolean(answer.value)} onChange={(e) => onChange(e.target.checked)} />
        <span>Validado</span>
      </label>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      {[answer.optionA, answer.optionB].filter(Boolean).map((opt) => (
        <label key={opt} className="inline-flex items-center gap-3 rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)]">
          <input type="radio" name={groupName} checked={answer.value === opt} onChange={() => onChange(opt)} />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

function DocumentPreviewModal({ recordId, document, onClose }) {
  const [blobUrl, setBlobUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { url, filename: fn } = await fetchLabDocumentBlob(recordId, document.storedName);
        if (!cancelled) {
          setBlobUrl(url);
          setFilename(fn);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "No fue posible cargar el documento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [recordId, document]);

  return (
    <div className="grid gap-4">
      {loading && <div className="flex h-40 items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent-strong)] border-t-transparent" /></div>}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {blobUrl && (
        <iframe
          src={blobUrl}
          title={filename}
          className="h-[500px] w-full rounded-[12px] border border-[var(--border-color)]"
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

export function LabDocumentPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { add: showToast } = useToast();

  const isNew = slug === "new";

  const entryUploaderRef = useRef(null);
  const processingUploaderRef = useRef(null);
  const exitUploaderRef = useRef(null);

  const [bootstrap, setBootstrap] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(() => createEmptyLabForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [finalizingItop, setFinalizingItop] = useState(false);
  const [generatingEntry, setGeneratingEntry] = useState(false);
  const [generatingProcessing, setGeneratingProcessing] = useState(false);
  const [generatingExit, setGeneratingExit] = useState(false);
  const [error, setError] = useState("");

  const [selectedChecklistTemplateId, setSelectedChecklistTemplateId] = useState("");
  const [collapsedPhases, setCollapsedPhases] = useState({ entry: false, processing: true, exit: true });

  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetResults, setAssetResults] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);

  const refreshDetail = async () => {
    if (isNew) return;
    try {
      const updated = await getLabRecord(slug);
      const updatedItem = updated?.item || null;
      if (updatedItem) {
        setDetail(updatedItem);
        setForm(createFormFromDetail(updatedItem));
      }
    } catch {
      // silent refresh
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [boot, rec] = await Promise.all([
          getLabBootstrap(),
          isNew ? Promise.resolve(null) : getLabRecord(slug).then((r) => r?.item || null),
        ]);
        if (!cancelled) {
          setBootstrap(boot);
          if (rec) {
            setDetail(rec);
            setForm(createFormFromDetail(rec));
            setCollapsedPhases({
              entry: false,
              processing: !(rec.processingDate || rec.processingChecklists?.length),
              exit: !rec.exitDate,
            });
          } else {
            setForm(createEmptyLabForm(boot));
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "No fue posible cargar el acta.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [slug, isNew]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildSavePayload() {
    return {
      reason: form.reason,
      requestedActions: form.requestedActions,
      asset: form.asset,
      requesterAdmin: form.requesterAdmin,
      entryDate: form.entryDate,
      entryObservations: form.entryObservations,
      entryConditionNotes: form.entryConditionNotes,
      entryReceivedNotes: form.entryReceivedNotes,
      processingDate: form.processingDate,
      processingObservations: form.processingObservations,
      processingChecklists: form.processingChecklists,
      exitDate: form.exitDate,
      exitObservations: form.exitObservations,
      workPerformed: form.workPerformed,
      exitFinalState: form.exitFinalState,
      obsoleteNotes: form.obsoleteNotes,
      normalizationActCode: form.normalizationActCode,
      entryEvidences: form.entryEvidences,
      processingEvidences: form.processingEvidences,
      exitEvidences: form.exitEvidences,
    };
  }

  const minCharsAssets = bootstrap?.searchHints?.minCharsAssets || 2;
  const checklistTemplates = bootstrap?.checklistTemplates || [];

  function addChecklist() {
    if (!selectedChecklistTemplateId) return;
    const template = checklistTemplates.find((t) => String(t.id) === selectedChecklistTemplateId);
    if (!template) return;
    if (form.processingChecklists.some((cl) => String(cl.templateId) === selectedChecklistTemplateId)) {
      showToast({ title: "Este checklist ya fue agregado.", tone: "danger" });
      return;
    }
    const cloned = cloneTemplate(template);
    setField("processingChecklists", [...form.processingChecklists, cloned]);
    setSelectedChecklistTemplateId("");
    saveChecklistsToBackend([...form.processingChecklists, cloned]);
  }

  async function removeChecklist(templateId) {
    const confirmed = await ModalManager.confirm({
      title: "Quitar checklist",
      message: "Se eliminará el checklist de esta fase.",
      buttons: { cancel: "Cancelar", confirm: "Quitar" },
    });
    if (!confirmed) return;
    const updated = form.processingChecklists.filter((cl) => String(cl.templateId) !== String(templateId));
    setField("processingChecklists", updated);
    saveChecklistsToBackend(updated);
  }

  function updateChecklistAnswer(templateId, checklistItemId, value) {
    const updated = form.processingChecklists.map((cl) => {
      if (String(cl.templateId) !== String(templateId)) return cl;
      return {
        ...cl,
        answers: cl.answers.map((a) =>
          String(a.checklistItemId) === String(checklistItemId) ? { ...a, value } : a
        ),
      };
    });
    setField("processingChecklists", updated);
    saveChecklistsToBackend(updated);
  }

  async function saveChecklistsToBackend(checklists) {
    if (isNew) return;
    try {
      await updateLabRecord(slug, { processingChecklists: checklists });
    } catch {
      // silent
    }
  }

  async function requestRemoveEvidence(fieldKey, evidenceName) {
    const confirmed = await ModalManager.confirm({
      title: "Quitar adjunto",
      message: "La imagen se quitará del acta cuando guardes los cambios.",
      buttons: { cancel: "Cancelar", confirm: "Quitar" },
    });
    if (!confirmed) return;
    setField(fieldKey, form[fieldKey].filter((item) => item.storedName !== evidenceName));
  }

  function updateEvidenceCaption(fieldKey, evidenceName, caption) {
    setForm((prev) => ({
      ...prev,
      [fieldKey]: prev[fieldKey].map((item) => (
        item.storedName === evidenceName ? { ...item, caption } : item
      )),
    }));
  }

  useEffect(() => {
    const query = assetSearchQuery.trim();
    if (query.length < minCharsAssets) {
      setAssetResults([]);
      setAssetLoading(false);
      return undefined;
    }
    let cancelled = false;
    const run = async () => {
      setAssetLoading(true);
      try {
        const items = await searchItopAssets({ query });
        if (!cancelled) setAssetResults(items);
      } catch {
        if (!cancelled) setAssetResults([]);
      } finally {
        if (!cancelled) setAssetLoading(false);
      }
    };
    const timer = window.setTimeout(run, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [assetSearchQuery, minCharsAssets]);

  async function handleSave({ silent = false } = {}) {
    if (!form.asset) {
      showToast({ title: "Debes seleccionar un activo antes de guardar.", tone: "danger" });
      return null;
    }
    if (!form.entryDate) {
      showToast({ title: "Debes indicar la fecha de ingreso.", tone: "danger" });
      return null;
    }
    if (!form.requestedActions?.length) {
      showToast({ title: "Debes seleccionar al menos una accion solicitada.", tone: "danger" });
      return null;
    }
    setSaving(true);
    try {
      let savedId;
      const savePayload = buildSavePayload();
      if (isNew) {
        const result = await createLabRecord(savePayload);
        savedId = result?.item?.id;
        if (!savedId) throw new Error("No fue posible crear el acta.");
      } else {
        savedId = Number(slug);
        await updateLabRecord(slug, savePayload);
      }

      const uploaderPhases = [
        { phase: "entrada",       uploaderRef: entryUploaderRef },
        { phase: "procesamiento", uploaderRef: processingUploaderRef },
        { phase: "salida",        uploaderRef: exitUploaderRef },
      ];
      for (const { phase, uploaderRef } of uploaderPhases) {
        const files = uploaderRef.current?.getFiles() || [];
        if (!files.length) continue;
        try {
          await uploadLabEvidences(savedId, phase, files);
          uploaderRef.current?.clear();
        } catch {
          showToast({ title: `No fue posible subir las imagenes de ${phase}.`, tone: "danger" });
        }
      }

      const updated = await getLabRecord(String(savedId));
      const updatedItem = updated?.item || null;
      if (isNew) {
        if (!silent) showToast({ title: "Acta creada correctamente.", tone: "success" });
        navigate(`/lab/${savedId}`, { replace: true });
      } else {
        if (updatedItem) {
          setDetail(updatedItem);
          setForm(createFormFromDetail(updatedItem));
        }
        if (!silent) showToast({ title: "Acta guardada correctamente.", tone: "success" });
      }
      return { savedId, item: updatedItem };
    } catch (err) {
      showToast({ title: err.message || "No fue posible guardar el acta.", tone: "danger" });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelRecord() {
    const confirmed = await ModalManager.confirm({
      title: "Anular acta",
      message: `¿Confirmas la anulación del acta ${detail?.code}?`,
      content: "Esta acción es irreversible. El acta quedará marcada como Anulada y no podrá continuar el flujo de laboratorio.",
      buttons: { cancel: "Mantener", confirm: "Anular acta" },
    });
    if (!confirmed) return;
    setCancelling(true);
    try {
      await cancelLabRecord(Number(slug));
      showToast({ title: "Acta anulada correctamente.", tone: "success" });
      navigate("/lab");
    } catch (err) {
      showToast({ title: err.message || "No fue posible anular el acta.", tone: "danger" });
    } finally {
      setCancelling(false);
    }
  }

  async function handleFinalizeItop() {
    const confirmed = await ModalManager.confirm({
      title: "Registrar en iTop",
      message: `¿Registrar el acta ${detail?.code} en iTop?`,
      content: "Se creará un ticket UserRequest en iTop con todos los PDFs adjuntos y el activo vinculado. El acta pasará a estado cerrado.",
      buttons: { cancel: "Cancelar", confirm: "Registrar en iTop" },
    });
    if (!confirmed) return;
    setFinalizingItop(true);
    try {
      const result = await finalizeLabClosure(Number(slug));
      if (result) {
        setDetail(result);
        setForm(createFormFromDetail(result));
      }
      showToast({ title: "Acta registrada en iTop correctamente.", tone: "success" });
    } catch (err) {
      showToast({ title: err.message || "No fue posible registrar el acta en iTop.", tone: "danger" });
    } finally {
      setFinalizingItop(false);
    }
  }

  async function handleRollbackPhase(phase) {
    const phaseLabel = { entry: "entrada", processing: "procesamiento", exit: "salida" }[phase] || phase;
    const downstream = { entry: "procesamiento y salida", processing: "salida", exit: "" }[phase] || "";
    const confirmed = await ModalManager.confirm({
      title: `Revertir fase de ${phaseLabel}`,
      message: `Se eliminará el acta de ${phaseLabel} y todos sus datos.`,
      content: downstream
        ? `Advertencia: también se perderán todos los datos de la fase de ${downstream}. Esta accion no se puede deshacer.`
        : "Esta accion no se puede deshacer.",
      buttons: { cancel: "Cancelar", confirm: `Revertir ${phaseLabel}` },
    });
    if (!confirmed) return;
    try {
      const result = await rollbackLabPhase(Number(slug), phase);
      if (result) {
        setDetail(result);
        setForm(createFormFromDetail(result));
        setCollapsedPhases({ entry: false, processing: true, exit: true });
      }
      showToast({ title: `Fase de ${phaseLabel} revertida. Puedes editar y regenerar el acta.`, tone: "success" });
    } catch (err) {
      showToast({ title: err.message || `No fue posible revertir la fase de ${phaseLabel}.`, tone: "danger" });
    }
  }

  function handleOpenQr({ phase, workflowKind, isAdmin }) {
    openLabQrModal({
      recordId: Number(slug),
      code: detail?.code || slug,
      assetAssignedUser: detail?.assetAssignedUser || "",
      currentStatus: detail?.statusCode || "",
      phase,
      workflowKind,
      isAdmin,
      add: showToast,
      onDone: refreshDetail,
    });
  }

  async function handlePhaseToggle(phase) {
    const isExpanding = collapsedPhases[phase];
    if (isExpanding) {
      if (phase === "processing" && !form.entryGeneratedDocument) {
        showToast({ title: "Genera primero el acta de entrada para habilitar el procesamiento.", tone: "danger" });
        return;
      }
      if (phase === "exit" && !form.processingGeneratedDocument) {
        showToast({ title: "Genera primero el acta de procesamiento para habilitar la fase de salida.", tone: "danger" });
        return;
      }
    }
    setCollapsedPhases((prev) => ({ ...prev, [phase]: !prev[phase] }));
  }

  async function handleGenerateDocument(phase, setGenerating, { alreadyHasDoc = false } = {}) {
    const phaseLabel = { entrada: "entrada", procesamiento: "procesamiento", salida: "salida" }[phase] || phase;
    if (alreadyHasDoc) {
      const confirmed = await ModalManager.confirm({
        title: `Regenerar acta de ${phaseLabel}`,
        message: `Se sobreescribirá el acta de ${phaseLabel} existente.`,
        content: "El PDF anterior quedará reemplazado por uno nuevo con los datos actuales.",
        buttons: { cancel: "Cancelar", confirm: "Regenerar" },
      });
      if (!confirmed) return;
    } else {
      const confirmed = await ModalManager.confirm({
        title: `Confirmar fase de ${phaseLabel}`,
        message: `Se generará el acta PDF de ${phaseLabel} con los datos actuales.`,
        content: "Una vez generado el acta, los datos de esta fase quedarán bloqueados. Para modificarlos deberás revertir la fase.",
        buttons: { cancel: "Cancelar", confirm: `Generar acta de ${phaseLabel}` },
      });
      if (!confirmed) return;
    }
    setGenerating(true);
    try {
      const saveResult = await handleSave({ silent: true });
      const targetId = saveResult?.savedId || (!isNew ? Number(slug) : null);
      if (!targetId) return;
      const result = await generateLabDocument(targetId, phase);
      if (result?.record) {
        setDetail(result.record);
        setForm(createFormFromDetail(result.record));
        showToast({ title: `Acta de ${phaseLabel} generada correctamente.`, tone: "success" });
        if (isNew) navigate(`/lab/${targetId}`, { replace: true });
      }
    } catch (err) {
      showToast({ title: err.message || `No fue posible generar el documento de ${phaseLabel}.`, tone: "danger" });
    } finally {
      setGenerating(false);
    }
  }

  function handleViewDocument(document) {
    const modalId = ModalManager.custom({
      title: `Acta de ${document.phaseLabel || document.kind} — ${detail?.code || ""}`,
      size: "pdfViewer",
      showFooter: false,
      content: (
        <DocumentPreviewModal
          recordId={Number(slug)}
          document={document}
          onClose={() => ModalManager.close(modalId)}
        />
      ),
    });
  }

  async function handleViewEvidence(evidence) {
    try {
      const { url } = await fetchLabEvidenceBlob(Number(slug), evidence.storedName);
      const name = evidence.originalName || evidence.storedName;
      const ext = name.split(".").pop()?.toLowerCase();
      const isImage = ["jpg", "jpeg", "png"].includes(ext);
      const isPdf = ext === "pdf";
      const modalId = ModalManager.custom({
        title: name,
        size: "large",
        showFooter: false,
        content: (
          <div className="grid gap-4">
            {isImage ? (
              <img src={url} alt={name} className="w-full rounded-[12px] object-contain max-h-[500px]" />
            ) : isPdf ? (
              <iframe src={url} title={name} className="h-[500px] w-full rounded-[12px] border border-[var(--border-color)]" />
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">Vista previa no disponible para este tipo de archivo.</p>
            )}
            <div className="flex justify-between gap-3">
              <Button variant="secondary" onClick={() => ModalManager.close(modalId)}>Cerrar</Button>
              <a href={url} download={name}>
                <Button variant="primary">
                  <Icon name="download" size={14} className="mr-1.5" />
                  Descargar
                </Button>
              </a>
            </div>
          </div>
        ),
      });
    } catch (err) {
      showToast({ title: err.message || "No fue posible cargar la evidencia.", tone: "danger" });
    }
  }

  const hasEntryDoc = Boolean(form.entryGeneratedDocument);
  const hasProcessingDoc = Boolean(form.processingGeneratedDocument);
  const hasExitDoc = Boolean(form.exitGeneratedDocument);
  const isProcessingPhaseEnabled = hasEntryDoc;
  const isExitPhaseEnabled = hasProcessingDoc;

  const adminSignatureStatus = detail?.signatureStates?.adminApproval?.status || "";
  const isObsoleteExit = LAB_OBSOLETE_EXIT_STATES.has(form.exitFinalState);

  const statusCode = detail?.statusCode || "";
  const isGlobalReadOnly = Boolean(detail && CLOSED_STATUSES.includes(detail.status));
  const entryLocked = hasEntryDoc;
  const processingLocked = hasProcessingDoc;
  const exitLocked = hasExitDoc;

  const isReadOnly = isGlobalReadOnly;
  const isCancellable = !isNew && detail && !["Anulada", "Cerrada a stock", "Cerrada por obsolescencia"].includes(detail.status);
  const isPendingItop = statusCode === "pending_itop_sync";
  const isCompleted = ["completed_return_to_stock", "completed_obsolete"].includes(statusCode);
  const itopTicket = form.itopTicket || detail?.itopTicket || null;
  const canOpenQr = detail?.canOpenQr !== false;
  const adminOptions = bootstrap?.adminOptions || [];

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-strong)] border-t-transparent" />
      </div>
    );
  }

  if (error && !isNew) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <p className="text-sm text-[var(--danger)]">{error}</p>
        <Button variant="secondary" onClick={() => navigate("/lab")}>Volver al listado</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 pb-12">
      {/* Header */}
      <Panel className="overflow-hidden">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="grid gap-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Workspace</p>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                  {isNew ? "Nueva acta de laboratorio" : isGlobalReadOnly ? "Detalle de acta de laboratorio" : "Edicion de acta de laboratorio"}
                </h1>
                {!isNew && detail?.code ? (
                  <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                    Folio {detail.code}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                Trabaja el documento en una pagina completa para tener mejor separacion visual entre datos del acta, activo analizado y fases de laboratorio.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <Button variant="secondary" onClick={() => navigate("/lab")}>
              <Icon name="arrowLeft" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Volver al listado
            </Button>
            {isCancellable && (
              <Button
                variant="secondary"
                onClick={handleCancelRecord}
                disabled={cancelling}
                className="border-[rgba(210,138,138,0.4)] text-[var(--danger)] hover:bg-[rgba(210,138,138,0.08)]"
              >
                <Icon name="ban" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {cancelling ? "Anulando..." : "Anular acta"}
              </Button>
            )}
            {!isGlobalReadOnly ? (
              <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
                <Icon name="save" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {saving ? "Guardando..." : "Guardar acta"}
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      {isGlobalReadOnly && !isPendingItop && !isCompleted && (
        <MessageBanner type="info">
          Esta acta está en estado <strong>{detail?.status}</strong>. Los datos no pueden ser editados.
        </MessageBanner>
      )}

      {/* Panel de registro iTop — solo cuando pendiente_itop_sync */}
      {isPendingItop && (
        <SectionPanel eyebrow="Siguiente paso" title="Registrar acta en iTop" accent="itop">
          <div className="grid gap-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Todas las fases están firmadas. El siguiente paso es registrar esta acta en iTop como UserRequest, adjuntando los PDFs generados y vinculando el activo.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                onClick={handleFinalizeItop}
                disabled={finalizingItop}
              >
                {finalizingItop ? (
                  <>
                    <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Registrando en iTop...
                  </>
                ) : (
                  <>
                    <Icon name="arrowRight" size={14} className="mr-1.5" />
                    Registrar en iTop
                  </>
                )}
              </Button>
              <p className="text-xs text-[var(--text-muted)]">
                Se creará un ticket UserRequest con los documentos de las 3 fases adjuntos.
              </p>
            </div>
          </div>
        </SectionPanel>
      )}

      {/* Info ticket iTop — solo cuando cerrado */}
      {isCompleted && itopTicket && (
        <SectionPanel eyebrow="Registro iTop" title="Ticket generado en iTop">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">ID Ticket</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">#{itopTicket.id || "—"}</p>
            </div>
            <div className="rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Clase iTop</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{itopTicket.className || "UserRequest"}</p>
            </div>
            <div className="rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Sincronizado</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{itopTicket.syncedAt ? new Date(itopTicket.syncedAt).toLocaleString("es-CL") : "—"}</p>
            </div>
          </div>
          {itopTicket.attachments?.length > 0 && (
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              {itopTicket.attachments.length} archivo(s) adjunto(s) al ticket.
            </p>
          )}
        </SectionPanel>
      )}

      {/* Datos generales */}
      <SectionPanel eyebrow="Datos generales" title="Activo y motivo">
        <div className="grid gap-5 md:grid-cols-2 md:items-start">
          <Field label="Activo de la CMDB" helper="Busca el equipo en iTop. Cada acta de laboratorio corresponde a un unico activo.">
            {form.asset ? (
              <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {form.asset.code} / {form.asset.name}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {[form.asset.className, form.asset.serial].filter(Boolean).join(" / ")}
                  </p>
                  {(form.asset.status || form.asset.assignedUser) ? (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {[form.asset.status, form.asset.assignedUser].filter(Boolean).join(" / ")}
                    </p>
                  ) : null}
                  {!isGlobalReadOnly && !entryLocked && (
                    <button
                      type="button"
                      onClick={() => { setField("asset", null); setAssetSearchQuery(""); setAssetResults([]); }}
                      className="mt-2 text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                    >
                      Cambiar activo
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative z-10">
                <input
                  type="search"
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                  disabled={isGlobalReadOnly || entryLocked}
                  placeholder={`Codigo, nombre o serie (${minCharsAssets}+ caracteres)`}
                  className={INPUT_CLASS}
                />
                {assetSearchQuery.trim().length > 0 && assetSearchQuery.trim().length < minCharsAssets ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)]">
                    <MessageBanner>Ingresa al menos {minCharsAssets} caracteres para buscar activos en CMDB.</MessageBanner>
                  </div>
                ) : assetResults.length > 0 ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] max-h-[min(320px,calc(100vh-12rem))] overflow-y-auto rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-soft)]">
                    <div className="grid gap-3">
                      {assetResults.map((asset) => (
                        <AssetResultCard
                          key={asset.id}
                          asset={asset}
                          onSelect={(a) => { setField("asset", { ...a, id: String(a.id ?? "") }); setAssetSearchQuery(""); setAssetResults([]); }}
                        />
                      ))}
                    </div>
                  </div>
                ) : assetLoading ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)]">
                    <MessageBanner>Buscando activos en CMDB...</MessageBanner>
                  </div>
                ) : null}
              </div>
            )}
          </Field>

          <div className="grid gap-5">
            <Field label="Especialista responsable">
              <div className={`${INPUT_CLASS} flex items-center`}>
                <span className="truncate text-sm font-semibold">
                  {detail?.ownerName || bootstrap?.currentUser?.name || "—"}
                </span>
              </div>
            </Field>

            <Field label="Motivo de ingreso a laboratorio">
              <FilterDropdown
                label="Motivo de ingreso"
                selectedValues={form.reason ? [form.reason] : []}
                options={LAB_REASON_OPTIONS}
                selectionMode="single"
                onToggleOption={(value) => setField("reason", value)}
                onClear={() => setField("reason", "maintenance")}
                disabled={isGlobalReadOnly || entryLocked}
                title="Seleccionar motivo de ingreso"
                description="Selecciona el motivo por el cual el activo ingresa al laboratorio."
                triggerClassName="py-3"
                buttonHeightClassName="min-h-[66px]"
                menuOffsetClassName="top-[calc(100%+0.55rem)]"
                menuClassName="rounded-[18px]"
                renderSelection={renderReasonDropdownSelection}
                renderOptionLeading={() => (
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
                )}
                renderOptionDescription={(option) => option.label}
                getOptionClassName={getReasonDropdownOptionClassName}
              />
            </Field>

            <Field label="Acciones solicitadas" helper="Estas son las acciones que el agente deberá ejecutar durante la fase técnica.">
              <FilterDropdown
                label="Acciones solicitadas"
                selectedValues={form.requestedActions || []}
                options={LAB_REASON_OPTIONS}
                selectionMode="multiple"
                onToggleOption={(value) => {
                  const exists = (form.requestedActions || []).includes(value);
                  setField(
                    "requestedActions",
                    exists
                      ? form.requestedActions.filter((item) => item !== value)
                      : [...(form.requestedActions || []), value]
                  );
                }}
                onClear={() => setField("requestedActions", form.reason ? [form.reason] : [])}
                disabled={isGlobalReadOnly || entryLocked}
                title="Seleccionar acciones"
                description="Selecciona una o más acciones asociadas al ingreso de este equipo."
                triggerClassName="py-3"
                buttonHeightClassName="min-h-[66px]"
                menuOffsetClassName="top-[calc(100%+0.55rem)]"
                menuClassName="rounded-[18px]"
                renderSelection={renderReasonDropdownSelection}
                renderOptionLeading={() => (
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
                )}
                renderOptionDescription={(option) => option.label}
                getOptionClassName={getReasonDropdownOptionClassName}
              />
            </Field>
          </div>
        </div>
      </SectionPanel>

      {/* FASE DE ENTRADA */}
      <PhasePanel
        eyebrow="Fase 1"
        title="Acta de entrada"
        accent="entry"
        isCollapsed={collapsedPhases.entry}
        onToggle={() => handlePhaseToggle("entry")}
        summary={form.entryDate || "Sin fecha"}
      >
        <div className="grid gap-5">
          {hasEntryDoc && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <MessageBanner type="success">
                Acta de entrada generada.{" "}
                <button type="button" className="font-semibold underline" onClick={() => handleViewDocument(form.entryGeneratedDocument)}>
                  Ver acta de entrada
                </button>
                {entryLocked && !isGlobalReadOnly && (
                  <span className="ml-2 text-xs text-[var(--text-muted)]">— fase bloqueada.</span>
                )}
              </MessageBanner>
              {!isGlobalReadOnly && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleRollbackPhase("entry")}
                  className="border-[rgba(210,138,138,0.4)] text-[var(--danger)] hover:bg-[rgba(210,138,138,0.08)]"
                >
                  <Icon name="undo" size={12} className="mr-1" />
                  Revertir entrada
                </Button>
              )}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Fecha de ingreso a laboratorio">
              <input
                type="date"
                value={form.entryDate}
                onChange={(e) => setField("entryDate", e.target.value)}
                disabled={isGlobalReadOnly || entryLocked}
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          <Field label="Analisis previo / Observaciones de ingreso" helper="Describe el estado visible del equipo, accesorios presentes y diagnostico inicial.">
            <textarea
              rows={4}
              value={form.entryObservations}
              onChange={(e) => setField("entryObservations", e.target.value)}
              disabled={isGlobalReadOnly || entryLocked}
              placeholder="Estado del equipo al ingreso, accesorios, diagnostico preliminar..."
              className={TEXTAREA_CLASS}
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Estado base / problemas fisicos" helper="Detalla golpes, faltantes, carcasa, pantalla, teclado u otras condiciones visibles.">
              <textarea
                rows={4}
                value={form.entryConditionNotes}
                onChange={(e) => setField("entryConditionNotes", e.target.value)}
                disabled={isGlobalReadOnly || entryLocked}
                placeholder="Condicion física del equipo, daños visibles, accesorios faltantes..."
                className={TEXTAREA_CLASS}
              />
            </Field>

            <Field label="Notas recibidas con el equipo" helper="Registra glosas o indicaciones entregadas junto al activo.">
              <textarea
                rows={4}
                value={form.entryReceivedNotes}
                onChange={(e) => setField("entryReceivedNotes", e.target.value)}
                disabled={isGlobalReadOnly || entryLocked}
                placeholder="Comentarios del usuario, contexto de la falla, ticket previo, observaciones..."
                className={TEXTAREA_CLASS}
              />
            </Field>
          </div>

          <Field label="Evidencias de entrada" helper="Imagenes del estado del equipo al ingresar (jpg, jpeg, png).">
            <EvidenceUploader
              ref={entryUploaderRef}
              evidences={form.entryEvidences}
              onView={handleViewEvidence}
              recordId={isNew ? null : Number(slug)}
              onRemove={(name) => requestRemoveEvidence("entryEvidences", name)}
              onChangeCaption={(name, caption) => updateEvidenceCaption("entryEvidences", name, caption)}
              readOnly={isGlobalReadOnly || entryLocked}
            />
          </Field>

          {!isGlobalReadOnly && !entryLocked && (
            <div className="flex flex-col items-end gap-1.5">
              <Button
                variant="primary"
                onClick={() => handleGenerateDocument("entrada", setGeneratingEntry, { alreadyHasDoc: hasEntryDoc })}
                disabled={generatingEntry || isNew || !form.entryDate}
              >
                {generatingEntry ? (
                  <>
                    <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generando...
                  </>
                ) : "Confirmar entrada y generar acta"}
              </Button>
              {isNew && <p className="text-xs text-[var(--text-muted)]">Guarda el acta primero para poder generar documentos.</p>}
              {!isNew && !form.entryDate && <p className="text-xs text-[var(--text-muted)]">Ingresa la fecha de ingreso para habilitar este boton.</p>}
            </div>
          )}
        </div>
      </PhasePanel>

      {/* FASE DE PROCESAMIENTO */}
      <PhasePanel
        eyebrow="Fase 2"
        title="Acta de procesamiento"
        accent="processing"
        isCollapsed={collapsedPhases.processing}
        onToggle={() => handlePhaseToggle("processing")}
        summary={`${form.processingChecklists.length} checklist(s)`}
      >
        {!isProcessingPhaseEnabled ? (
          <MessageBanner type="info">
            Genera el acta de entrada para habilitar la fase de procesamiento.
          </MessageBanner>
        ) : (
          <div className="grid gap-5">
            {hasProcessingDoc && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <MessageBanner type="success">
                  Acta de procesamiento generada.{" "}
                  <button type="button" className="font-semibold underline" onClick={() => handleViewDocument(form.processingGeneratedDocument)}>
                    Ver acta de procesamiento
                  </button>
                  {processingLocked && !isGlobalReadOnly && (
                    <span className="ml-2 text-xs text-[var(--text-muted)]">— fase bloqueada.</span>
                  )}
                </MessageBanner>
                {!isGlobalReadOnly && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRollbackPhase("processing")}
                    className="border-[rgba(210,138,138,0.4)] text-[var(--danger)] hover:bg-[rgba(210,138,138,0.08)]"
                  >
                    <Icon name="undo" size={12} className="mr-1" />
                    Revertir procesamiento
                  </Button>
                )}
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Fecha de procesamiento">
                <input
                  type="date"
                  value={form.processingDate}
                  onChange={(e) => setField("processingDate", e.target.value)}
                  disabled={isGlobalReadOnly || processingLocked}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>

            <Field label="Observaciones de procesamiento" helper="Describe el proceso realizado, condiciones del entorno y hallazgos intermedios.">
              <textarea
                rows={4}
                value={form.processingObservations}
                onChange={(e) => setField("processingObservations", e.target.value)}
                disabled={isGlobalReadOnly || processingLocked}
                placeholder="Descripcion del proceso, hallazgos intermedios, condiciones observadas..."
                className={TEXTAREA_CLASS}
              />
            </Field>

            {/* Checklists */}
            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Checklists de laboratorio
                </label>
              </div>

              {!isGlobalReadOnly && !processingLocked && (
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <ChecklistTemplatePicker
                      templates={checklistTemplates.filter((t) => !form.processingChecklists.some((cl) => String(cl.templateId) === String(t.id)))}
                      selectedTemplateId={selectedChecklistTemplateId}
                      onChange={setSelectedChecklistTemplateId}
                    />
                  </div>
                  <Button variant="secondary" onClick={addChecklist} disabled={!selectedChecklistTemplateId}>
                    <Icon name="plus" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Agregar
                  </Button>
                </div>
              )}

              {form.processingChecklists.length > 0 ? (
                <div className="grid gap-4">
                  {form.processingChecklists.map((checklist) => (
                    <div key={checklist.templateId} className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] overflow-hidden">
                      <div className="flex items-start justify-between gap-3 bg-[rgba(106,63,160,0.06)] px-5 py-4">
                        <div>
                          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Checklist</p>
                          <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">{checklist.templateName}</p>
                          {checklist.templateDescription ? (
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">{checklist.templateDescription}</p>
                          ) : null}
                        </div>
                        {!isGlobalReadOnly && !processingLocked && (
                          <button
                            type="button"
                            onClick={() => removeChecklist(checklist.templateId)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                            title="Eliminar checklist"
                          >
                            <Icon name="times" size={12} className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      <div className="grid gap-4 p-5">
                        {checklist.answers.map((answer) => (
                          <div key={answer.checklistItemId} className="grid gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[var(--text-primary)]">{answer.name}</p>
                              {answer.description ? <p className="text-xs text-[var(--text-muted)]">{answer.description}</p> : null}
                            </div>
                            {isGlobalReadOnly || processingLocked ? (
                              <div className="text-sm text-[var(--text-primary)]">
                                {answer.type === "Check" ? (answer.value ? "Si" : "No") : String(answer.value || "Sin respuesta")}
                              </div>
                            ) : (
                              <ChecklistAnswerField
                                answer={answer}
                                groupName={`cl-${checklist.templateId}-${answer.checklistItemId}`}
                                onChange={(value) => updateChecklistAnswer(checklist.templateId, answer.checklistItemId, value)}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No hay checklists agregados para esta fase.</p>
              )}
            </div>

            <Field label="Evidencias de procesamiento" helper="Imagenes del proceso realizado (jpg, jpeg, png).">
              <EvidenceUploader
                ref={processingUploaderRef}
                evidences={form.processingEvidences}
                onView={handleViewEvidence}
                recordId={isNew ? null : Number(slug)}
                onRemove={(name) => requestRemoveEvidence("processingEvidences", name)}
                onChangeCaption={(name, caption) => updateEvidenceCaption("processingEvidences", name, caption)}
                readOnly={isGlobalReadOnly || processingLocked}
              />
            </Field>

            {!isGlobalReadOnly && !processingLocked && (
              <div className="flex flex-col items-end gap-1.5">
                <Button
                  variant="primary"
                  onClick={() => handleGenerateDocument("procesamiento", setGeneratingProcessing, { alreadyHasDoc: hasProcessingDoc })}
                  disabled={generatingProcessing || !form.processingDate}
                >
                  {generatingProcessing ? (
                    <><span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Generando...</>
                  ) : "Confirmar procesamiento y generar acta"}
                </Button>
                {!form.processingDate && <p className="text-xs text-[var(--text-muted)]">Ingresa la fecha de procesamiento para habilitar este boton.</p>}
              </div>
            )}
          </div>
        )}
      </PhasePanel>

      {/* FASE DE SALIDA */}
      <PhasePanel
        eyebrow="Fase 3"
        title="Acta de salida"
        accent="exit"
        isCollapsed={collapsedPhases.exit}
        onToggle={() => handlePhaseToggle("exit")}
        summary={form.exitDate || "Sin fecha"}
      >
        {!isExitPhaseEnabled ? (
          <MessageBanner type="info">
            Genera el acta de procesamiento para habilitar la fase de salida.
          </MessageBanner>
        ) : (
          <div className="grid gap-5">
            {hasExitDoc && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <MessageBanner type="success">
                  Acta de salida generada.{" "}
                  <button type="button" className="font-semibold underline" onClick={() => handleViewDocument(form.exitGeneratedDocument)}>
                    Ver acta de salida
                  </button>
                  {exitLocked && !isGlobalReadOnly && (
                    <span className="ml-2 text-xs text-[var(--text-muted)]">— fase bloqueada.</span>
                  )}
                </MessageBanner>
                {!isGlobalReadOnly && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRollbackPhase("exit")}
                    className="border-[rgba(210,138,138,0.4)] text-[var(--danger)] hover:bg-[rgba(210,138,138,0.08)]"
                  >
                    <Icon name="undo" size={12} className="mr-1" />
                    Revertir salida
                  </Button>
                )}
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Fecha de salida de laboratorio">
                <input
                  type="date"
                  value={form.exitDate}
                  onChange={(e) => setField("exitDate", e.target.value)}
                  disabled={isGlobalReadOnly || exitLocked}
                  className={INPUT_CLASS}
                />
              </Field>

              <Field label="Estado final del activo" helper="Estado al que pasará el activo en iTop al cerrar el acta.">
                <select
                  value={form.exitFinalState}
                  onChange={(e) => setField("exitFinalState", e.target.value)}
                  disabled={isGlobalReadOnly || exitLocked}
                  className={`${INPUT_CLASS} cursor-pointer`}
                >
                  <option value="">Selecciona el estado final...</option>
                  {LAB_EXIT_FINAL_STATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Trabajo realizado" helper="Describe en detalle el trabajo efectuado durante la permanencia en laboratorio.">
              <textarea
                rows={4}
                value={form.workPerformed}
                onChange={(e) => setField("workPerformed", e.target.value)}
                disabled={isGlobalReadOnly || exitLocked}
                placeholder="Descripcion del trabajo realizado: componentes revisados, reemplazados, software instalado, configuraciones aplicadas..."
                className={TEXTAREA_CLASS}
              />
            </Field>

            <Field label="Observaciones de salida" helper="Estado final del equipo, resultado del trabajo y cualquier observacion relevante.">
              <textarea
                rows={3}
                value={form.exitObservations}
                onChange={(e) => setField("exitObservations", e.target.value)}
                disabled={isGlobalReadOnly || exitLocked}
                placeholder="Estado del equipo al egreso, resultado del proceso, condiciones adicionales..."
                className={TEXTAREA_CLASS}
              />
            </Field>

            <Field label="Evidencias de salida" helper="Imagenes del estado del equipo al egresar (jpg, jpeg, png).">
              <EvidenceUploader
                ref={exitUploaderRef}
                evidences={form.exitEvidences}
                onView={handleViewEvidence}
                recordId={isNew ? null : Number(slug)}
                onRemove={(name) => requestRemoveEvidence("exitEvidences", name)}
                onChangeCaption={(name, caption) => updateEvidenceCaption("exitEvidences", name, caption)}
                readOnly={isGlobalReadOnly || exitLocked}
              />
            </Field>

            {/* Admin approval — solo cuando estado obsolete/disposed */}
            {isObsoleteExit && (
              <div className="rounded-[14px] border border-[rgba(210,138,138,0.3)] bg-[rgba(210,138,138,0.06)] p-4 grid gap-3">
                <p className="text-sm font-semibold text-[var(--danger)]">
                  Estado seleccionado requiere firma de administrador para proceder al cierre.
                </p>

                <Field label="Administrador responsable" helper="Debe tener perfil administrador activo y clave iTop configurada.">
                  {isGlobalReadOnly ? (
                    <div className={`${INPUT_CLASS} flex items-center`}>
                      <span className="truncate text-sm font-semibold">{form.requesterAdmin?.name || "—"}</span>
                    </div>
                  ) : (
                    <select
                      value={form.requesterAdmin?.userId || ""}
                      onChange={(e) => {
                        const selectedUser = adminOptions.find((u) => String(u.userId) === String(e.target.value));
                        setField("requesterAdmin", selectedUser
                          ? { userId: selectedUser.userId, name: selectedUser.name, itopPersonKey: selectedUser.itopPersonKey || "" }
                          : null
                        );
                      }}
                      disabled={exitLocked && !isGlobalReadOnly ? false : isGlobalReadOnly}
                      className={`${INPUT_CLASS} cursor-pointer`}
                    >
                      <option value="">Selecciona un administrador...</option>
                      {adminOptions.map((u) => (
                        <option key={u.userId} value={u.userId}>
                          {u.name}{u.itopPersonKey ? "" : " (sin clave iTop)"}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>

                <Field label="Justificacion de baja" helper="Motivo tecnico que justifica la derivacion.">
                  <textarea
                    rows={3}
                    value={form.obsoleteNotes}
                    onChange={(e) => setField("obsoleteNotes", e.target.value)}
                    disabled={isGlobalReadOnly || exitLocked}
                    placeholder="Justificacion tecnica para dar de baja el activo..."
                    className={TEXTAREA_CLASS}
                  />
                </Field>

                {hasExitDoc && form.requesterAdmin?.userId && (
                  <div className="flex flex-wrap items-center gap-3">
                    <SignatureBadge status={adminSignatureStatus} />
                    {canOpenQr && !["signed", "published"].includes(adminSignatureStatus) && !isNew && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="border-[rgba(210,138,138,0.4)] text-[var(--danger)] hover:bg-[rgba(210,138,138,0.08)]"
                        onClick={() => handleOpenQr({ phase: "", workflowKind: "adminApproval", isAdmin: true })}
                      >
                        <Icon name="mobile" size={12} className="mr-1" />
                        Solicitar firma administrador
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {statusCode === "pending_admin_signature" && !isObsoleteExit && canOpenQr && (
              <div className="flex flex-wrap items-center gap-3">
                <SignatureBadge status={adminSignatureStatus} />
                {!["signed", "published"].includes(adminSignatureStatus) && !isNew && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="border-[rgba(210,138,138,0.4)] text-[var(--danger)] hover:bg-[rgba(210,138,138,0.08)]"
                    onClick={() => handleOpenQr({ phase: "", workflowKind: "adminApproval", isAdmin: true })}
                  >
                    <Icon name="mobile" size={12} className="mr-1" />
                    Solicitar firma administrador
                  </Button>
                )}
              </div>
            )}

            {!isGlobalReadOnly && !exitLocked && (
              <div className="flex flex-col items-end gap-1.5">
                <Button
                  variant="primary"
                  onClick={() => handleGenerateDocument("salida", setGeneratingExit, { alreadyHasDoc: hasExitDoc })}
                  disabled={generatingExit || !form.exitDate || !form.workPerformed.trim() || !form.exitFinalState}
                >
                  {generatingExit ? (
                    <><span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Generando...</>
                  ) : "Confirmar salida y generar acta"}
                </Button>
                {(!form.exitDate || !form.workPerformed.trim() || !form.exitFinalState) && (
                  <p className="text-xs text-[var(--text-muted)]">
                    {!form.exitDate ? "Ingresa la fecha de salida." : !form.exitFinalState ? "Selecciona el estado final del activo." : "Completa el campo «Trabajo realizado»."}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </PhasePanel>

      {/* Document library summary */}
      {!isNew && (hasEntryDoc || hasProcessingDoc || hasExitDoc) && (
        <SectionPanel eyebrow="Documentos generados" title="Biblioteca de documentos">
          <div className="grid gap-3 sm:grid-cols-3">
            {hasEntryDoc && (
              <button
                type="button"
                onClick={() => handleViewDocument(form.entryGeneratedDocument)}
                className="flex items-center gap-3 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4 text-left hover:border-[var(--accent-strong)] hover:bg-[var(--accent-soft)] transition-colors"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <Icon name="fileLines" size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">Acta de entrada</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text-primary)]">{form.entryGeneratedDocument?.filename || "entrada.pdf"}</p>
                  {entrySignatureStatus && <SignatureBadge status={entrySignatureStatus} />}
                </div>
              </button>
            )}
            {hasProcessingDoc && (
              <button
                type="button"
                onClick={() => handleViewDocument(form.processingGeneratedDocument)}
                className="flex items-center gap-3 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4 text-left hover:border-[rgba(106,63,160,0.5)] hover:bg-[rgba(106,63,160,0.06)] transition-colors"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(106,63,160,0.1)] text-[rgba(106,63,160,0.9)]">
                  <Icon name="fileLines" size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">Acta de procesamiento</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text-primary)]">{form.processingGeneratedDocument?.filename || "procesamiento.pdf"}</p>
                  {processingSignatureStatus && <SignatureBadge status={processingSignatureStatus} />}
                </div>
              </button>
            )}
            {hasExitDoc && (
              <button
                type="button"
                onClick={() => handleViewDocument(form.exitGeneratedDocument)}
                className="flex items-center gap-3 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4 text-left hover:border-[var(--success)] hover:bg-[rgba(127,191,156,0.08)] transition-colors"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(127,191,156,0.14)] text-[var(--success)]">
                  <Icon name="fileLines" size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">Acta de salida</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text-primary)]">{form.exitGeneratedDocument?.filename || "salida.pdf"}</p>
                  {exitSignatureStatus && <SignatureBadge status={exitSignatureStatus} />}
                </div>
              </button>
            )}
          </div>
        </SectionPanel>
      )}

      <ScrollToTopButton />
    </div>
  );
}
