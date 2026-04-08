import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../../components/ui/general/DataTable";
import { Panel, PanelHeader } from "../../components/ui/general/Panel";
import { Icon } from "../../components/ui/icon/Icon";
import ModalManager from "../../components/ui/modal";
import { Button } from "../../ui/Button";
import { getPdqStatus, searchPdqDevices } from "../../services/pdq-service";

function formatDate(value) {
  if (!value || value === "N/D") {
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

function formatBytes(value) {
  if (!value && value !== 0) {
    return "N/D";
  }

  const units = ["B", "KB", "MB", "GB"];
  let current = value;
  let unitIndex = 0;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  return `${current.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}


function getStaleDatabaseWarning(selectedFile) {
  const referenceTimestamp = selectedFile?.observed_at || selectedFile?.created_at || selectedFile?.modified_at;
  if (!referenceTimestamp) {
    return "";
  }

  const referenceDate = new Date(referenceTimestamp);
  if (Number.isNaN(referenceDate.getTime())) {
    return "";
  }

  const diffMs = Date.now() - referenceDate.getTime();
  const staleThresholdMs = 24 * 60 * 60 * 1000;

  if (diffMs <= staleThresholdMs) {
    return "";
  }

  const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const ageLabel = days > 0
    ? `${days} dia${days === 1 ? "" : "s"}${hours > 0 ? ` y ${hours} hora${hours === 1 ? "" : "s"}` : ""}`
    : `${totalHours} hora${totalHours === 1 ? "" : "s"}`;

  return `La base PDQ tiene mas de 24 horas sin actualizarse. Ultima copia detectada hace ${ageLabel}.`;
}


function escapeCsvValue(value) {
  const normalizedValue = value == null ? "" : String(value);
  const escapedValue = normalizedValue.replace(/"/g, '""');
  return /[",;\n]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
}


function splitIpVersions(value) {
  const rawValue = value == null ? "" : String(value);
  const parts = rawValue
    .split(/[,\s;|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item !== "N/D");

  const ipv4 = parts.filter((item) => item.includes("."));
  const ipv6 = parts.filter((item) => item.includes(":"));

  return {
    ipv4: ipv4.length ? ipv4.join(", ") : "N/D",
    ipv6: ipv6.length ? ipv6.join(", ") : "N/D",
  };
}


function sortPdqResultsByHostname(results) {
  return [...results].sort((left, right) =>
    String(left?.hostname || "").localeCompare(String(right?.hostname || ""), "es", { numeric: true })
  );
}


function splitHostnameParts(value) {
  const fullHostname = value == null ? "" : String(value).trim();
  if (!fullHostname) {
    return {
      shortHostname: "N/D",
      fullHostname: "N/D",
    };
  }

  const [shortHostname] = fullHostname.split(".");
  return {
    shortHostname: shortHostname || fullHostname,
    fullHostname,
  };
}


function downloadPdqResultsAsExcel(results, query) {
  if (!results.length) {
    return;
  }

  const header = [
    "HostName",
    "HostName AD",
    "Marca",
    "Modelo",
    "OSName",
    "CurrentUser",
    "DisplayName",
    "Activo",
    "MAC",
    "IPv4",
    "IPv6",
    "LastLogon",
    "LastScan",
  ];

  const rows = results.map((row) => {
    const networkIps = splitIpVersions(row.network?.ip);
    const hostnameParts = splitHostnameParts(row.hostname);

    return [
      hostnameParts.shortHostname,
      hostnameParts.fullHostname,
      row.brand || "N/D",
      row.model || "N/D",
      row.osName || "N/D",
      row.currentUser || "N/D",
      row.currentUserCommonName || "N/D",
      row.network?.active || "N/D",
      row.network?.mac || "N/D",
      networkIps.ipv4,
      networkIps.ipv6,
      formatDate(row.adLastLogon),
      formatDate(row.lastSuccessfulScan),
    ];
  });

  const csvContent = [header, ...rows]
    .map((columns) => columns.map(escapeCsvValue).join(";"))
    .join("\n");

  const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeQuery = (query || "pdq").trim().replace(/[^a-z0-9_-]+/gi, "_");
  link.href = downloadUrl;
  link.download = `pdq_${safeQuery || "resultados"}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

function PdqStatusBanner({ status, onRefresh, loading }) {
  const stateClassName = "border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] text-[var(--text-primary)]";

  return (
    <div className={`flex flex-col gap-4 rounded-[22px] border p-5 lg:flex-row lg:items-center lg:justify-between ${stateClassName}`}>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Estado de integracion PDQ
        </p>
        <h3 className="text-lg font-semibold">
          Base SQLite no detectada
        </h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Carpeta configurada: <span className="font-semibold text-[var(--text-primary)]">{status?.sqlite_dir || "N/D"}</span>
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          Archivo seleccionado: <span className="font-semibold text-[var(--text-primary)]">{status?.selected_file?.name || "Sin archivo"}</span>
        </p>
      </div>

      <Button type="button" variant="secondary" onClick={onRefresh} disabled={loading}>
        <Icon name="history" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {loading ? "Actualizando..." : "Actualizar estado"}
      </Button>
    </div>
  );
}

function ReportStyleToggleButton({ isCollapsed, onClick, collapsedLabel, expandedLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isCollapsed ? collapsedLabel : expandedLabel}
      aria-label={isCollapsed ? collapsedLabel : expandedLabel}
      className="inline-flex h-11 w-11 min-w-11 items-center justify-center rounded-[14px] border border-[var(--border-strong)] bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-[var(--shadow-subtle)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-[16px] w-[16px] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isCollapsed ? "" : "rotate-180"}`}
        aria-hidden="true"
      >
        <path
          d="M7 10l5 5 5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function FieldHint({ text }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="relative ml-2 inline-flex">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-color)] text-[0.65rem] font-semibold text-[var(--text-muted)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
        aria-label={text}
        aria-expanded={isOpen}
      >
        i
      </button>

      {isOpen ? (
        <span className="absolute left-0 top-[calc(100%+0.45rem)] z-10 min-w-[220px] max-w-[280px] rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-left text-xs font-medium normal-case tracking-normal text-[var(--text-secondary)] shadow-[var(--shadow-soft)]">
          {text}
        </span>
      ) : null}
    </span>
  );
}


function buildUserSessionHint(device) {
  const lastScanLabel = formatDate(device.lastSuccessfulScan);
  if (!lastScanLabel || lastScanLabel === "N/D") {
    return "Sesion detectada en el ultimo escaneo PDQ.";
  }

  return `Sesion detectada en el ultimo escaneo PDQ. Ultimo escaneo: ${lastScanLabel}.`;
}

function DetailFieldList({ rows, columnsClassName = "md:grid-cols-2" }) {
  return (
    <div className={`grid gap-x-8 gap-y-4 ${columnsClassName}`}>
      {rows.map((item) => (
        <div key={item.label} className="border-b border-[rgba(188,205,218,0.18)] pb-3">
          <div className="flex items-center">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {item.label}
            </p>
            {item.hint ? <FieldHint text={item.hint} /> : null}
          </div>
          {typeof item.value === "string" || typeof item.value === "number" ? (
            <p className="mt-1 text-sm leading-6 text-[var(--text-primary)]">{item.value || "N/D"}</p>
          ) : (
            <div className="mt-1 text-sm leading-6 text-[var(--text-primary)]">{item.value || "N/D"}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function TimelineGroup({ rows }) {
  return (
    <DetailFieldList rows={rows} columnsClassName="md:grid-cols-2 xl:grid-cols-3" />
  );
}

function CollapsibleSection({ label, helper, isCollapsed, onToggle, children }) {
  return (
    <section className="rounded-[20px] border border-[var(--border-color)] bg-[rgba(7,13,20,0.12)] px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {label}
          </p>
          {helper ? (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{helper}</p>
          ) : null}
        </div>
        <ReportStyleToggleButton
          isCollapsed={isCollapsed}
          onClick={onToggle}
          collapsedLabel={`Expandir ${label}`}
          expandedLabel={`Colapsar ${label}`}
        />
      </div>

      <div
        className={`overflow-hidden transition-[max-height,opacity,transform,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isCollapsed ? "max-h-0 pt-0 opacity-0 -translate-y-1" : "max-h-[1200px] pt-4 opacity-100 translate-y-0"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function PdqDetailModalContent({ device }) {
  const [activeTab, setActiveTab] = useState("summary");
  const [expandedSections, setExpandedSections] = useState({
    identity: true,
    access: false,
    adTimeline: true,
    pdqTimeline: true,
  });

  const identityRows = [
    { label: "Descripcion AD", value: device.descriptionAd },
    { label: "Dominio", value: device.domain },
    { label: "OU", value: device.ouPath },
    { label: "Clasificacion", value: device.hostnameNamingType },
    { label: "MAC principal", value: device.macActive },
    { label: "Direccion IP", value: device.ipAddress },
    { label: "Sistema operativo", value: device.operatingSystem },
    { label: "Memoria RAM", value: device.ram },
  ];

  const accessRows = [
    {
      label: "Usuario AD",
      value: (
        <div className="space-y-1">
          <p>{device.adUser || "N/D"}</p>
          {device.currentUserCommonName && device.currentUserCommonName !== "N/D" ? (
            <p className="text-xs text-[var(--text-muted)]">{device.currentUserCommonName}</p>
          ) : null}
        </div>
      ),
    },
    {
      label: "Usuario actual",
      value: (
        <div className="space-y-1">
          <p>{device.user || "N/D"}</p>
          {device.currentUserCommonName && device.currentUserCommonName !== "N/D" ? (
            <p className="text-xs text-[var(--text-muted)]">{device.currentUserCommonName}</p>
          ) : null}
        </div>
      ),
      hint: buildUserSessionHint(device),
    },
    { label: "Estado de red", value: device.network?.active === "Si" ? "En linea" : "Sin conexion confirmada" },
    { label: "MAC buscada", value: device.matchedMac },
  ];

  const timelineRows = [
    { label: "Creado en AD", value: device.adWhenCreated },
    { label: "AD LastLogon", value: device.adLastLogon },
  ];

  const pdqTimelineRows = [
    { label: "Registrado en PDQ", value: device.pdqRegisteredAt },
    { label: "Ultimo escaneo exitoso", value: device.lastSuccessfulScan },
    { label: "Ultimo intento de escaneo", value: device.lastScanAttempt },
    { label: "Ultimo contacto PDQ", value: device.heartbeatDate },
    { label: "Ultima vez online", value: device.lastOnlineTime },
    { label: "Ultima vez offline", value: device.lastOfflineTime },
    { label: "Ultima visibilidad", value: device.lastSeen },
  ];

  const toggleSection = (sectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

  const renderGridRows = (rows, columnsClassName) => <DetailFieldList rows={rows} columnsClassName={columnsClassName} />;

  const renderSection = ({ key, label, helper, content }) => (
    <CollapsibleSection
      label={label}
      helper={helper}
      isCollapsed={!expandedSections[key]}
      onToggle={() => toggleSection(key)}
    >
      {content}
    </CollapsibleSection>
  );

  return (
    <div className="flex h-[calc(90vh-7.5rem)] min-h-[500px] w-full max-w-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border-color)] pb-4">
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          Inventario, fechas y conectividad detectadas para este equipo en PDQ.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { id: "summary", label: "Resumen" },
          { id: "timeline", label: "Fechas" },
          { id: "interfaces", label: `Interfaces (${(device.interfaces || []).length})` },
        ].map((tab) => {
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

      <div className="mt-5 min-h-0 flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto pr-1 pb-4">
          {activeTab === "summary" ? (
            <div className="space-y-4 px-1 py-1">
              {renderSection({
                key: "identity",
                label: "Identidad del equipo",
                helper: "Datos generales de inventario, AD y clasificacion por nomenclatura.",
                content: renderGridRows(identityRows, "md:grid-cols-2 xl:grid-cols-3"),
              })}
              {renderSection({
                key: "access",
                label: "Sesion y conectividad",
                helper: "Usuario detectado y datos principales de red del equipo.",
                content: renderGridRows(accessRows, "md:grid-cols-2"),
              })}
            </div>
          ) : null}

          {activeTab === "timeline" ? (
            <div className="space-y-4 px-1 py-1">
              <CollapsibleSection
                label="Active Directory"
                helper="Fechas heredadas del objeto del equipo dentro del dominio."
                isCollapsed={!expandedSections.adTimeline}
                onToggle={() => toggleSection("adTimeline")}
              >
                <TimelineGroup rows={timelineRows} />
              </CollapsibleSection>
              <CollapsibleSection
                label="PDQ Inventory"
                helper="Fechas asociadas al registro, escaneo y conectividad detectada por PDQ."
                isCollapsed={!expandedSections.pdqTimeline}
                onToggle={() => toggleSection("pdqTimeline")}
              >
                <TimelineGroup rows={pdqTimelineRows} />
              </CollapsibleSection>
            </div>
          ) : null}

          {activeTab === "interfaces" ? (
            <div className="space-y-4 px-1 py-1">
              <div className="max-h-[calc(90vh-18rem)] min-h-[320px] overflow-auto rounded-[18px] border border-[var(--border-color)]">
                <div className="min-w-[980px]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="sticky top-0 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-3 text-left text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                          Name
                        </th>
                        <th className="sticky top-0 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-3 text-left text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                          MacAddress
                        </th>
                        <th className="sticky top-0 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-3 text-left text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                          Manufactured
                        </th>
                        <th className="sticky top-0 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-3 text-left text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                          NetConnectionStatus
                        </th>
                        <th className="sticky top-0 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-3 text-left text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                          IP
                        </th>
                        <th className="sticky top-0 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-3 text-left text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                          Type
                        </th>
                        <th className="sticky top-0 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-3 text-left text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                          Link
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(device.interfaces || []).map((item, index) => (
                        <tr key={`${item.name}-${item.macAddress}-${index}`} className="hover:bg-[var(--bg-hover)] transition-colors">
                          <td className="border-b border-[var(--border-color)] px-3 py-3 text-sm text-[var(--text-secondary)] align-top">
                            {item.name || "N/D"}
                          </td>
                          <td className="border-b border-[var(--border-color)] px-3 py-3 text-sm text-[var(--text-secondary)] align-top">
                            {item.macAddress || "N/D"}
                          </td>
                          <td className="border-b border-[var(--border-color)] px-3 py-3 text-sm text-[var(--text-secondary)] align-top">
                            {item.manufacturer || "N/D"}
                          </td>
                          <td className="border-b border-[var(--border-color)] px-3 py-3 text-sm text-[var(--text-secondary)] align-top">
                            {item.netConnectionStatus || "N/D"}
                          </td>
                          <td className="border-b border-[var(--border-color)] px-3 py-3 text-sm text-[var(--text-secondary)] align-top">
                            {item.ipAddress || "N/D"}
                          </td>
                          <td className="border-b border-[var(--border-color)] px-3 py-3 text-sm text-[var(--text-secondary)] align-top">
                            {item.adapterType || "N/D"}
                          </td>
                          <td className="border-b border-[var(--border-color)] px-3 py-3 text-sm text-[var(--text-secondary)] align-top">
                            {item.connectionSpeed || "N/D"}
                          </td>
                        </tr>
                      ))}

                      {(device.interfaces || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-sm text-[var(--text-muted)]">
                            No se detectaron interfaces adicionales para este equipo.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PDQPage() {
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    setStatusLoading(true);
    setError("");

    try {
      const payload = await getPdqStatus();
      setStatus(payload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const minChars = status?.search_min_chars ?? 2;
  const trimmedQuery = query.trim();
  const databaseAvailable = Boolean(status?.database_available);
  const staleDatabaseWarning = getStaleDatabaseWarning(status?.selected_file);

  const openDetailModal = (device) => {
    ModalManager.custom({
      title: `PDQ - ${device.hostname}`,
      size: "pdfViewer",
      showFooter: false,
      content: <PdqDetailModalContent device={device} />,
    });
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setError("");
    setWarnings([]);

    if (trimmedQuery.length < minChars) {
      setError(`Ingresa al menos ${minChars} caracteres del nombre, la MAC o el usuario para buscar.`);
      return;
    }

    setSearchLoading(true);

    try {
      const payload = await searchPdqDevices(trimmedQuery);
      setResults(sortPdqResultsByHostname(payload.results || []));
      setWarnings(payload.warnings || []);
    } catch (searchError) {
      setResults([]);
      setError(searchError.message);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleExportResults = () => {
    downloadPdqResultsAsExcel(results, trimmedQuery);
  };

  const columns = useMemo(
    () => [
      { key: "hostname", label: "HostName", sortable: true },
      {
        key: "networkActive",
        label: "Activo",
        sortable: true,
        render: (_, row) => {
          const isActive = row.network?.active === "Si";

          return (
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`inline-flex h-2.5 w-2.5 rounded-full ${
                  isActive ? "bg-[var(--success)] shadow-[0_0_0_4px_rgba(74,222,128,0.12)]" : "bg-[var(--danger)] shadow-[0_0_0_4px_rgba(248,113,113,0.12)]"
                }`}
                aria-hidden="true"
              />
              <span className={isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}>
                {isActive ? "En linea" : "Sin conexion"}
              </span>
            </div>
          );
        },
      },
      {
        key: "device",
        label: "Device",
        sortable: true,
        render: (_, row) => (
          <div className="space-y-1 text-sm">
            <p><span className="font-semibold text-[var(--text-primary)]">Marca:</span> {row.brand || "N/D"}</p>
            <p><span className="font-semibold text-[var(--text-primary)]">Modelo:</span> {row.model || "N/D"}</p>
          </div>
        ),
      },
      { key: "osName", label: "OSName", sortable: true },
      {
        key: "currentUser",
        label: "CurrentUser",
        sortable: true,
        render: (_, row) => (
          <div className="space-y-1 text-sm">
            <p className="text-[var(--text-primary)]">{row.currentUser || "N/D"}</p>
            {row.currentUserCommonName && row.currentUserCommonName !== "N/D" ? (
              <p className="text-xs text-[var(--text-muted)]">{row.currentUserCommonName}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: "network",
        label: "Network",
        render: (_, row) => {
          const networkIps = splitIpVersions(row.network?.ip);

          return (
            <div className="space-y-1 text-sm">
              <p><span className="font-semibold text-[var(--text-primary)]">MAC:</span> {row.network?.mac || "N/D"}</p>
              <p><span className="font-semibold text-[var(--text-primary)]">IPv4:</span> {networkIps.ipv4}</p>
              {networkIps.ipv6 !== "N/D" ? (
                <p><span className="font-semibold text-[var(--text-primary)]">IPv6:</span> {networkIps.ipv6}</p>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "activity",
        label: "Actividad",
        render: (_, row) => (
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-semibold text-[var(--text-primary)]">Last Logon:</span>{" "}
              {formatDate(row.adLastLogon)}
            </p>
            <p>
              <span className="font-semibold text-[var(--text-primary)]">Last Scan:</span>{" "}
              {formatDate(row.lastSuccessfulScan)}
            </p>
          </div>
        ),
      },
      {
        key: "actions",
        label: "Acciones",
        render: (_, row) => (
          <Button type="button" variant="secondary" size="sm" onClick={() => openDetailModal(row)}>
            <Icon name="eye" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Ver detalle
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div className="grid gap-5">
      {!databaseAvailable ? (
        <PdqStatusBanner status={status} onRefresh={loadStatus} loading={statusLoading} />
      ) : null}

      {databaseAvailable ? (
        <Panel>
          <PanelHeader
            eyebrow="Integracion"
            title="Buscar equipo en PDQ"
            actions={status?.selected_file ? (
              <div className="text-right text-xs text-[var(--text-muted)]">
                <p>{status.selected_file.name}</p>
                <p>{formatBytes(status.selected_file.size_bytes)} | {formatDate(status.selected_file.modified_at)}</p>
              </div>
            ) : null}
          />

          {staleDatabaseWarning ? (
            <div className="mb-4 rounded-[18px] border border-[rgba(224,181,107,0.45)] bg-[rgba(224,181,107,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
              {staleDatabaseWarning}
            </div>
          ) : null}

          <form className="grid gap-4 lg:grid-cols-[1fr_auto]" onSubmit={handleSearch}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
                Ingresa nombre de maquina, direccion MAC o usuario (minimo {minChars} caracteres)
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="GF0612CH, BC:03:58:86:B8:A2 o Carlos Fuentes"
                className="w-full rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-strong)] focus:shadow-[0_0_0_4px_rgba(81,152,194,0.12)]"
              />
            </label>

            <div className="flex items-end">
              <Button
                type="submit"
                variant="primary"
                disabled={searchLoading}
              >
                <Icon name="search" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {searchLoading ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </form>

          {error ? (
            <div className="mt-4 rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
              {error}
            </div>
          ) : null}

          {warnings.map((warning) => (
            <div key={warning} className="mt-4 rounded-[18px] border border-[rgba(224,181,107,0.45)] bg-[rgba(224,181,107,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
              {warning}
            </div>
          ))}
        </Panel>
      ) : null}

      {databaseAvailable ? (
        <Panel>
          <PanelHeader
            eyebrow="Resultados"
            title={`${results.length} registro${results.length === 1 ? "" : "s"} encontrado${results.length === 1 ? "" : "s"}`}
            actions={results.length ? (
              <Button type="button" variant="secondary" onClick={handleExportResults}>
                <Icon name="download" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Descargar Excel
              </Button>
            ) : null}
          />
          <DataTable
            columns={columns}
            rows={results}
            loading={searchLoading}
            emptyMessage="No hay resultados para el nombre, la MAC o el usuario consultado."
          />
        </Panel>
      ) : null}
    </div>
  );
}
