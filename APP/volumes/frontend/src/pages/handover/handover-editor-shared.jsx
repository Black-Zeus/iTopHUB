import { useState } from "react";
import { CollapseToggleButton, Panel, PanelHeader } from "../../components/ui/general";
import { Icon } from "../../components/ui/icon/Icon";
import { Button } from "../../ui/Button";

export const INPUT_CLASS_NAME = "h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none";
export const TEXTAREA_CLASS_NAME = "w-full rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none";
const SECONDARY_RECEIVER_ROLE_OPTIONS = ["Contraturno", "Referente de area", "Respaldo operativo", "Testigo"];

function normalizeSecondaryReceiverRole(value) {
  if (value === "Apoyo") {
    return "Respaldo operativo";
  }
  return SECONDARY_RECEIVER_ROLE_OPTIONS.includes(value) ? value : "Contraturno";
}

export function createEmptyForm(bootstrap) {
  return {
    creationDate: bootstrap?.defaults?.creationDate || bootstrap?.defaults?.generatedAt || "",
    assignmentDate: bootstrap?.defaults?.assignmentDate || "",
    evidenceDate: bootstrap?.defaults?.evidenceDate || "",
    evidenceAttachments: bootstrap?.defaults?.evidenceAttachments || [],
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
    creationDate: detail.creationDate || detail.generatedAt || bootstrap?.defaults?.creationDate || "",
    assignmentDate: detail.assignmentDate || "",
    evidenceDate: detail.evidenceDate || "",
    evidenceAttachments: detail.evidenceAttachments || [],
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
                className={`rounded-[12px] px-3 py-2 text-left text-sm transition ${
                  option === currentRole
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
  removeAssetFromForm,
  updateItemNotes,
  addChecklistToAsset,
  removeChecklistFromAsset,
  updateChecklistAnswer,
  collapsedSections,
  toggleSection,
  isCreateMode,
  notesPlaceholder,
  minCharsPeople,
  minCharsAssets,
  selectPrimaryReceiver,
  promoteAdditionalReceiverToPrimary,
  removePrimaryReceiver,
  addAdditionalReceiver,
  removeAdditionalReceiver,
  updateAdditionalReceiverRole,
}) {
  const topPanelsExpanded = !collapsedSections.document && !collapsedSections.receiver;

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
                    <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className={INPUT_CLASS_NAME}>
                      {statusOptions.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Fecha creacion">
                    <input type="datetime-local" value={form.creationDate || ""} onChange={(event) => setForm((current) => ({ ...current, creationDate: event.target.value }))} className={INPUT_CLASS_NAME} />
                  </Field>
                  <Field label="Fecha asignacion">
                    <input type="datetime-local" value={form.assignmentDate || ""} onChange={(event) => setForm((current) => ({ ...current, assignmentDate: event.target.value }))} className={INPUT_CLASS_NAME} />
                  </Field>
                </div>

                <div className="grid gap-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Adjuntos de evidencia</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">Cada adjunto quedara asociado a su evidencia y podra sumar una observacion o categorizacion cuando se defina esa estructura.</p>
                    </div>
                    <Field label="Fecha evidencia">
                      <input type="datetime-local" value={form.evidenceDate || ""} onChange={(event) => setForm((current) => ({ ...current, evidenceDate: event.target.value }))} className={INPUT_CLASS_NAME} />
                    </Field>
                  </div>

                  {form.evidenceAttachments?.length ? (
                    <div className="grid gap-3">
                      {form.evidenceAttachments.map((attachment, index) => (
                        <div key={`evidence-${index}`} className="grid gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.8fr)_minmax(220px,1fr)]">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Adjunto</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{attachment.name || `Adjunto ${index + 1}`}</p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">{[attachment.mimeType, attachment.size, attachment.source].filter(Boolean).join(" / ") || "Sin metadata definida"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Evidencia</p>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">{form.evidenceDate || "Pendiente de registrar"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Observacion / categoria</p>
                            <p className="mt-2 text-sm text-[var(--text-secondary)]">Pendiente de definicion funcional.</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <MessageBanner>No hay adjuntos de evidencia registrados todavia.</MessageBanner>
                  )}
                </div>
              </div>
            ) : null}
            <div className="md:col-span-2">
              <Field label="Motivo de entrega">
                <textarea rows="3" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} className={TEXTAREA_CLASS_NAME} placeholder="Indica por que se emite esta acta" />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Observaciones generales">
                <textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={TEXTAREA_CLASS_NAME} placeholder={notesPlaceholder || "Registra condiciones de entrega, accesorios, estado visible y acuerdos relevantes"} />
              </Field>
            </div>
          </div>
        </EditorSectionPanel>

        <EditorSectionPanel
          eyebrow="Destino"
          title="Persona que recibe"
          helper="Busca en Personas de iTop, define una persona principal y, si hace falta, agrega participantes secundarios con un motivo claro."
          isCollapsed={collapsedSections.receiver}
          onToggle={() => toggleSection("receiver")}
          className={topPanelsExpanded ? "h-full" : ""}
        >
          <div className="grid gap-4">
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
                    <div className="flex items-center gap-2">
                      <CornerIconButton iconName="xmark" label="Quitar principal" onClick={removePrimaryReceiver} />
                    </div>
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
                        <SecondaryRoleMenu
                          personId={person.id}
                          currentRole={normalizeSecondaryReceiverRole(person.assignmentRole)}
                          onChange={(nextRole) => updateAdditionalReceiverRole(person.id, nextRole)}
                        />
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{person.name}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{`${person.code || "Sin codigo"}${person.email ? ` / ${person.email}` : ""}`}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{[person.role, person.status].filter(Boolean).join(" / ")}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => promoteAdditionalReceiverToPrimary(person.id)}>
                          Hacer principal
                        </Button>
                        <CornerIconButton iconName="xmark" label="Quitar secundario" onClick={() => removeAdditionalReceiver(person.id)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div ref={receiverSelectionEndRef} />
          </div>
        </EditorSectionPanel>
      </div>

      <EditorSectionPanel
        eyebrow="Activos"
        title="Activos incluidos"
        helper="Agrega los equipos o elementos entregados y documenta sus observaciones y checklist asociado."
        isCollapsed={collapsedSections.assets}
        onToggle={() => toggleSection("assets")}
      >
        <div className="relative z-10">
          <Field label="Buscar activo">
            <input type="search" value={assetSearchQuery} onChange={(event) => setAssetSearchQuery(event.target.value)} className={INPUT_CLASS_NAME} placeholder={`Codigo, nombre o serie (${minCharsAssets}+ caracteres)`} />
          </Field>

          {assetSearchQuery.trim().length > 0 && assetSearchQuery.trim().length < minCharsAssets ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20">
              <MessageBanner>Ingresa al menos {minCharsAssets} caracteres para buscar dispositivos autorizados en CMDB.</MessageBanner>
            </div>
          ) : null}

          {assetResults.length ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 max-h-[320px] overflow-y-auto rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-soft)]">
              <div className="grid gap-3">
                {assetResults.map((asset) => (
                  <ResultCard
                    key={asset.id}
                    title={`${asset.code} / ${asset.name}`}
                    subtitle={[asset.className, asset.serial].filter(Boolean).join(" / ")}
                    helper={[asset.status, asset.assignedUser].filter(Boolean).join(" / ")}
                    actions={<Button size="sm" variant="secondary" onClick={() => addAssetToForm(asset)}>Agregar</Button>}
                  />
                ))}
              </div>
            </div>
          ) : assetLoading ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20">
              <MessageBanner>Buscando activos autorizados...</MessageBanner>
            </div>
          ) : null}
        </div>

        {!form.items.length ? (
          <MessageBanner>No hay activos agregados a esta acta.</MessageBanner>
        ) : (
          <div className="grid gap-4">
            {form.items.map((item) => {
              const availableTemplates = activeTemplates.filter((template) => !item.checklists.some((checklist) => checklist.templateId === template.id));

              return (
                <div key={item.asset?.id} className="rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow-subtle)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-[var(--text-primary)]">{item.asset?.code} / {item.asset?.name}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{[item.asset?.className, item.asset?.brand, item.asset?.model].filter(Boolean).join(" / ")}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{[item.asset?.serial, item.asset?.status, item.asset?.assignedUser].filter(Boolean).join(" / ")}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => removeAssetFromForm(item.asset?.id)}>
                      <Icon name="xmark" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Quitar
                    </Button>
                  </div>

                  <div className="mt-5 grid gap-5">
                    <Field label="Observacion del item">
                      <textarea rows="3" value={item.notes || ""} onChange={(event) => updateItemNotes(item.asset?.id, event.target.value)} className={TEXTAREA_CLASS_NAME} placeholder="Accesorios, condiciones particulares o acuerdos asociados al activo" />
                    </Field>

                    <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
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
                    </div>

                    {!item.checklists.length ? (
                      <MessageBanner>Este activo aun no tiene checklist aplicado.</MessageBanner>
                    ) : (
                      <div className="grid gap-4">
                        {item.checklists.map((checklist) => (
                          <div key={`${item.asset?.id}-${checklist.templateId}`} className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
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
                                <div key={answer.checklistItemId} className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-4">
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
      </EditorSectionPanel>
    </div>
  );
}
