import { useMemo, useRef, useState } from "react";
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
  const updateParameter = (index, field, value) => {
    onChange(parameters.map((parameter, currentIndex) => (
      currentIndex === index ? { ...parameter, [field]: value } : parameter
    )));
  };

  const addParameter = () => {
    onChange([...parameters, createEmptyParameter(parameters.length + 1)]);
  };

  const removeParameter = (index) => {
    onChange(parameters.filter((_, currentIndex) => currentIndex !== index).map((parameter, currentIndex) => ({
      ...parameter,
      order: currentIndex + 1,
    })));
  };

  return (
    <div className="space-y-3">
      {parameters.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-6 text-sm text-[var(--text-secondary)]">
          No hay parametros definidos.
        </div>
      ) : parameters.map((parameter, index) => (
        <div key={`${parameter.name || "param"}-${index}`} className="rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] p-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px]">
            <Field label="Nombre" value={parameter.name || ""} onChange={(event) => updateParameter(index, "name", event.target.value)} />
            <Field label="Etiqueta" value={parameter.label || ""} onChange={(event) => updateParameter(index, "label", event.target.value)} />
            <Field
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
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[120px_160px_minmax(0,1fr)]">
            <Field label="Orden" type="number" value={String(parameter.order || index + 1)} onChange={(event) => updateParameter(index, "order", Number(event.target.value))} />
            <Field
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
              <Field
                label="Valor por defecto"
                value={String(coerceBoolean(parameter.defaultValue))}
                onChange={(event) => updateParameter(index, "defaultValue", event.target.value === "true")}
                options={[
                  { value: "false", label: "No" },
                  { value: "true", label: "Si" },
                ]}
              />
            ) : (
              <Field label="Valor por defecto" value={String(parameter.defaultValue ?? "")} onChange={(event) => updateParameter(index, "defaultValue", event.target.value)} />
            )}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Origen" value={parameter.source || ""} onChange={(event) => updateParameter(index, "source", event.target.value)} />
            <Field label="Placeholder" value={parameter.placeholder || ""} onChange={(event) => updateParameter(index, "placeholder", event.target.value)} />
          </div>
          {parameter.type === "select" ? (
            <div className="mt-3">
              <Field
                label="Opciones separadas por coma"
                value={(parameter.options || []).join(", ")}
                onChange={(event) => updateParameter(index, "options", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
              />
            </div>
          ) : null}
          <div className="mt-3">
            <Field label="Descripcion" rows={2} value={parameter.description || ""} onChange={(event) => updateParameter(index, "description", event.target.value)} />
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="button" size="sm" variant="danger" onClick={() => removeParameter(index)}>
              Eliminar parametro
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" className="w-full" onClick={addParameter}>
        Agregar parametro
      </Button>
    </div>
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

export function EmailReportForm({ initialReport, onCancel, onSubmit }) {
  const logoInputRef = useRef(null);
  const [form, setForm] = useState(() => ({ ...EMPTY_EMAIL_REPORT, ...(initialReport || {}) }));
  const [parameters, setParameters] = useState(() => normalizeParameters(initialReport?.parameters || EMPTY_EMAIL_REPORT.parameters));
  const [contractText, setContractText] = useState("");
  const [contractWorkflowName, setContractWorkflowName] = useState("");
  const [logoPreview, setLogoPreview] = useState(() => initialReport?.logoUrl || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const hasLogoImage = Boolean(logoPreview && logoPreview !== NO_IMAGE_URL);
  const contractWorkflowOptions = useMemo(() => {
    if (!contractText.trim()) return [];
    try {
      return readContractWorkflowEntries(contractText).map(([name]) => name).filter(Boolean);
    } catch {
      return [];
    }
  }, [contractText]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
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

  const importContract = () => {
    try {
      const imported = parseContractParameters(contractText, contractWorkflowName);
      setParameters(normalizeParameters(imported.parameters));
      setForm((current) => ({
        ...current,
        name: current.name || imported.name || current.name,
        httpMethod: imported.httpMethod || current.httpMethod,
        webhookUrl: buildWebhookUrlFromPath(current.webhookUrl, imported.webhookPath),
      }));
      setError("");
    } catch (importError) {
      setError(importError?.message || "No fue posible leer el contrato.");
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-[16px] border border-[rgba(210,138,138,0.35)] bg-[rgba(210,138,138,0.1)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.95fr)_minmax(280px,0.9fr)_minmax(340px,1fr)]">
        <div className="grid h-full content-start gap-4">
          <section className="min-h-[394px] rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
            <p className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Datos del reporte</p>
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
          </section>
        </div>

        <div className="grid content-start gap-4">
          <section className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
            <p className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Webhook</p>
            <div className="grid gap-4">
              <Field label="URL webhook n8n" value={form.webhookUrl || ""} onChange={(e) => updateField("webhookUrl", e.target.value)} />
              <p className="-mt-2 text-xs leading-5 text-[var(--text-muted)]">
                La llamada sale desde el backend. En DEV usa `host.docker.internal:8089` o el DNS del contenedor, no `localhost`.
              </p>
              <div className="max-w-[180px]">
                <Field
                  label="Metodo"
                  value={form.httpMethod || "POST"}
                  onChange={(e) => updateField("httpMethod", e.target.value)}
                  options={[{ value: "POST", label: "POST" }, { value: "GET", label: "GET" }]}
                />
              </div>
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
            <p className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Logo</p>
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
          </section>
        </div>

        <section className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
          <p className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Parametros</p>
          <div className="space-y-4">
            <ParameterDesigner parameters={parameters} onChange={setParameters} />
            <div className="rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] p-3">
              <Field
                label="Importar contrato JSON"
                rows={5}
                value={contractText}
                onChange={(event) => {
                  setContractText(event.target.value);
                  setContractWorkflowName("");
                }}
              />
              {contractWorkflowOptions.length > 1 ? (
                <div className="mt-3">
                  <Field
                    label="Workflow"
                    value={contractWorkflowName || contractWorkflowOptions[0]}
                    onChange={(event) => setContractWorkflowName(event.target.value)}
                    options={contractWorkflowOptions.map((name) => ({ value: name, label: name }))}
                  />
                </div>
              ) : null}
              <div className="mt-3 flex justify-end">
                <Button type="button" size="sm" variant="secondary" onClick={importContract}>
                  Importar campos
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" disabled={saving} onClick={submit}>{saving ? "Guardando..." : "Guardar"}</Button>
      </div>
    </div>
  );
}
