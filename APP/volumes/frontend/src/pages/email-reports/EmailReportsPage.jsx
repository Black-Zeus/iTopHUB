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
  return source === "user.email" || ["email", "mail", "correo", "user_email", "email_to"].includes(String(name || "").toLowerCase());
}

function isEmailCcParameter(parameter) {
  const name = String(parameter.name || "").toLowerCase();
  const source = String(parameter.source || "").toLowerCase();
  return source === "user.email_cc" || ["email_cc", "cc", "copy", "copia"].includes(name);
}

function isEmailBccParameter(parameter) {
  const name = String(parameter.name || "").toLowerCase();
  const source = String(parameter.source || "").toLowerCase();
  return source === "user.email_bcc" || ["email_bcc", "bcc", "blind_copy", "copia_oculta"].includes(name);
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

function coerceBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "si", "s"].includes(normalized)) return true;
  if (["false", "0", "no", "n", ""].includes(normalized)) return false;
  return defaultValue;
}

function isDateLikeParameter(parameter) {
  const name = String(parameter?.name || "").toLowerCase();
  const label = String(parameter?.label || "").toLowerCase();
  return parameter?.type === "date" || name.endsWith("_date") || name === "start_date" || name === "end_date" || label.includes("fecha");
}

function toDateTimeLocalValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(" ", "T").slice(0, 16);
}

function fromDateTimeLocalValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw.replace("T", " ");
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}

function serializeSubmittedValues(values, parameters) {
  return Object.entries(values || {}).reduce((result, [name, value]) => {
    const parameter = parameters.find((item) => item.name === name);
    result[name] = isDateLikeParameter(parameter) ? fromDateTimeLocalValue(value) : value;
    return result;
  }, {});
}

function getTriggerErrorMessage(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || "").trim();

  if (status === 400 || status === 422) {
    return message || "La solicitud contiene datos incompletos o invalidos. Revise los campos e intente nuevamente.";
  }

  if (status === 401 || status === 403) {
    return "Su sesion no tiene permisos suficientes para solicitar este reporte. Vuelva a ingresar o contacte al administrador.";
  }

  if (status === 409) {
    return message || "El reporte ya fue solicitado recientemente. Espere unos minutos e intente nuevamente.";
  }

  if (status === 504) {
    return "El servicio de automatizacion no respondio a tiempo. Contacte al administrador de la plataforma si el problema persiste.";
  }

  if (status >= 500 || status === 0) {
    return "Ocurrio un problema al solicitar el reporte. La automatizacion de correo no pudo procesar la solicitud en este momento. Contacte al administrador de la plataforma.";
  }

  return message || "No fue posible solicitar el reporte. Intente nuevamente o contacte al administrador de la plataforma.";
}

function showTriggerErrorModal(error, report) {
  const status = Number(error?.status || 0);
  const reportName = report?.name || "el reporte";
  const technicalCode = status ? `HTTP ${status}` : "sin respuesta";

  ModalManager.error({
    title: "No fue posible solicitar el reporte",
    message: `Ocurrio un problema al solicitar "${reportName}". La automatizacion de correo no pudo procesar la solicitud en este momento. Contacte al administrador de la plataforma para revisar la integracion.`,
    details: `Codigo tecnico: ${technicalCode}`,
  });
}

function getParameterGroup(parameter) {
  if (isDateLikeParameter(parameter)) return "dates";
  if (parameter?.type === "boolean") return "checks";
  if (parameter?.type === "email") return "mail";
  if (parameter?.type === "number" || parameter?.type === "select") return "filters";
  return "fields";
}

function groupVisibleParameters(parameters) {
  const groups = [
    { id: "mail", label: "Correos", items: [] },
    { id: "dates", label: "Fechas", items: [] },
    { id: "filters", label: "Filtros", items: [] },
    { id: "fields", label: "Parametros", items: [] },
    { id: "checks", label: "Opciones", items: [] },
  ];
  const byId = new Map(groups.map((group) => [group.id, group]));
  parameters.forEach((parameter) => {
    const group = byId.get(getParameterGroup(parameter)) || byId.get("fields");
    group.items.push(parameter);
  });
  return groups.filter((group) => group.items.length > 0);
}

function chunkParameters(items) {
  const chunks = [];
  for (let index = 0; index < items.length; index += 4) {
    chunks.push(items.slice(index, index + 4));
  }
  return chunks;
}

function getParameterRowClassName(count) {
  if (count === 1 || count === 2) return "grid gap-3 md:grid-cols-4";
  if (count === 3) return "grid gap-3 md:grid-cols-3";
  return "grid gap-3 md:grid-cols-2 2xl:grid-cols-4";
}

function getParameterCellClassName(count) {
  if (count === 1) return "md:col-span-4";
  if (count === 2) return "md:col-span-2";
  return "";
}

function ParameterInput({ parameter, value, onChange }) {
  const name = parameter.name;
  const requiredLabel = parameter.required === true ? " *" : "";
  if (isDateLikeParameter(parameter)) {
    return <Field label={`${parameter.label || name}${requiredLabel}`} type="datetime-local" value={toDateTimeLocalValue(value)} onChange={(e) => onChange(name, e.target.value)} />;
  }
  if (parameter.type === "number") {
    return <Field label={`${parameter.label || name}${requiredLabel}`} type="number" value={value ?? ""} onChange={(e) => onChange(name, e.target.value)} />;
  }
  if (parameter.type === "boolean") {
    return (
      <label className="flex min-h-[50px] items-center gap-3 rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2">
        <input
          type="checkbox"
          checked={coerceBoolean(value)}
          onChange={(e) => onChange(name, e.target.checked)}
          className="h-4 w-4 accent-[var(--accent-strong)]"
        />
        <span className="text-xs font-semibold leading-5 text-[var(--text-secondary)]">{parameter.label || name}</span>
      </label>
    );
  }
  if (parameter.type === "select") {
    const options = Array.isArray(parameter.options) ? parameter.options : [];
    return (
      <Field
        label={`${parameter.label || name}${requiredLabel}`}
        value={value || ""}
        onChange={(e) => onChange(name, e.target.value)}
        options={[{ value: "", label: "Selecciona" }, ...options.map((option) => (
          typeof option === "string" ? { value: option, label: option } : { value: String(option.value || ""), label: String(option.label || option.value || "") }
        ))]}
      />
    );
  }
  return <Field label={`${parameter.label || name}${requiredLabel}`} value={value || ""} onChange={(e) => onChange(name, e.target.value)} />;
}

function buildInitialValues(parameters) {
  return parameters.reduce((result, parameter) => {
    if (!isUserEmailParameter(parameter) && !isEmailCcParameter(parameter) && !isEmailBccParameter(parameter)) {
      const defaultValue = parameter.defaultValue ?? "";
      if (defaultValue !== "") {
        result[parameter.name] = parameter.type === "boolean" ? coerceBoolean(defaultValue) : defaultValue;
      }
    }
    return result;
  }, {});
}

function TriggerReportModal({ report, user, onCancel, onSubmitted, onSubmitError }) {
  const parameters = Array.isArray(report.parameters) ? report.parameters : [];
  const emailCcParameter = parameters.find(isEmailCcParameter);
  const [values, setValues] = useState(() => buildInitialValues(parameters));
  const [ccValue, setCcValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const visibleParameters = parameters.filter((parameter) => !isUserEmailParameter(parameter) && !isEmailCcParameter(parameter) && !isEmailBccParameter(parameter));
  const parameterGroups = groupVisibleParameters(visibleParameters);
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
        ...serializeSubmittedValues(values, visibleParameters),
        ...(isAdmin && emailCcParameter && cc.emails.length > 0 ? { [emailCcParameter.name]: cc.emails.join(",") } : {}),
      });
    } catch (submitError) {
      const friendlyMessage = getTriggerErrorMessage(submitError);
      setError(friendlyMessage);
      if (submitError?.status || submitError?.code) {
        onSubmitError?.(submitError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 items-stretch gap-4 overflow-hidden xl:grid-cols-[minmax(240px,0.5fr)_minmax(0,1.5fr)]">
          <div className="flex min-h-[260px] flex-col justify-center rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4 text-center xl:h-full">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:text-left">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--accent-strong)]">
                <img src={report.logoUrl || NO_IMAGE_URL} onError={handleNoImageFallback} alt="" className="h-full w-full object-contain p-2" />
              </span>
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Reporte por correo</p>
                <h3 className="mt-1 text-base font-semibold leading-6 text-[var(--text-primary)]">{report.name}</h3>
              </div>
            </div>
            <p className="mt-4 max-h-[220px] overflow-y-auto text-sm leading-6 text-[var(--text-secondary)]">{report.description || "Sin descripcion."}</p>
          </div>

          <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
            {error ? (
              <div className="rounded-[14px] border border-[rgba(210,138,138,0.35)] bg-[rgba(210,138,138,0.1)] px-4 py-3 text-sm text-[var(--danger)]">
                {error}
              </div>
            ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className={isAdmin && emailCcParameter ? "md:col-span-1 xl:col-span-2" : "md:col-span-2 xl:col-span-4"}>
              <span className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">Correo destinatario</span>
              <div className="rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)]">
                {user?.email || "Sin correo en perfil"}
              </div>
            </div>

            {isAdmin && emailCcParameter ? (
              <label className="md:col-span-1 xl:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">{emailCcParameter.label || "Copia (CC)"}</span>
                <input
                  value={ccValue}
                  onChange={(event) => setCcValue(event.target.value)}
                  placeholder="correo1@dominio.cl, correo2@dominio.cl"
                  className="w-full rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-strong)]"
                />
              </label>
            ) : null}

            {visibleParameters.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-6 text-sm text-[var(--text-secondary)] md:col-span-2 xl:col-span-4">
                Este reporte no requiere parametros adicionales.
              </div>
            ) : (
              <div className="space-y-3 md:col-span-2 xl:col-span-4">
                {parameterGroups.map((group) => (
                  <section key={group.id} className="rounded-[14px] border border-[var(--border-color)] bg-[rgba(127,151,171,0.06)] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{group.label}</p>
                      <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--text-muted)]">
                        {group.items.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {chunkParameters(group.items).map((rowItems, rowIndex) => (
                        <div key={`${group.id}-${rowIndex}`} className={getParameterRowClassName(rowItems.length)}>
                          {rowItems.map((parameter) => (
                            <div key={parameter.name} className={getParameterCellClassName(rowItems.length)}>
                              <ParameterInput
                                parameter={parameter}
                                value={values[parameter.name]}
                                onChange={updateValue}
                              />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex shrink-0 justify-end gap-3 border-t border-[var(--border-color)] pt-4">
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
      size: "emailReportForm",
      showFooter: false,
      content: (
        <TriggerReportModal
          report={report}
          user={user}
          onCancel={() => ModalManager.close(modalId)}
          onSubmitted={submit}
          onSubmitError={(submitError) => showTriggerErrorModal(submitError, report)}
        />
      ),
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
