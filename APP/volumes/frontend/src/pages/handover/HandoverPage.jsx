import { useEffect, useMemo, useState } from "react";
import { DataTable, FilterDropdown, KpiCard, Panel, PanelHeader } from "../../components/ui/general";
import { SearchFilterInput } from "../../components/ui/general/SearchFilterInput";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Icon } from "../../components/ui/icon/Icon";
import { Modal } from "../../components/ui/modal";
import { Button } from "../../ui/Button";
import {
  createHandoverDocument,
  getHandoverBootstrap,
  getHandoverDocument,
  listHandoverDocuments,
  searchHandoverAssets,
  searchHandoverPeople,
  updateHandoverDocument,
} from "../../services/handover-service";
import { downloadRowsAsCsv } from "../../utils/export-csv";


const INPUT_CLASS_NAME = "h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none";
const TEXTAREA_CLASS_NAME = "w-full rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none";
const HANDOVER_FILTER_CONTROL_HEIGHT = "h-[66px]";


function createEmptyForm(bootstrap) {
  return {
    generatedAt: bootstrap?.defaults?.generatedAt || "",
    status: "Borrador",
    handoverType: "Asignacion inicial",
    reason: "",
    notes: bootstrap?.defaults?.notes || "",
    owner: bootstrap?.sessionUser || { id: null, name: "", username: "" },
    receiver: null,
    items: [],
  };
}


function buildKpis(rows) {
  const draftCount = rows.filter((row) => row.status === "Borrador").length;
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
      label: "Borradores",
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


function cloneTemplate(template) {
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


function MessageBanner({ tone = "default", children }) {
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


function Field({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
      {children}
    </label>
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


function HandoverEditorSections({
  form,
  statusOptions,
  typeOptions,
  peopleLoading,
  peopleResults,
  personSearchQuery,
  setPersonSearchQuery,
  handlePeopleSearch,
  setForm,
  assetLoading,
  assetResults,
  assetSearchQuery,
  setAssetSearchQuery,
  handleAssetSearch,
  activeTemplates,
  selectedTemplateByAsset,
  setSelectedTemplateByAsset,
  addAssetToForm,
  removeAssetFromForm,
  updateItemNotes,
  addChecklistToAsset,
  removeChecklistFromAsset,
  updateChecklistAnswer,
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="bg-[var(--bg-app)]">
          <PanelHeader eyebrow="Emision" title="Datos del documento" />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Fecha y hora">
              <input type="datetime-local" value={form.generatedAt || ""} onChange={(event) => setForm((current) => ({ ...current, generatedAt: event.target.value }))} className={INPUT_CLASS_NAME} />
            </Field>
            <Field label="Responsable">
              <input type="text" value={form.owner?.name || ""} readOnly className={INPUT_CLASS_NAME} />
            </Field>
            <Field label="Estado del acta">
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className={INPUT_CLASS_NAME}>
                {statusOptions.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Tipo de entrega">
              <select value={form.handoverType} onChange={(event) => setForm((current) => ({ ...current, handoverType: event.target.value }))} className={INPUT_CLASS_NAME}>
                {typeOptions.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Motivo">
                <textarea rows="3" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} className={TEXTAREA_CLASS_NAME} placeholder="Motivo operacional de la entrega" />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Observacion">
                <textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={TEXTAREA_CLASS_NAME} placeholder="Condiciones de entrega, accesorios y comentarios relevantes" />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel className="bg-[var(--bg-app)]">
          <PanelHeader eyebrow="Destino" title="Persona que recibe" />
          <div className="grid gap-4">
            <form
              className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                handlePeopleSearch();
              }}
            >
              <Field label="Buscar persona">
                <input type="search" value={personSearchQuery} onChange={(event) => setPersonSearchQuery(event.target.value)} className={INPUT_CLASS_NAME} placeholder="Nombre, identificador o correo" />
              </Field>
              <div className="flex items-end">
                <Button type="submit" variant="primary" disabled={peopleLoading}>
                  <Icon name="check" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Buscar
                </Button>
              </div>
            </form>

            {form.receiver ? (
              <ResultCard
                title={form.receiver.name}
                subtitle={`${form.receiver.code || "Sin codigo"}${form.receiver.email ? ` · ${form.receiver.email}` : ""}`}
                helper={[form.receiver.role, form.receiver.status].filter(Boolean).join(" · ")}
                actions={<Button size="sm" variant="secondary" onClick={() => setForm((current) => ({ ...current, receiver: null }))}>Cambiar</Button>}
              />
            ) : (
              <MessageBanner>No hay persona seleccionada para esta acta.</MessageBanner>
            )}

            {peopleResults.length ? (
              <div className="grid gap-3">
                {peopleResults.map((person) => (
                  <ResultCard
                    key={person.id}
                    title={person.name}
                    subtitle={`${person.code}${person.email ? ` · ${person.email}` : ""}`}
                    helper={[person.role, person.status].filter(Boolean).join(" · ")}
                    actions={<Button size="sm" variant="secondary" onClick={() => setForm((current) => ({ ...current, receiver: person }))}>Seleccionar</Button>}
                  />
                ))}
              </div>
            ) : peopleLoading ? (
              <MessageBanner>Buscando personas...</MessageBanner>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel className="bg-[var(--bg-app)]">
        <PanelHeader eyebrow="Activos" title="Activos incluidos" />
        <div className="grid gap-4">
          <form
            className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              handleAssetSearch();
            }}
          >
            <Field label="Buscar activo">
              <input type="search" value={assetSearchQuery} onChange={(event) => setAssetSearchQuery(event.target.value)} className={INPUT_CLASS_NAME} placeholder="Codigo, nombre o serie" />
            </Field>
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={assetLoading}>
                <Icon name="check" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Buscar
              </Button>
            </div>
          </form>

          {assetResults.length ? (
            <div className="grid gap-3">
              {assetResults.map((asset) => (
                <ResultCard
                  key={asset.id}
                  title={`${asset.code} · ${asset.name}`}
                  subtitle={[asset.className, asset.serial].filter(Boolean).join(" · ")}
                  helper={[asset.status, asset.assignedUser].filter(Boolean).join(" · ")}
                  actions={<Button size="sm" variant="secondary" onClick={() => addAssetToForm(asset)}>Agregar</Button>}
                />
              ))}
            </div>
          ) : assetLoading ? (
            <MessageBanner>Buscando activos...</MessageBanner>
          ) : null}

          {!form.items.length ? (
            <MessageBanner>No hay activos agregados a esta acta.</MessageBanner>
          ) : (
            <div className="grid gap-4">
              {form.items.map((item) => {
                const availableTemplates = activeTemplates.filter((template) => !item.checklists.some((checklist) => checklist.templateId === template.id));

                return (
                  <div key={item.asset?.id} className="rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow-subtle)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-[var(--text-primary)]">{item.asset?.code} · {item.asset?.name}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{[item.asset?.className, item.asset?.brand, item.asset?.model].filter(Boolean).join(" · ")}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{[item.asset?.serial, item.asset?.status, item.asset?.assignedUser].filter(Boolean).join(" · ")}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => removeAssetFromForm(item.asset?.id)}>
                        <Icon name="xmark" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Quitar
                      </Button>
                    </div>

                    <div className="mt-5 grid gap-4">
                      <Field label="Observacion del item">
                        <textarea rows="3" value={item.notes || ""} onChange={(event) => updateItemNotes(item.asset?.id, event.target.value)} className={TEXTAREA_CLASS_NAME} placeholder="Accesorios, condiciones particulares o acuerdos asociados al activo" />
                      </Field>

                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                        <Field label="Agregar checklist">
                          <select value={selectedTemplateByAsset[item.asset?.id] || ""} onChange={(event) => setSelectedTemplateByAsset((current) => ({ ...current, [item.asset?.id]: event.target.value }))} className={INPUT_CLASS_NAME}>
                            <option value="">Selecciona una plantilla</option>
                            {availableTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                          </select>
                        </Field>
                        <div className="flex items-end">
                          <Button variant="secondary" onClick={() => addChecklistToAsset(item.asset?.id)} disabled={!availableTemplates.length}>
                            <Icon name="plus" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            Agregar checklist
                          </Button>
                        </div>
                      </div>

                      {!item.checklists.length ? (
                        <MessageBanner>Este activo aun no tiene checklist aplicado.</MessageBanner>
                      ) : (
                        <div className="grid gap-4">
                          {item.checklists.map((checklist) => (
                            <div key={`${item.asset?.id}-${checklist.templateId}`} className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-[var(--text-primary)]">{checklist.templateName}</p>
                                  {checklist.templateDescription ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{checklist.templateDescription}</p> : null}
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => removeChecklistFromAsset(item.asset?.id, checklist.templateId)}>
                                  <Icon name="xmark" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  Quitar
                                </Button>
                              </div>

                              <div className="mt-4 grid gap-4">
                                {checklist.answers.map((answer) => (
                                  <div key={answer.checklistItemId} className="rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-4">
                                    <p className="text-sm font-semibold text-[var(--text-primary)]">{answer.name}</p>
                                    {answer.description ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{answer.description}</p> : null}
                                    <div className="mt-3">
                                      <ChecklistAnswerField answer={answer} groupName={`asset-${item.asset?.id}-template-${checklist.templateId}-check-${answer.checklistItemId}`} onChange={(value) => updateChecklistAnswer(item.asset?.id, checklist.templateId, answer.checklistItemId, value)} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}


export function HandoverPage() {
  const [bootstrap, setBootstrap] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState({ query: "", status: "", handoverType: "" });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("create");
  const [editingDocumentId, setEditingDocumentId] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(createEmptyForm(null));
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [peopleResults, setPeopleResults] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetResults, setAssetResults] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [selectedTemplateByAsset, setSelectedTemplateByAsset] = useState({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const statusOptions = bootstrap?.statusOptions || [];
  const typeOptions = bootstrap?.typeOptions || [];
  const activeTemplates = bootstrap?.checklistTemplates || [];
  const kpis = useMemo(() => buildKpis(rows), [rows]);

  const templateOptionsById = useMemo(() => {
    const index = new Map();
    activeTemplates.forEach((template) => {
      index.set(template.id, template);
    });
    return index;
  }, [activeTemplates]);

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

  const loadBootstrap = async () => {
    setBootstrapLoading(true);
    try {
      const payload = await getHandoverBootstrap();
      setBootstrap(payload);
      setForm(createEmptyForm(payload));
    } catch (loadError) {
      setError(loadError.message || "No fue posible preparar el modulo.");
    } finally {
      setBootstrapLoading(false);
    }
  };

  useEffect(() => {
    loadBootstrap();
    loadDocuments({ query: "", status: "", handoverType: "" });
  }, []);

  const resetEditor = () => {
    setError("");
    setNotice("");
    setEditorOpen(false);
    setEditorMode("create");
    setEditingDocumentId(null);
    setPeopleResults([]);
    setAssetResults([]);
    setPersonSearchQuery("");
    setAssetSearchQuery("");
    setSelectedTemplateByAsset({});
    setForm(createEmptyForm(bootstrap));
  };

  const closeCreateModal = ({ clearError = true } = {}) => {
    if (clearError) {
      setError("");
    }
    setIsCreateModalOpen(false);
    setEditorMode("create");
    setEditingDocumentId(null);
    setPeopleResults([]);
    setAssetResults([]);
    setPersonSearchQuery("");
    setAssetSearchQuery("");
    setSelectedTemplateByAsset({});
    setForm(createEmptyForm(bootstrap));
  };

  const openNewEditor = () => {
    setError("");
    setNotice("");
    setEditorOpen(false);
    setEditorMode("create");
    setEditingDocumentId(null);
    setForm(createEmptyForm(bootstrap));
    setSelectedTemplateByAsset({});
    setPeopleResults([]);
    setAssetResults([]);
    setIsCreateModalOpen(true);
  };

  const openEditEditor = async (documentId) => {
    setEditorOpen(true);
    setEditorLoading(true);
    setNotice("");
    setError("");
    try {
      const detail = await getHandoverDocument(documentId);
      setEditorMode("edit");
      setEditingDocumentId(documentId);
      setForm({
        generatedAt: detail.generatedAt || "",
        status: detail.status || "Borrador",
        handoverType: detail.handoverType || "Asignacion inicial",
        reason: detail.reason || "",
        notes: detail.notes || "",
        owner: {
          id: detail.owner?.userId || bootstrap?.sessionUser?.id || null,
          name: detail.owner?.name || bootstrap?.sessionUser?.name || "",
          username: bootstrap?.sessionUser?.username || "",
        },
        receiver: detail.receiver || null,
        items: detail.items || [],
      });
    } catch (loadError) {
      setError(loadError.message || "No fue posible abrir el acta seleccionada.");
      setEditorOpen(false);
    } finally {
      setEditorLoading(false);
    }
  };

  const handleFilterSubmit = async (event) => {
    event.preventDefault();
    setNotice("");
    await loadDocuments(filters);
  };

  const handlePeopleSearch = async () => {
    setPeopleLoading(true);
    setNotice("");
    try {
      const items = await searchHandoverPeople({ query: personSearchQuery });
      setPeopleResults(items);
    } catch (loadError) {
      setError(loadError.message || "No fue posible buscar personas.");
    } finally {
      setPeopleLoading(false);
    }
  };

  const handleAssetSearch = async () => {
    setAssetLoading(true);
    setNotice("");
    try {
      const items = await searchHandoverAssets({ query: assetSearchQuery });
      setAssetResults(items);
    } catch (loadError) {
      setError(loadError.message || "No fue posible buscar activos.");
    } finally {
      setAssetLoading(false);
    }
  };

  const addAssetToForm = (asset) => {
    if (form.items.some((item) => item.asset?.id === asset.id)) {
      setNotice("El activo seleccionado ya fue agregado al acta.");
      return;
    }

    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          asset,
          notes: "",
          checklists: [],
        },
      ],
    }));
  };

  const removeAssetFromForm = (assetId) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((item) => item.asset?.id !== assetId),
    }));
  };

  const updateItemNotes = (assetId, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.asset?.id === assetId ? { ...item, notes: value } : item),
    }));
  };

  const addChecklistToAsset = (assetId) => {
    const templateId = Number(selectedTemplateByAsset[assetId] || 0);
    if (!templateId) {
      return;
    }

    const template = templateOptionsById.get(templateId);
    if (!template) {
      return;
    }

    const targetItem = form.items.find((item) => item.asset?.id === assetId);
    if (targetItem?.checklists.some((checklist) => checklist.templateId === templateId)) {
      setNotice("La plantilla seleccionada ya fue aplicada a este activo.");
      return;
    }

    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.asset?.id !== assetId) {
          return item;
        }
        return {
          ...item,
          checklists: [...item.checklists, cloneTemplate(template)],
        };
      }),
    }));
  };

  const removeChecklistFromAsset = (assetId, templateId) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.asset?.id === assetId ? { ...item, checklists: item.checklists.filter((checklist) => checklist.templateId !== templateId) } : item),
    }));
  };

  const updateChecklistAnswer = (assetId, templateId, checklistItemId, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.asset?.id !== assetId) {
          return item;
        }

        return {
          ...item,
          checklists: item.checklists.map((checklist) => {
            if (checklist.templateId !== templateId) {
              return checklist;
            }

            return {
              ...checklist,
              answers: checklist.answers.map((answer) => answer.checklistItemId === checklistItemId ? { ...answer, value } : answer),
            };
          }),
        };
      }),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      generatedAt: form.generatedAt,
      status: form.status,
      handoverType: form.handoverType,
      reason: form.reason,
      notes: form.notes,
      receiver: form.receiver || {},
      items: form.items,
    };

    try {
      const savedItem = editorMode === "edit" && editingDocumentId
        ? await updateHandoverDocument(editingDocumentId, payload)
        : await createHandoverDocument(payload);

      setNotice(`Acta ${savedItem.documentNumber || ""} guardada correctamente.`);
      await loadDocuments(filters);

      if (isCreateModalOpen) {
        closeCreateModal({ clearError: false });
        return;
      }

      setEditorMode("edit");
      setEditingDocumentId(savedItem.id);
      setForm({
        generatedAt: savedItem.generatedAt || "",
        status: savedItem.status || "Borrador",
        handoverType: savedItem.handoverType || "Asignacion inicial",
        reason: savedItem.reason || "",
        notes: savedItem.notes || "",
        owner: {
          id: savedItem.owner?.userId || bootstrap?.sessionUser?.id || null,
          name: savedItem.owner?.name || bootstrap?.sessionUser?.name || "",
          username: bootstrap?.sessionUser?.username || "",
        },
        receiver: savedItem.receiver || null,
        items: savedItem.items || [],
      });
      setEditorOpen(true);
    } catch (saveError) {
      setError(saveError.message || "No fue posible guardar el acta.");
    } finally {
      setSaving(false);
    }
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
          <Button size="sm" variant="secondary" onClick={() => openEditEditor(row.id)}>
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
                      ...statusOptions,
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
                      ...typeOptions,
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
              <Button variant="primary" onClick={openNewEditor} disabled={bootstrapLoading || !bootstrap}>
                <Icon name="plus" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Nueva acta
              </Button>
            </>
          )}
        />

        <DataTable columns={tableColumns} rows={rows} loading={loading} emptyMessage="No hay actas de entrega registradas con los filtros actuales." />
      </Panel>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => closeCreateModal()}
        title="Nueva acta de entrega"
        size="clientWide"
        showFooter={false}
        content={(
          <div className="grid gap-5 p-2">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => closeCreateModal()}>
                <Icon name="xmark" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Cerrar
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                <Icon name="save" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Guardar acta
              </Button>
            </div>

            <HandoverEditorSections
              form={form}
              statusOptions={statusOptions}
              typeOptions={typeOptions}
              peopleLoading={peopleLoading}
              peopleResults={peopleResults}
              personSearchQuery={personSearchQuery}
              setPersonSearchQuery={setPersonSearchQuery}
              handlePeopleSearch={handlePeopleSearch}
              setForm={setForm}
              assetLoading={assetLoading}
              assetResults={assetResults}
              assetSearchQuery={assetSearchQuery}
              setAssetSearchQuery={setAssetSearchQuery}
              handleAssetSearch={handleAssetSearch}
              activeTemplates={activeTemplates}
              selectedTemplateByAsset={selectedTemplateByAsset}
              setSelectedTemplateByAsset={setSelectedTemplateByAsset}
              addAssetToForm={addAssetToForm}
              removeAssetFromForm={removeAssetFromForm}
              updateItemNotes={updateItemNotes}
              addChecklistToAsset={addChecklistToAsset}
              removeChecklistFromAsset={removeChecklistFromAsset}
              updateChecklistAnswer={updateChecklistAnswer}
            />
          </div>
        )}
      />

      {editorOpen ? (
        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Workspace"
            title={editorMode === "edit" ? "Editar acta de entrega" : "Nueva acta de entrega"}
            actions={(
              <>
                <Button variant="secondary" onClick={resetEditor}>
                  <Icon name="xmark" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Cerrar
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={saving || editorLoading}>
                  <Icon name="save" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Guardar acta
                </Button>
              </>
            )}
          />

          {editorLoading ? (
            <MessageBanner>Cargando acta seleccionada...</MessageBanner>
          ) : (
            <HandoverEditorSections
              form={form}
              statusOptions={statusOptions}
              typeOptions={typeOptions}
              peopleLoading={peopleLoading}
              peopleResults={peopleResults}
              personSearchQuery={personSearchQuery}
              setPersonSearchQuery={setPersonSearchQuery}
              handlePeopleSearch={handlePeopleSearch}
              setForm={setForm}
              assetLoading={assetLoading}
              assetResults={assetResults}
              assetSearchQuery={assetSearchQuery}
              setAssetSearchQuery={setAssetSearchQuery}
              handleAssetSearch={handleAssetSearch}
              activeTemplates={activeTemplates}
              selectedTemplateByAsset={selectedTemplateByAsset}
              setSelectedTemplateByAsset={setSelectedTemplateByAsset}
              addAssetToForm={addAssetToForm}
              removeAssetFromForm={removeAssetFromForm}
              updateItemNotes={updateItemNotes}
              addChecklistToAsset={addChecklistToAsset}
              removeChecklistFromAsset={removeChecklistFromAsset}
              updateChecklistAnswer={updateChecklistAnswer}
            />
          )}
        </Panel>
      ) : null}
    </div>
  );
}
