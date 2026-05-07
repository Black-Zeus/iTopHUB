import { useContext, useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { AuthContext } from "@/App";
import ModalManager from "../../components/ui/modal";
import { Panel, PanelHeader } from "../../components/ui/general/Panel";
import { SearchFilterInput } from "../../components/ui/general/SearchFilterInput";
import { Spinner } from "../../ui/Spinner";
import { Button, useToast } from "../../ui";
import {
  getEmailReports,
  triggerEmailReport,
} from "../../services/email-reports-service";

const PUBLIC_BASE_URL = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const NO_IMAGE_URL = `${PUBLIC_BASE_URL}noimage.png`;

function handleNoImageFallback(event) {
  if (event.currentTarget.dataset.fallbackApplied === "true") return;
  event.currentTarget.dataset.fallbackApplied = "true";
  event.currentTarget.src = NO_IMAGE_URL;
}

function Field({ label, value, onChange, type = "text", rows = 0, options = null, readOnly = false }) {
  const className = "w-full rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-strong)]";
  return (
    <label className={rows ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">{label}</span>
      {options ? (
        <select value={value} onChange={onChange} className={className}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : rows ? (
        <textarea rows={rows} value={value} onChange={onChange} readOnly={readOnly} className={className} />
      ) : (
        <input type={type} value={value} onChange={onChange} readOnly={readOnly} className={className} />
      )}
    </label>
  );
}

function isUserEmailParameter(parameter) {
  const name = parameter.name;
  const source = String(parameter.source || "").toLowerCase();
  return source === "user.email" || ["email", "mail", "correo", "user_email"].includes(String(name || "").toLowerCase());
}

function normalizeEmailList(value) {
  return String(value || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function validateEmailList(value) {
  const emails = normalizeEmailList(value);
  const emailPattern = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
  const invalid = emails.filter((email) => !emailPattern.test(email));
  return { emails, invalid };
}

function ParameterInput({ parameter, value, onChange }) {
  const name = parameter.name;
  if (parameter.type === "date") {
    return <Field label={parameter.label || name} type="date" value={value || ""} onChange={(e) => onChange(name, e.target.value)} />;
  }
  if (parameter.type === "number") {
    return <Field label={parameter.label || name} type="number" value={value || ""} onChange={(e) => onChange(name, e.target.value)} />;
  }
  if (parameter.type === "boolean") {
    return (
      <label className="flex min-h-[78px] items-center gap-3 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(name, e.target.checked)}
          className="h-4 w-4 accent-[var(--accent-strong)]"
        />
        <span className="text-sm font-semibold text-[var(--text-secondary)]">{parameter.label || name}</span>
      </label>
    );
  }
  if (parameter.type === "select") {
    const options = Array.isArray(parameter.options) ? parameter.options : [];
    return (
      <Field
        label={parameter.label || name}
        value={value || ""}
        onChange={(e) => onChange(name, e.target.value)}
        options={[{ value: "", label: "Selecciona" }, ...options.map((option) => (
          typeof option === "string" ? { value: option, label: option } : { value: String(option.value || ""), label: String(option.label || option.value || "") }
        ))]}
      />
    );
  }
  return <Field label={parameter.label || name} value={value || ""} onChange={(e) => onChange(name, e.target.value)} />;
}

function TriggerReportModal({ report, user, onCancel, onSubmitted }) {
  const [values, setValues] = useState({});
  const [ccValue, setCcValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const parameters = Array.isArray(report.parameters) ? report.parameters : [];
  const visibleParameters = parameters.filter((parameter) => !isUserEmailParameter(parameter));
  const isAdmin = Boolean(user?.isAdmin);

  const updateValue = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const cc = validateEmailList(ccValue);
      if (isAdmin && cc.invalid.length > 0) {
        throw new Error(`Revisa los correos en copia: ${cc.invalid.join(", ")}`);
      }
      await onSubmitted({
        ...values,
        ...(isAdmin && cc.emails.length > 0 ? { cc: cc.emails.join(",") } : {}),
      });
    } catch (submitError) {
      setError(submitError?.message || "No fue posible solicitar el reporte.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[250px] flex-col">
      <div className="grid flex-1 items-stretch gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex h-full min-h-[190px] flex-col justify-center rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5 text-center">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:text-left">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--accent-strong)]">
              <img src={report.logoUrl || NO_IMAGE_URL} onError={handleNoImageFallback} alt="" className="h-full w-full object-contain p-2" />
            </span>
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Reporte por correo</p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{report.name}</h3>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{report.description || "Sin descripcion."}</p>
        </div>

        <div className="space-y-4">
          {error ? (
            <div className="rounded-[16px] border border-[rgba(210,138,138,0.35)] bg-[rgba(210,138,138,0.1)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">Correo destinatario</span>
              <div className="rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
                {user?.email || "Sin correo en perfil"}
              </div>
            </div>

            {isAdmin ? (
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">Copia (CC)</span>
                <input
                  value={ccValue}
                  onChange={(event) => setCcValue(event.target.value)}
                  placeholder="correo1@dominio.cl, correo2@dominio.cl"
                  className="w-full rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-strong)]"
                />
              </label>
            ) : null}

            {visibleParameters.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-6 text-sm text-[var(--text-secondary)] md:col-span-2">
                Este reporte no requiere parametros adicionales.
              </div>
            ) : visibleParameters.map((parameter) => (
              <ParameterInput
                key={parameter.name}
                parameter={parameter}
                value={values[parameter.name]}
                onChange={updateValue}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" disabled={submitting || !user?.email} onClick={submit}>
          <Send className="h-4 w-4" />
          {submitting ? "Enviando..." : "Solicitar reporte"}
        </Button>
      </div>
    </div>
  );
}

function ReportCard({ report, onTrigger }) {
  return (
    <article className="flex min-h-[230px] flex-col rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-panel-muted)] p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--accent-strong)]">
          <img src={report.logoUrl || NO_IMAGE_URL} onError={handleNoImageFallback} alt="" className="h-full w-full object-contain p-2" />
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${report.status === "active" ? "bg-[rgba(127,191,156,0.16)] text-[var(--success)]" : "bg-[rgba(127,151,171,0.16)] text-[var(--text-muted)]"}`}>
          {report.status === "active" ? "Activo" : "Inactivo"}
        </span>
      </div>
      <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">{report.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-[var(--text-secondary)]">{report.description || "Sin descripcion."}</p>
      <div className="mt-5 flex justify-center">
        <Button size="sm" variant="primary" className="w-4/5" disabled={report.status !== "active"} onClick={() => onTrigger(report)}>
          <Send className="h-4 w-4" />
          Solicitar
        </Button>
      </div>
    </article>
  );
}

export function EmailReportsPage() {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await getEmailReports(false));
    } catch (loadError) {
      setError(loadError?.message || "No fue posible cargar los reportes por correo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      `${item.name} ${item.description} ${item.reportCode}`.toLowerCase().includes(normalized)
    );
  }, [items, query]);

  const openTriggerModal = (report) => {
    let modalId = null;
    const submit = async (parameters) => {
      const result = await triggerEmailReport(report.id, parameters);
      ModalManager.close(modalId);
      toast.add({
        tone: "success",
        title: "Reporte solicitado",
        description: result?.message || "n8n recibio la solicitud.",
      });
    };
    modalId = ModalManager.custom({
      title: "Solicitar reporte",
      size: "xlarge",
      showFooter: false,
      content: <TriggerReportModal report={report} user={user} onCancel={() => ModalManager.close(modalId)} onSubmitted={submit} />,
    });
  };

  return (
    <div className="grid gap-5">
      <Panel wide className="grid gap-5">
        <PanelHeader
          eyebrow="n8n"
          title="Reportes por correo"
        />
        <SearchFilterInput value={query} placeholder="Buscar reporte por nombre, codigo o descripcion..." onChange={(e) => setQuery(e.target.value)} />

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : error ? (
          <div className="rounded-[18px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-8 text-sm text-[var(--danger)]">{error}</div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-8 text-center text-sm text-[var(--text-muted)]">
            No hay reportes por correo para mostrar.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onTrigger={openTriggerModal}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
