import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { isPdqModuleEnabled, setPdqModuleEnabled } from "../../services/module-visibility-service";
import { getPdqStatus } from "../../services/pdq-service";

const SETTINGS_TABS = [
  { id: "itop", label: "Integracion iTop" },
  { id: "pdq", label: "PDQ" },
  { id: "sync", label: "Sincronizacion" },
  { id: "mail", label: "Correo" },
  { id: "docs", label: "Documentos" },
  { id: "cmdb", label: "CMDB" },
];

function formatDate(value) {
  if (!value) {
    return "N/D";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBoolean(value) {
  return value ? "Si" : "No";
}

function getPdqDatabaseReferenceDate(status) {
  return status?.selected_file?.observed_at || status?.selected_file?.created_at || status?.selected_file?.modified_at || "";
}

function StatusPill({ tone = "success", children }) {
  const dotClassName = {
    success: "bg-[var(--success)]",
    warning: "bg-[var(--warning)]",
    danger: "bg-[var(--danger)]",
  }[tone];

  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
      <span className={`h-2.5 w-2.5 rounded-full ${dotClassName}`} aria-hidden="true" />
      {children}
    </span>
  );
}

function SettingsKpiCard({ eyebrow, value, status, statusTone = "success", badge }) {
  return (
    <article className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5 shadow-[var(--shadow-subtle)]">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {eyebrow}
      </p>
      <strong className="mt-2 block text-[1.2rem] font-semibold text-[var(--text-primary)]">
        {value}
      </strong>
      <div className="mt-3">
        {badge ? <Badge tone="info">{badge}</Badge> : <StatusPill tone={statusTone}>{status}</StatusPill>}
      </div>
    </article>
  );
}

function ReadOnlyField({ label, value, full = false }) {
  return (
    <label className={full ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">{label}</span>
      <input
        type="text"
        value={value}
        readOnly
        className="w-full rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none"
      />
    </label>
  );
}

function ReadOnlyTextArea({ label, value }) {
  return (
    <label className="md:col-span-2">
      <span className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">{label}</span>
      <textarea
        rows={4}
        value={value}
        readOnly
        className="w-full rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none"
      />
    </label>
  );
}

function FooterActions({ leftLabel, rightPrimary = "Guardar configuracion", rightSecondary = "Restablecer a fabrica" }) {
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border-color)] pt-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        {leftLabel ? (
          <Button type="button" variant="secondary" disabled>
            {leftLabel}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <Button type="button" variant="secondary" disabled>
          {rightSecondary}
        </Button>
        <Button type="button" variant="primary" disabled>
          {rightPrimary}
        </Button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("itop");
  const [pdqStatus, setPdqStatus] = useState(null);
  const [pdqModuleEnabled, setPdqModuleEnabledState] = useState(() => isPdqModuleEnabled());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPdqStatus = async () => {
    setLoading(true);
    setError("");

    try {
      const payload = await getPdqStatus();
      setPdqStatus(payload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPdqStatus();
  }, []);

  const integrationKpis = useMemo(
    () => [
      {
        eyebrow: "iTop",
        value: import.meta.env.VITE_ITOP_URL ? "Configurado" : "Pendiente",
        status: import.meta.env.VITE_ITOP_URL ? "OK" : "Sin URL",
        statusTone: import.meta.env.VITE_ITOP_URL ? "success" : "warning",
      },
      {
        eyebrow: "Backend API",
        value: import.meta.env.VITE_API_URL ? "Configurado" : "Pendiente",
        status: import.meta.env.VITE_API_URL ? "OK" : "Sin URL",
        statusTone: import.meta.env.VITE_API_URL ? "success" : "warning",
      },
      {
        eyebrow: "Autenticacion",
        value: "Externa",
        status: "Por entorno",
        statusTone: "success",
      },
      {
        eyebrow: "Parametrizacion",
        value: "Externa",
        badge: "Configurada en entorno",
      },
    ],
    []
  );

  const handlePdqModuleToggle = (event) => {
    const enabled = event.target.checked;
    setPdqModuleEnabledState(enabled);
    setPdqModuleEnabled(enabled);
  };

  return (
    <div className="grid gap-5">
      <article className="rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-panel)] p-6 shadow-[var(--shadow-subtle)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Parametros funcionales
            </p>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Configuracion del sistema
            </h3>
          </div>

          <Button type="button" variant="secondary" onClick={loadPdqStatus} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar estado"}
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {SETTINGS_TABS.map((tab) => {
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
                    : "border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="mt-5 rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
            {error}
          </div>
        ) : null}

        {activeTab === "itop" ? (
          <div className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {integrationKpis.map((item) => (
                <SettingsKpiCard key={item.eyebrow} {...item} />
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="URL de iTop" value={import.meta.env.VITE_ITOP_URL || "No configurada"} />
              <ReadOnlyField label="Backend API" value={import.meta.env.VITE_API_URL || "No configurada"} />
              <ReadOnlyField label="Modo de integracion" value="API lateral via backend" />
              <ReadOnlyField label="Origen de parametros" value="Variables de entorno" />
              <ReadOnlyField label="Estado de autenticacion" value="Definido por despliegue" full />
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
              Estos datos se definen en la parametrizacion del sistema y variables de entorno del despliegue. No se editan desde esta interfaz.
            </p>
          </div>
        ) : null}

        {activeTab === "pdq" ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Modulo PDQ
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                    Visibilidad del modulo
                  </h4>
                  <p className="mt-2 max-w-[48rem] text-sm leading-6 text-[var(--text-secondary)]">
                    Esta integracion funciona en modo de solo lectura sobre una copia local de la base SQLite de PDQ. No consulta informacion en linea directamente desde PDQ; utiliza la base clonada disponible en el entorno para mostrar datos de inventario y ultima visibilidad.
                  </p>
                </div>

                <label className="inline-flex items-center gap-3 rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={pdqModuleEnabled}
                    onChange={handlePdqModuleToggle}
                    className="h-4 w-4 accent-[var(--accent-strong)]"
                  />
                  Activar modulo PDQ
                </label>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SettingsKpiCard
                eyebrow="Modulo"
                value={pdqModuleEnabled ? "Activo" : "Oculto"}
                status={pdqModuleEnabled ? "Visible en menu" : "No visible"}
                statusTone={pdqModuleEnabled ? "success" : "warning"}
              />
              <SettingsKpiCard
                eyebrow="Base SQLite"
                value={pdqStatus?.database_available ? "Detectada" : "Pendiente"}
                status={pdqStatus?.database_available ? "OK" : "Sin archivo"}
                statusTone={pdqStatus?.database_available ? "success" : "warning"}
              />
              <SettingsKpiCard
                eyebrow="Fecha DB"
                value={formatDate(getPdqDatabaseReferenceDate(pdqStatus))}
                status={pdqStatus?.database_available ? "Archivo detectado" : "Sin referencia"}
                statusTone={pdqStatus?.database_available ? "success" : "warning"}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Archivo detectado" value={pdqStatus?.selected_file?.name || "Sin archivo detectado"} />
              <ReadOnlyField label="Fecha DB" value={formatDate(getPdqDatabaseReferenceDate(pdqStatus))} />
            </div>

            <p className="text-sm leading-6 text-[var(--text-muted)]">
              La activacion del modulo PDQ es una preferencia de interfaz guardada localmente en este navegador. La disponibilidad real de datos sigue dependiendo de la SQLite montada en el backend.
            </p>
          </div>
        ) : null}

        {activeTab === "sync" ? (
          <div className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Ejecucion manual" value="Disponible bajo demanda" />
              <ReadOnlyField label="Automatizacion" value="Copia externa de SQLite a carpeta compartida" />
              <ReadOnlyField label="Modo de consulta" value="Busqueda por nombre de maquina o MAC" />
              <ReadOnlyField label="Minimo de caracteres" value={String(pdqStatus?.search_min_chars ?? 2)} />
              <ReadOnlyField label="Carpeta existe" value={formatBoolean(pdqStatus?.directory_exists)} />
              <ReadOnlyField label="Base disponible" value={formatBoolean(pdqStatus?.database_available)} />
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
              Ultima deteccion de archivo: {formatDate(pdqStatus?.selected_file?.modified_at)}. Estado actual: {pdqStatus?.database_available ? "base disponible" : "pendiente de copia"}.
            </p>

            <FooterActions leftLabel="Forzar sincronizacion ahora" />
          </div>
        ) : null}

        {activeTab === "mail" ? (
          <div className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Remitente visible" value="Mesa de Ayuda TI" />
              <ReadOnlyField label="Correo remitente" value="soporte@empresa.local" />
              <ReadOnlyField label="Servidor SMTP" value="Configurado en backend y entorno" />
              <ReadOnlyField label="Puerto SMTP" value="Configurado en entorno" />
              <ReadOnlyField label="Usuario SMTP" value="No expuesto en frontend" />
              <ReadOnlyField label="Seguridad" value="Definida por despliegue" />
              <ReadOnlyTextArea label="Pie de correo documental" value="Documento generado automaticamente por iTop Hub. Para consultas contacte a Mesa de Ayuda TI." />
            </div>

            <FooterActions leftLabel="Test SMTP" />
          </div>
        ) : null}

        {activeTab === "docs" ? (
          <div className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Prefijo actas entrega" value="ENT" />
              <ReadOnlyField label="Prefijo actas recepcion" value="REC" />
              <ReadOnlyField label="Prefijo laboratorio" value="LAB" />
              <ReadOnlyField label="Formato numeracion" value="AAAA-NNNN" />
              <ReadOnlyTextArea label="Observacion por defecto" value="El documento se emite como respaldo formal del movimiento registrado en CMDB." />
            </div>

            <FooterActions />
          </div>
        ) : null}

        {activeTab === "cmdb" ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Alcance actual</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {["Desktop (PC)", "Laptop (Laptop)", "Tableta (Tablet)", "Celular (MobilePhone)", "Impresora (Printer)", "Periferico (Peripheral)"].map((item) => (
                  <label key={item} className="rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                    <input type="checkbox" checked={item.includes("Desktop") || item.includes("Laptop")} readOnly className="mr-3 accent-[var(--accent-strong)]" />
                    {item}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Estado de apoyo operacional</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                PDQ se integra como fuente lateral de visibilidad para nombre de maquina, MAC, red e informacion de ultima visualizacion, sin reemplazar la CMDB principal.
              </p>
            </div>

            <FooterActions />
          </div>
        ) : null}
      </article>
    </div>
  );
}
