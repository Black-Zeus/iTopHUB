import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { CollapseToggleButton } from "../../components/ui/general/CollapseToggleButton";
import ModalManager from "../../components/ui/modal";
import { Button } from "../../ui";

export const EMPTY_EMAIL_REPORT = {
  reportCode: "",
  name: "",
  description: "",
  webhookUrl: "",
  httpMethod: "POST",
  status: "active",
  displayOrder: 100,
  iconName: "mail",
  logoUrl: "",
  logoUpload: "",
  logoRemoved: false,
  parameters: [
    { name: "email_to", label: "Correo destinatario", type: "email", required: true, source: "user.email", order: 1 },
  ],
};

const PUBLIC_BASE_URL = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const NO_IMAGE_URL = `${PUBLIC_BASE_URL}noimage.png`;

function handleNoImageFallback(event) {
  if (event.currentTarget.dataset.fallbackApplied === "true") return;
  event.currentTarget.dataset.fallbackApplied = "true";
  event.currentTarget.src = NO_IMAGE_URL;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error(`No fue posible leer el archivo ${file?.name || "seleccionado"}.`));
    reader.readAsDataURL(file);
  });
}

function createEmptyParameter(order) {
  return {
    name: "",
    label: "",
    type: "text",
    required: false,
    source: "",
    placeholder: "",
    defaultValue: "",
    description: "",
    order,
    options: [],
  };
}

function coerceBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "si", "s"].includes(normalized)) return true;
  if (["false", "0", "no", "n", ""].includes(normalized)) return false;
  return defaultValue;
}

function inferParameterType(name, type) {
  const normalizedType = type === "string" ? "text" : type || "text";
  const normalizedName = String(name || "").toLowerCase();
  if (normalizedType === "text" && (normalizedName.endsWith("_date") || normalizedName === "start_date" || normalizedName === "end_date")) {
    return "date";
  }
  return normalizedType;
}

function normalizeParameter(parameter, index) {
  const type = inferParameterType(parameter?.name, parameter?.type);
  const defaultValue = parameter?.defaultValue ?? parameter?.default_value ?? "";
  return {
    ...createEmptyParameter(index + 1),
    ...(parameter || {}),
    type,
    defaultValue: type === "boolean" ? coerceBoolean(defaultValue) : defaultValue,
    description: parameter?.description || "",
    options: Array.isArray(parameter?.options) ? parameter.options : [],
    order: Number(parameter?.order || index + 1),
  };
}

function normalizeParameters(parameters) {
  return (Array.isArray(parameters) ? parameters : [])
    .map(normalizeParameter)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

function readParameters(parameters) {
  return normalizeParameters(parameters)
    .filter((parameter) => String(parameter.name || "").trim())
    .map((parameter, index) => ({
      ...parameter,
      name: String(parameter.name || "").trim(),
      label: String(parameter.label || parameter.name || "").trim(),
      order: Number(parameter.order || index + 1),
      options: Array.isArray(parameter.options) ? parameter.options.filter(Boolean) : [],
    }));
}

function readContractWorkflowEntries(text) {
  const parsed = JSON.parse(text || "{}");
  return parsed?.workflows && typeof parsed.workflows === "object"
    ? Object.entries(parsed.workflows)
    : [["", parsed]];
}

function buildWebhookUrlFromPath(currentUrl, webhookPath) {
  const path = String(webhookPath || "").trim().replace(/^\/+/, "");
  if (!path) return currentUrl;
  const url = String(currentUrl || "").trim();
  if (!url) return currentUrl;
  if (url.includes("/webhook-test/")) return url.replace(/\/webhook-test\/.*/, `/webhook-test/${path}`);
  if (url.includes("/webhook/")) return url.replace(/\/webhook\/.*/, `/webhook/${path}`);
  return url.endsWith("/") ? `${url}${path}` : `${url}/${path}`;
}

function parseContractParameters(text, selectedWorkflowName = "") {
  const workflowEntries = readContractWorkflowEntries(text);
  const selectedEntry = selectedWorkflowName
    ? workflowEntries.find(([name]) => name === selectedWorkflowName)
    : null;
  const [workflowName, workflow] = selectedEntry || workflowEntries[0] || ["", {}];
  const allowedBody = workflow?.allowed_body_json;
  if (!allowedBody || typeof allowedBody !== "object") {
    throw new Error("El contrato no contiene allowed_body_json.");
  }
  const parameters = Object.entries(allowedBody).map(([name, definition], index) => {
    const type = inferParameterType(name, definition?.type);
    const isEmailTo = name === "email_to";
    return {
      name,
      label: name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      type,
      required: definition?.required ?? false,
      source: isEmailTo ? "user.email" : "",
      placeholder: "",
      defaultValue: type === "boolean" ? coerceBoolean(definition?.default_value) : definition?.default_value ?? "",
      description: definition?.description || "",
      order: index + 1,
      options: Array.isArray(definition?.options) ? definition.options : [],
    };
  });
  return {
    name: workflowName,
    webhookPath: workflow?.webhook_path || "",
    httpMethod: workflow?.method || "POST",
    parameters,
  };
}

function ParameterDesigner({ parameters, onChange }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const updateParameter = (index, field, value) => {
    onChange(parameters.map((parameter, currentIndex) => (
      currentIndex === index ? { ...parameter, [field]: value } : parameter
    )));
  };

  const addParameter = () => {
    onChange([...parameters, createEmptyParameter(parameters.length + 1)]);
    setExpandedIndex(parameters.length);
  };

  const removeParameter = (index) => {
    onChange(parameters.filter((_, currentIndex) => currentIndex !== index).map((parameter, currentIndex) => ({
      ...parameter,
      order: currentIndex + 1,
    })));
    setExpandedIndex(null);
  };

  const confirmRemoveParameter = async (index) => {
    const parameter = parameters[index];
    const confirmed = await ModalManager.confirm({
      title: "Eliminar parametro",
      message: `Se eliminara ${parameter?.label || parameter?.name || "este parametro"}.`,
      content: "Confirma para quitar este campo del reporte por correo.",
      buttons: { cancel: "Cancelar", confirm: "Eliminar" },
    });
    if (confirmed) {
      removeParameter(index);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-color)] px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Campos del webhook</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{parameters.length} parametro(s) configurado(s)</p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={addParameter}>
          Agregar
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 pr-4">
        {parameters.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-6 text-sm text-[var(--text-secondary)]">
            No hay parametros definidos.
          </div>
        ) : parameters.map((parameter, index) => {
          const isExpanded = expandedIndex === index;
          const requiredLabel = parameter.required === "conditional" ? "Condicional" : parameter.required ? "Obligatorio" : "Opcional";
          return (
            <div key={`${parameter.name || "param"}-${index}`} className="overflow-hidden rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-panel)]">
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-[var(--bg-hover)]"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-app)] text-xs font-semibold text-[var(--text-secondary)]">
                  {parameter.order || index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{parameter.label || parameter.name || "Parametro sin etiqueta"}</span>
                  <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{parameter.name || "sin_nombre"} · {parameter.type || "text"} · {requiredLabel}</span>
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    confirmRemoveParameter(index);
                  }}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[rgba(210,138,138,0.42)] bg-[rgba(210,138,138,0.08)] text-[var(--danger)] shadow-[var(--shadow-subtle)] transition hover:bg-[rgba(210,138,138,0.16)]"
                  title="Eliminar parametro"
                  aria-label="Eliminar parametro"
                >
                  <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
                <span onClick={(event) => event.stopPropagation()}>
                  <CollapseToggleButton
                    isCollapsed={!isExpanded}
                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                    collapsedLabel={`Expandir ${parameter.label || parameter.name || "parametro"}`}
                    expandedLabel={`Colapsar ${parameter.label || parameter.name || "parametro"}`}
                  />
                </span>
              </button>

              {isExpanded ? (
                <div className="border-t border-[var(--border-color)] p-3">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <CompactField label="Orden" type="number" value={String(parameter.order || index + 1)} onChange={(event) => updateParameter(index, "order", Number(event.target.value))} />
                    <CompactField label="Nombre" value={parameter.name || ""} onChange={(event) => updateParameter(index, "name", event.target.value)} />
                    <CompactField label="Etiqueta" value={parameter.label || ""} onChange={(event) => updateParameter(index, "label", event.target.value)} />
                    <CompactField
                      label="Tipo"
                      value={parameter.type || "text"}
                      onChange={(event) => updateParameter(index, "type", event.target.value)}
                      options={[
                        { value: "text", label: "Texto" },
                        { value: "email", label: "Email" },
                        { value: "date", label: "Fecha" },
                        { value: "number", label: "Numero" },
                        { value: "boolean", label: "Si / No" },
                        { value: "select", label: "Lista" },
                      ]}
                    />
                    <CompactField
                      label="Requerido"
                      value={String(parameter.required ?? false)}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateParameter(index, "required", value === "conditional" ? "conditional" : value === "true");
                      }}
                      options={[
                        { value: "false", label: "No" },
                        { value: "true", label: "Si" },
                        { value: "conditional", label: "Condicional" },
                      ]}
                    />
                    {parameter.type === "boolean" ? (
                      <CompactField
                        label="Valor por defecto"
                        value={String(coerceBoolean(parameter.defaultValue))}
                        onChange={(event) => updateParameter(index, "defaultValue", event.target.value === "true")}
                        options={[
                          { value: "false", label: "No" },
                          { value: "true", label: "Si" },
                        ]}
                      />
                    ) : (
                      <CompactField label="Valor por defecto" value={String(parameter.defaultValue ?? "")} onChange={(event) => updateParameter(index, "defaultValue", event.target.value)} />
                    )}
                <CompactField label="Origen" value={parameter.source || ""} onChange={(event) => updateParameter(index, "source", event.target.value)} />
                <CompactField label="Placeholder" value={parameter.placeholder || ""} onChange={(event) => updateParameter(index, "placeholder", event.target.value)} />
                {parameter.type === "select" ? (
                  <div className="md:col-span-2 xl:col-span-4">
                    <CompactField
                      label="Opciones separadas por coma"
                      value={(parameter.options || []).join(", ")}
                      onChange={(event) => updateParameter(index, "options", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
                    />
                  </div>
                ) : null}
                <div className="md:col-span-2 xl:col-span-4">
                  <CompactField label="Descripcion" rows={2} value={parameter.description || ""} onChange={(event) => updateParameter(index, "description", event.target.value)} />
                </div>
                  </div>
                </div>
              ) : null}
              </div>
          );
        })}
      </div>
    </div>
  );
}

function CompactField({ label, value, onChange, type = "text", rows = 0, options = null }) {
  const className = "w-full min-w-0 rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-2.5 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-strong)]";
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block truncate text-[0.68rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">{label}</span>
      {options ? (
        <select value={value} onChange={onChange} className={className}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : rows ? (
        <textarea rows={rows} value={value} onChange={onChange} className={`${className} resize-y`} />
      ) : (
        <input type={type} value={value} onChange={onChange} className={className} />
      )}
    </label>
  );
}

function Field({ label, value, onChange, type = "text", rows = 0, options = null }) {
  const className = "w-full rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-strong)]";
  return (
    <label className={rows ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">{label}</span>
      {options ? (
        <select value={value} onChange={onChange} className={className}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : rows ? (
        <textarea rows={rows} value={value} onChange={onChange} className={className} />
      ) : (
        <input type={type} value={value} onChange={onChange} className={className} />
      )}
    </label>
  );
}

function CollapsibleFormSection({ title, helper, isCollapsed, onToggle, children }) {
  return (
    <section className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
          {helper ? <p className="mt-1 text-xs text-[var(--text-muted)]">{helper}</p> : null}
        </div>
        <CollapseToggleButton
          isCollapsed={isCollapsed}
          onClick={onToggle}
          collapsedLabel={`Expandir ${title}`}
          expandedLabel={`Colapsar ${title}`}
        />
      </div>
      <div
        className={`grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-out ${isCollapsed ? "overflow-hidden" : "overflow-visible"}`}
        style={{
          gridTemplateRows: isCollapsed ? "0fr" : "1fr",
          opacity: isCollapsed ? 0 : 1,
          marginTop: isCollapsed ? 0 : 16,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </section>
  );
}

export function EmailReportForm({ initialReport, onCancel, onSubmit }) {
  const logoInputRef = useRef(null);
  const [form, setForm] = useState(() => ({ ...EMPTY_EMAIL_REPORT, ...(initialReport || {}) }));
  const [parameters, setParameters] = useState(() => normalizeParameters(initialReport?.parameters || EMPTY_EMAIL_REPORT.parameters));
  const [collapsedSections, setCollapsedSections] = useState({ details: false, webhook: false, logo: false });
  const [logoPreview, setLogoPreview] = useState(() => initialReport?.logoUrl || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const hasLogoImage = Boolean(logoPreview && logoPreview !== NO_IMAGE_URL);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleSection = (section) => {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      await onSubmit({ ...form, parameters: readParameters(parameters) });
    } catch (submitError) {
      setError(submitError?.message || "No fue posible guardar el reporte.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen valida para el logo.");
      return;
    }
    setError("");
    const dataUrl = await readFileAsDataUrl(file);
    setLogoPreview(dataUrl);
    setForm((current) => ({
      ...current,
      logoUpload: dataUrl,
      logoRemoved: false,
    }));
  };

  const selectLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    await handleLogoFile(file);
  };

  const dropLogo = async (event) => {
    event.preventDefault();
    await handleLogoFile(event.dataTransfer.files?.[0]);
  };

  const openLogoPicker = () => {
    logoInputRef.current?.click();
  };

  const removeLogo = () => {
    setLogoPreview("");
    setForm((current) => ({
      ...current,
      logoUrl: "",
      logoUpload: "",
      logoRemoved: true,
    }));
  };

  return (
    <div className="flex h-[calc(90vh-140px)] max-h-[calc(90vh-140px)] flex-col space-y-4 overflow-hidden">
      {error ? (
        <div className="rounded-[16px] border border-[rgba(210,138,138,0.35)] bg-[rgba(210,138,138,0.1)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
      <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(260px,0.68fr)_minmax(0,1.32fr)]">
        <div className="h-full min-h-0 space-y-4 overflow-y-auto pr-1">
          <CollapsibleFormSection
            title="Datos del reporte"
            helper="Identidad y descripcion visible del reporte."
            isCollapsed={collapsedSections.details}
            onToggle={() => toggleSection("details")}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Nombre" value={form.name || ""} onChange={(e) => updateField("name", e.target.value)} />
              </div>
              <Field
                label="Estado"
                value={form.status || "active"}
                onChange={(e) => updateField("status", e.target.value)}
                options={[{ value: "active", label: "Activo" }, { value: "inactive", label: "Inactivo" }]}
              />
              <Field label="Orden" type="number" value={String(form.displayOrder ?? 100)} onChange={(e) => updateField("displayOrder", Number(e.target.value))} />
              <Field label="Descripcion" rows={7} value={form.description || ""} onChange={(e) => updateField("description", e.target.value)} />
            </div>
          </CollapsibleFormSection>

          <CollapsibleFormSection
            title="Webhook"
            helper="Destino n8n llamado por el backend."
            isCollapsed={collapsedSections.webhook}
            onToggle={() => toggleSection("webhook")}
          >
            <div className="grid gap-4">
              <Field label="URL webhook n8n" value={form.webhookUrl || ""} onChange={(e) => updateField("webhookUrl", e.target.value)} />
              <div className="max-w-[180px]">
                <Field
                  label="Metodo"
                  value={form.httpMethod || "POST"}
                  onChange={(e) => updateField("httpMethod", e.target.value)}
                  options={[{ value: "POST", label: "POST" }, { value: "GET", label: "GET" }]}
                />
              </div>
            </div>
          </CollapsibleFormSection>

          <CollapsibleFormSection
            title="Logo"
            helper="Imagen asociada a la tarjeta del reporte."
            isCollapsed={collapsedSections.logo}
            onToggle={() => toggleSection("logo")}
          >
            <div
              className="relative flex min-h-[132px] cursor-pointer items-center justify-center rounded-[14px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] p-4 transition hover:border-[var(--accent-strong)] hover:bg-[var(--bg-hover)]"
              role="button"
              tabIndex={0}
              onClick={openLogoPicker}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openLogoPicker();
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={dropLogo}
            >
              <input ref={logoInputRef} type="file" accept="image/*" onChange={selectLogo} className="hidden" />
              {hasLogoImage ? (
                <button
                  type="button"
                  className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(210,138,138,0.35)] bg-[rgba(210,138,138,0.14)] text-sm font-semibold leading-none text-[var(--danger)] transition hover:bg-[rgba(210,138,138,0.22)]"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeLogo();
                  }}
                  aria-label="Quitar logo"
                >
                  &times;
                </button>
              ) : null}
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-panel)] text-xs font-semibold text-[var(--text-muted)]">
                <img src={logoPreview || NO_IMAGE_URL} onError={handleNoImageFallback} alt="" className="h-full w-full object-contain p-2" />
              </div>
            </div>
          </CollapsibleFormSection>
        </div>

        <section className="flex h-full min-h-0 flex-col rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
          <p className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Parametros</p>
          <ParameterDesigner parameters={parameters} onChange={setParameters} />
        </section>
      </div>
      </div>
      <div className="flex shrink-0 justify-end gap-3 border-t border-[var(--border-color)] pt-4">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" disabled={saving} onClick={submit}>{saving ? "Guardando..." : "Guardar"}</Button>
      </div>
    </div>
  );
}
