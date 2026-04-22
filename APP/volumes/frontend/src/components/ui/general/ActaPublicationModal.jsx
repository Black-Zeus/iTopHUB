import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icon/Icon";
import { Button } from "../../../ui/Button";

const INPUT_CLASS_NAME =
  "h-10 w-full rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-strong)]";

const SELECT_CLASS_NAME =
  "h-10 w-full rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-strong)]";

const TEXTAREA_CLASS_NAME =
  "w-full resize-y rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm leading-5 text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-strong)]";

const TEXTAREA_FILL_CLASS_NAME =
  "h-full min-h-[12rem] w-full resize-none rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm leading-5 text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-strong)]";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptions(options = []) {
  return options
    .map((option) => ({
      ...option,
      value: normalizeText(option?.value ?? option?.id),
      label: normalizeText(option?.label ?? option?.name ?? option?.person),
    }))
    .filter((option) => option.value && option.label);
}

function removeResponsibleSuffix(subject) {
  return normalizeText(subject).replace(/\s*\/\/\s*.+$/u, "").trim();
}

function buildResponsibleLabel(requester) {
  const normalizedRequester = normalizeText(requester);
  return normalizedRequester ? `${normalizedRequester} // Asignacion de Activo` : "";
}

function ensureSubjectSuffix(subject, requester) {
  const baseSubject = removeResponsibleSuffix(subject);
  const responsibleLabel = buildResponsibleLabel(requester);
  if (!responsibleLabel) {
    return baseSubject;
  }
  return `${baseSubject || "Registro Movimiento de Inventario"} // ${responsibleLabel}`;
}

function buildInitialForm(initialValues = {}) {
  const requester = normalizeText(initialValues.requester);
  return {
    actaType: normalizeText(initialValues.actaType),
    requesterId: normalizeText(initialValues.requesterId),
    requester,
    groupId: normalizeText(initialValues.groupId),
    groupName: normalizeText(initialValues.groupName),
    analystId: normalizeText(initialValues.analystId),
    analystName: normalizeText(initialValues.analystName),
    subject: ensureSubjectSuffix(initialValues.subject, requester),
    description: normalizeText(initialValues.description),
    origin: normalizeText(initialValues.origin),
    impact: normalizeText(initialValues.impact),
    urgency: normalizeText(initialValues.urgency),
    priority: normalizeText(initialValues.priority),
    category: normalizeText(initialValues.category),
    subcategory: normalizeText(initialValues.subcategory),
  };
}

function Field({ label, value, onChange, rows = 0, fill = false, className = "" }) {
  return (
    <label className={`grid gap-1.5 ${fill ? "min-h-0 grid-rows-[auto_minmax(0,1fr)]" : ""} ${className}`.trim()}>
      <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
      {rows ? (
        <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className={fill ? TEXTAREA_FILL_CLASS_NAME : TEXTAREA_CLASS_NAME} />
      ) : (
        <input type="text" value={value} onChange={(event) => onChange(event.target.value)} className={INPUT_CLASS_NAME} />
      )}
    </label>
  );
}

function SelectField({ label, value, onChange, options = [], placeholder = "Selecciona", disabled = false, className = "" }) {
  return (
    <label className={`grid gap-1.5 ${className}`.trim()}>
      <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={`${SELECT_CLASS_NAME} ${disabled ? "opacity-60" : ""}`.trim()}>
        <option value="">{placeholder}</option>
        {normalizeOptions(options).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function normalizeDocuments(documents = []) {
  return documents
    .map((document, index) => ({
      id: normalizeText(document?.id) || `document-${index}`,
      name: normalizeText(document?.name || document?.storedName || document?.code),
      documentType: normalizeText(document?.documentTypeLabel || document?.documentType || document?.kind || "Documento"),
      uploadedAt: normalizeText(document?.uploadedAt || document?.date || document?.preparedAt),
      originalName: normalizeText(document?.originalName),
      iconName: normalizeText(document?.iconName) || "fileLines",
      isAvailable: document?.isAvailable !== false,
      origin: normalizeText(document?.origin),
      payload: document?.payload || null,
      previewFile: document?.previewFile || null,
    }))
    .filter((document) => document.name);
}

function mergeAnalystOptions(options = [], fallbackOption = null) {
  const normalized = normalizeOptions(options);
  const fallback = normalizeOptions(fallbackOption ? [fallbackOption] : [])[0] || null;
  if (!fallback) {
    return normalized;
  }
  if (normalized.some((option) => option.value === fallback.value)) {
    return normalized.map((option) => (
      option.value === fallback.value
        ? { ...option, isCurrent: true }
        : option
    ));
  }
  return [{ ...fallback, isCurrent: true }, ...normalized];
}

function Section({ title, children, className = "", bodyClassName = "" }) {
  return (
    <section className={`grid gap-3 rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-app)] p-3 ${className}`.trim()}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{title}</p>
      <div className={bodyClassName || "grid gap-3"}>{children}</div>
    </section>
  );
}

export function ActaPublicationModalContent({
  initialValues = {},
  options = {},
  documents = [],
  onPreviewDocument,
  onLoadAnalystOptions,
  submitLabel = "Publicar",
  submittingLabel = "Publicando...",
  onCancel,
  onSubmit,
}) {
  const [form, setForm] = useState(() => buildInitialForm(initialValues));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  const requesterOptions = useMemo(() => normalizeOptions(options.requesterOptions), [options.requesterOptions]);
  const groupOptions = useMemo(() => normalizeOptions(options.groupOptions), [options.groupOptions]);
  const currentAnalystOption = useMemo(() => normalizeOptions(options.currentAnalystOption ? [options.currentAnalystOption] : [])[0] || null, [options.currentAnalystOption]);
  const [dynamicAnalystOptions, setDynamicAnalystOptions] = useState(() => mergeAnalystOptions(options.analystOptions, options.currentAnalystOption));
  const analystOptions = useMemo(() => mergeAnalystOptions(dynamicAnalystOptions, currentAnalystOption), [dynamicAnalystOptions, currentAnalystOption]);
  const documentItems = useMemo(() => normalizeDocuments(documents), [documents]);
  const subcategoryOptions = useMemo(() => {
    const allOptions = normalizeOptions(options.subcategoryOptions);
    if (!form.category) {
      return allOptions;
    }
    return allOptions.filter((option) => !option.serviceId || normalizeText(option.serviceId) === form.category);
  }, [form.category, options.subcategoryOptions]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!form.groupId && groupOptions.length === 1) {
      setForm((current) => ({
        ...current,
        groupId: groupOptions[0].value,
        groupName: groupOptions[0].label,
      }));
    }
  }, [form.groupId, groupOptions]);

  useEffect(() => {
    setDynamicAnalystOptions(mergeAnalystOptions(options.analystOptions, currentAnalystOption));
  }, [options.analystOptions, currentAnalystOption]);

  useEffect(() => {
    if (!form.requesterId && requesterOptions.length === 1) {
      setForm((current) => ({
        ...current,
        requesterId: requesterOptions[0].value,
        requester: requesterOptions[0].label,
        subject: ensureSubjectSuffix(current.subject, requesterOptions[0].label),
      }));
    }
  }, [form.requesterId, requesterOptions]);

  useEffect(() => {
    if (!form.groupId || form.analystId) {
      return;
    }

    const currentAnalyst = analystOptions.find((option) => option.isCurrent) || (analystOptions.length === 1 ? analystOptions[0] : null);
    if (currentAnalyst) {
      setForm((current) => ({
        ...current,
        analystId: currentAnalyst.value,
        analystName: currentAnalyst.label,
      }));
    }
  }, [form.groupId, form.analystId, analystOptions]);

  const canSubmit = useMemo(
    () => Boolean(form.requester && form.groupId && form.analystId && form.subject && form.description),
    [form.requester, form.groupId, form.analystId, form.subject, form.description]
  );

  const updateField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "requester") {
        next.subject = ensureSubjectSuffix(current.subject, value);
      }
      if (field === "requesterId") {
        const requesterLabel = requesterOptions.find((option) => option.value === value)?.label || "";
        next.requester = requesterLabel;
        next.subject = ensureSubjectSuffix(current.subject, requesterLabel);
      }
      if (field === "category") {
        next.subcategory = "";
      }
      if (field === "groupId") {
        next.groupName = groupOptions.find((option) => option.value === value)?.label || "";
        next.analystId = "";
        next.analystName = "";
      }
      if (field === "analystId") {
        next.analystName = analystOptions.find((option) => option.value === value)?.label || "";
      }
      return next;
    });
    setError("");
  };

  const updateGroup = async (value) => {
    updateField("groupId", value);
    if (!onLoadAnalystOptions || !value) {
      setDynamicAnalystOptions(mergeAnalystOptions([], currentAnalystOption));
      return;
    }
    try {
      const loadedOptions = await onLoadAnalystOptions(value);
      setDynamicAnalystOptions(mergeAnalystOptions(loadedOptions, currentAnalystOption));
    } catch (loadError) {
      setDynamicAnalystOptions(mergeAnalystOptions([], currentAnalystOption));
      setError(loadError.message || "No fue posible cargar analistas del grupo seleccionado.");
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError("Completa solicitante, grupo, analista, asunto y descripcion antes de publicar.");
      return;
    }

    const subject = ensureSubjectSuffix(form.subject, form.requester);
    const findLabel = (items, value) => normalizeOptions(items).find((option) => option.value === normalizeText(value))?.label || "";
    setSubmitting(true);
    try {
      await onSubmit?.({
        ...form,
        actaType: normalizeText(form.actaType),
        requesterId: normalizeText(form.requesterId),
        requester: normalizeText(form.requester),
        groupId: normalizeText(form.groupId),
        groupName: normalizeText(form.groupName),
        analystId: normalizeText(form.analystId),
        analystName: normalizeText(form.analystName),
        subject,
        description: normalizeText(form.description),
        origin: normalizeText(form.origin),
        impact: normalizeText(form.impact),
        urgency: normalizeText(form.urgency),
        priority: normalizeText(form.priority),
        category: normalizeText(form.category),
        subcategory: normalizeText(form.subcategory),
        originLabel: findLabel(options.originOptions, form.origin),
        impactLabel: findLabel(options.impactOptions, form.impact),
        urgencyLabel: findLabel(options.urgencyOptions, form.urgency),
        priorityLabel: findLabel(options.priorityOptions, form.priority),
        categoryLabel: findLabel(options.categoryOptions, form.category),
        subcategoryLabel: findLabel(subcategoryOptions, form.subcategory),
      });
    } catch (submitError) {
      if (mountedRef.current) {
        setError(submitError.message || "No fue posible publicar el acta.");
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="flex max-h-[78vh] min-h-0 flex-col gap-4 overflow-hidden">
      {error ? (
        <div className="shrink-0 rounded-[12px] border border-[rgba(214,106,106,0.22)] bg-[rgba(214,106,106,0.08)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto pr-1 xl:grid-cols-2">
        <Section title="Informacion general">
          <SelectField
            label="Solicitante"
            value={form.requesterId}
            onChange={(value) => updateField("requesterId", value)}
            options={requesterOptions}
          />
          <SelectField label="Grupo" value={form.groupId} onChange={updateGroup} options={groupOptions} />
          <SelectField
            label="Analista"
            value={form.analystId}
            onChange={(value) => updateField("analystId", value)}
            options={analystOptions}
            disabled={!form.groupId}
          />
        </Section>

        <Section title="Datos del ticket" className="min-h-0 content-start" bodyClassName="grid min-h-0 content-start gap-3">
          <Field label="Asunto" value={form.subject} onChange={(value) => updateField("subject", value)} />
          <Field label="Descripcion" rows={8} value={form.description} onChange={(value) => updateField("description", value)} />
        </Section>

        <Section title="Clasificacion">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label="Impacto" value={form.impact} onChange={(value) => updateField("impact", value)} options={options.impactOptions} />
            <SelectField label="Urgencia" value={form.urgency} onChange={(value) => updateField("urgency", value)} options={options.urgencyOptions} />
            <SelectField label="Prioridad" value={form.priority} onChange={(value) => updateField("priority", value)} options={options.priorityOptions} />
          </div>
          <SelectField label="Origen" value={form.origin} onChange={(value) => updateField("origin", value)} options={options.originOptions} />
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Categoria" value={form.category} onChange={(value) => updateField("category", value)} options={options.categoryOptions} />
            <SelectField label="Subcategoria" value={form.subcategory} onChange={(value) => updateField("subcategory", value)} options={subcategoryOptions} />
          </div>
        </Section>

        <Section title="Adjuntos">
          {documentItems.length ? (
            <div className="grid gap-3">
              {documentItems.map((document) => (
                <div key={document.id} className="flex min-w-0 items-center gap-3 rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-[var(--border-color)] bg-[var(--bg-app)]">
                    <Icon name={document.iconName} size={14} className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]" title={document.name}>{document.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                      {[document.documentType, document.uploadedAt ? document.uploadedAt.replace("T", " ") : ""].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0 px-3 py-1.5 text-[11px]"
                    onClick={() => onPreviewDocument?.(document)}
                    disabled={!onPreviewDocument || (!document.previewFile && !document.isAvailable)}
                  >
                    <Icon name="regWindowRestore" size={13} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Preview
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Sin adjuntos asociados.</p>
          )}
        </Section>
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-[var(--border-color)] pt-4">
        <Button variant="secondary" disabled={submitting} onClick={onCancel} className="min-w-[7.5rem]">
          Cancelar
        </Button>
        <Button variant="primary" disabled={submitting} onClick={handleSubmit} className="min-w-[9rem]">
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}
