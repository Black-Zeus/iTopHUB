import { useRef, useState } from "react";
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
    { name: "email", label: "Correo destinatario", type: "email", required: true, source: "user.email", order: 1 },
  ],
};

const PUBLIC_BASE_URL = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const NO_IMAGE_URL = `${PUBLIC_BASE_URL}noimage.png`;

function handleNoImageFallback(event) {
  if (event.currentTarget.dataset.fallbackApplied === "true") return;
  event.currentTarget.dataset.fallbackApplied = "true";
  event.currentTarget.src = NO_IMAGE_URL;
}

function normalizeParametersText(parameters) {
  return JSON.stringify(parameters || [], null, 2);
}

function readParametersText(text) {
  const parsed = JSON.parse(text || "[]");
  if (!Array.isArray(parsed)) {
    throw new Error("Los parametros deben ser una lista JSON.");
  }
  return parsed;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error(`No fue posible leer el archivo ${file?.name || "seleccionado"}.`));
    reader.readAsDataURL(file);
  });
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
  const [parametersText, setParametersText] = useState(() => normalizeParametersText(initialReport?.parameters || EMPTY_EMAIL_REPORT.parameters));
  const [logoPreview, setLogoPreview] = useState(() => initialReport?.logoUrl || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const hasLogoImage = Boolean(logoPreview && logoPreview !== NO_IMAGE_URL);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      await onSubmit({ ...form, parameters: readParametersText(parametersText) });
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
          <Field label="Parametros JSON" rows={15} value={parametersText} onChange={(e) => setParametersText(e.target.value)} />
        </section>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" disabled={saving} onClick={submit}>{saving ? "Guardando..." : "Guardar"}</Button>
      </div>
    </div>
  );
}
