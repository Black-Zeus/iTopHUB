import { useEffect, useMemo, useState } from "react";
import { CircleAlert, FileText, FolderTree, Link as LinkIcon } from "lucide-react";
import ModalManager from "../../components/ui/modal";
import { FilterDropdown } from "../../components/ui/general";
import { Button } from "../../ui/Button";
import { setPdqModuleEnabled } from "../../services/module-visibility-service";
import { getPdqStatus } from "../../services/pdq-service";
import { getItopRequirementCatalog } from "../../services/itop-service";
import {
  createItopDocumentTypes,
  createSettingsProfile,
  createSyncTask,
  deleteSyncTask,
  getSettings,
  getSettingsProfiles,
  testItopSettings,
  testMailSettings,
  testPdqSettings,
  updateSettingsPanel,
  updateSettingsProfile,
  updateSyncTask,
  validateItopDocumentTypes,
} from "../../services/settings-service";

const TABS = [
  { id: "organization", label: "Organizacion" },
  { id: "qr", label: "Firma QR" },
  { id: "itop", label: "Integracion iTop" },
  { id: "pdq", label: "PDQ" },
  { id: "sync", label: "Sincronizacion" },
  { id: "mail", label: "Correo" },
  { id: "docs", label: "Documentos" },
  { id: "requirement", label: "Ticket iTop" },
  { id: "cmdb", label: "CMDB" },
  { id: "profiles", label: "Perfiles" },
];

const CMDB_OPTIONS = [
  "Desktop (PC)",
  "Laptop (Laptop)",
  "Tableta (Tablet)",
  "Celular (MobilePhone)",
  "Impresora (Printer)",
  "Periferico (Peripheral)",
];

const HANDOVER_RETURN_ASSET_STATUS_OPTIONS = [
  { value: "stock", label: "En Inventario (stock)" },
  { value: "implementation", label: "En Implementacion (implementation)" },
  { value: "production", label: "En Produccion (production)" },
  { value: "test", label: "En Pruebas (test)" },
  { value: "obsolete", label: "Obsoleto (obsolete)" },
  { value: "inactive", label: "Inactivo (inactive)" },
];

const EVIDENCE_EXTENSION_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "doc", label: "DOC" },
  { value: "docx", label: "DOCX" },
  { value: "txt", label: "TXT" },
];

const HANDOVER_DOCUMENT_TYPE_STRATEGY_OPTIONS = [
  { value: "single", label: "Tipo unico" },
  { value: "per_type", label: "Uno por tipo de acta" },
];

const HANDOVER_DOCUMENT_TYPE_PREVIEW_TARGETS = [
  { key: "initial_assignment", label: "Entrega inicial", suffix: "Entrega" },
  { key: "return", label: "Devolucion", suffix: "Devolucion" },
  { key: "reassignment", label: "Reasignacion", suffix: "Reasignacion" },
  { key: "normalization", label: "Normalizacion", suffix: "Normalizacion" },
  { key: "laboratory", label: "Laboratorio", suffix: "Laboratorio" },
];

const REQUIREMENT_TICKET_CLASS_OPTIONS = [
  { value: "UserRequest", label: "Requerimiento (UserRequest)" },
  { value: "Incident", label: "Incidente (Incident)" },
  { value: "NormalChange", label: "Cambio normal (NormalChange)" },
];

const REQUIREMENT_INITIAL_STATUS_OPTIONS = [
  { value: "assigned", label: "Asignado" },
  { value: "created", label: "Creado" },
];

const EMPTY_TASK = {
  schedule: "",
  description: "",
  taskType: "pdq_import",
  commandSource: "preset",
  commandValue: "sync.pdq.refresh",
  isActive: true,
};

const EMPTY_PROFILE = {
  code: "",
  name: "",
  description: "",
  isAdmin: false,
  status: "active",
  modules: [],
};

function buildItopApiPath(integrationUrl) {
  const base = String(integrationUrl || "").trim().replace(/\/+$/, "");
  return base ? `${base}/webservices/rest.php` : "";
}

function buildItopServerLabel(integrationUrl) {
  const base = String(integrationUrl || "").trim().replace(/\/+$/, "");
  if (!base) return "";

  const match = base.match(/^(https?:\/\/[^/]+)/i);
  return match ? match[1] : base;
}

function resolvePdqDatabasePath(configuredPath, pdqStatus) {
  const configured = String(configuredPath || "").trim();
  const detected = String(pdqStatus?.selected_file?.path || "").trim();

  if (detected) {
    const normalizedConfigured = configured.replace(/\\/g, "/");
    if (!configured || !/\.[^/\\]+$/.test(normalizedConfigured)) {
      return detected;
    }
  }

  return configured;
}

function fmtDate(value) {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function pdqRefDate(status) {
  return status?.selected_file?.observed_at || status?.selected_file?.created_at || status?.selected_file?.modified_at || "";
}

function getModuleAccessLevel(module) {
  if (module?.canWrite) return "write";
  if (module?.canView) return "read";
  return "none";
}

function setModuleAccessLevel(module, accessLevel) {
  return {
    ...module,
    canView: accessLevel === "read" || accessLevel === "write",
    canWrite: accessLevel === "write",
  };
}

function serializePanelConfig(config) {
  return JSON.stringify(config || {});
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error(`No fue posible leer el archivo ${file?.name || "seleccionado"}.`));
    reader.readAsDataURL(file);
  });
}

function renderSingleSelection({ label, selectedOptions }) {
  return (
    <>
      <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="mt-1 block truncate text-sm font-semibold text-[var(--text-primary)]">
        {selectedOptions[0]?.label || "Selecciona"}
      </span>
    </>
  );
}

function getSettingsFilterOptionClassName(_, isActive) {
  return isActive
    ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
    : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]";
}

function buildSelectOptions(items = [], placeholder = "Selecciona", currentValue = "", currentLabel = "") {
  const normalized = Array.isArray(items)
    ? items
        .filter((item) => item && item.value !== undefined && item.value !== null && `${item.label || ""}`.trim())
        .map((item) => ({ value: `${item.value}`.trim(), label: `${item.label}`.trim() }))
    : [];

  const next = [...normalized];
  const current = `${currentValue || ""}`.trim();
  if (current && !next.some((item) => item.value === current)) {
    next.unshift({ value: current, label: `${currentLabel || current}`.trim() || current });
  }

  return [{ value: "", label: placeholder }, ...next];
}

function normalizeDocumentTypeBaseName(value) {
  const normalized = `${value || ""}`.trim().replace(/\s+/g, " ");
  return normalized || "Acta";
}

function buildExpectedDocumentTypeItems(config = {}) {
  const baseName = normalizeDocumentTypeBaseName(config.itopDocumentTypeBaseName);
  const strategy = `${config.itopDocumentTypeStrategy || "single"}`.trim().toLowerCase() === "per_type" ? "per_type" : "single";

  if (strategy === "single") {
    return [
      {
        key: "default",
        typeLabel: "Todas las actas",
        documentTypeName: baseName,
      },
    ];
  }

  return HANDOVER_DOCUMENT_TYPE_PREVIEW_TARGETS.map((item) => ({
    key: item.key,
    typeLabel: item.label,
    documentTypeName: `${baseName} ${item.suffix}`.trim(),
  }));
}

function buildDocumentTypeStatusItems(previewItems = [], syncResult = null, action = "") {
  const resolvedItems = Array.isArray(syncResult?.items) ? syncResult.items : [];

  return previewItems.map((item) => {
    const resolved = resolvedItems.find((current) => current.key === item.key);

    if (action) {
      return {
        ...item,
        statusTone: "warning",
        statusLabel: "Validando...",
        documentTypeId: resolved?.documentTypeId || "",
      };
    }

    if (resolved) {
      return {
        ...item,
        statusTone: resolved.exists ? "success" : "danger",
        statusLabel: resolved.exists ? "Correcto" : "Error",
        documentTypeId: resolved.documentTypeId || "",
      };
    }

    return {
      ...item,
      statusTone: "neutral",
      statusLabel: "Pendiente",
      documentTypeId: "",
    };
  });
}

function KPI({ eyebrow, value, status, tone = "success" }) {
  const dot = {
    success: "bg-[var(--success)]",
    warning: "bg-[var(--warning)]",
    danger: "bg-[var(--danger)]",
  }[tone];
  return (
    <article className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5 shadow-[var(--shadow-subtle)]">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{eyebrow}</p>
      <strong className="mt-2 block text-[1.2rem] font-semibold text-[var(--text-primary)]">{value}</strong>
      <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
        {status}
      </span>
    </article>
  );
}

function Field({ label, value, onChange, type = "text", rows = 0, options = null, readOnly = false, disabled = false, inputClassName = "" }) {
  const base = `w-full rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none ${inputClassName}`.trim();
  return (
    <label className={rows ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">{label}</span>
      {options ? (
        <select value={value} onChange={onChange} disabled={disabled} className={base}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : rows ? (
        <textarea rows={rows} value={value} onChange={onChange} readOnly={readOnly} disabled={disabled} className={base} />
      ) : (
        <input type={type} value={value} onChange={onChange} readOnly={readOnly} disabled={disabled} className={base} />
      )}
    </label>
  );
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-1 h-4 w-4 accent-[var(--accent-strong)]" />
      <span>
        <span className="block text-sm font-semibold text-[var(--text-primary)]">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">{description}</span>
      </span>
    </label>
  );
}

function Actions({ dirty, saving, onReset, onSave, leftContent = null, canSave = true }) {
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border-color)] pt-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-3">
        {leftContent}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="secondary" disabled={!dirty || saving} onClick={onReset}>Restablecer panel</Button>
        <Button type="button" variant="primary" disabled={!dirty || saving || !canSave} onClick={onSave}>{saving ? "Guardando..." : "Guardar panel"}</Button>
      </div>
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete }) {
  return (
    <article className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">{task.description}</p>
          <p>Programacion: {task.schedule}</p>
          <p>Tipo: {task.taskType}</p>
          <p>Comando: {task.commandSource} / {task.commandValue}</p>
          <p>Estado: {task.isActive ? "Activa" : "Inactiva"}</p>
          <p className="text-xs text-[var(--text-muted)]">Actualizada: {fmtDate(task.updatedAt)}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => onEdit(task)}>Editar</Button>
          <Button type="button" size="sm" variant="danger" onClick={() => onDelete(task)}>Eliminar</Button>
        </div>
      </div>
    </article>
  );
}

function ProfileCard({ profile, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[18px] border p-4 text-left transition ${
        active
          ? "border-[rgba(81,152,194,0.26)] bg-[var(--accent-soft)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
          : "border-[var(--border-color)] bg-[var(--bg-app)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
      }`}
    >
      <p className="text-sm font-semibold text-[var(--text-primary)]">{profile.name}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{profile.code}</p>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{profile.description || "Sin descripcion"}</p>
    </button>
  );
}

function SectionToggleButton({ isCollapsed, onClick, collapsedLabel, expandedLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--border-strong)] bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-[var(--shadow-subtle)] transition-transform ${
        isCollapsed ? "rotate-180" : ""
      }`}
      title={isCollapsed ? collapsedLabel : expandedLabel}
      aria-label={isCollapsed ? collapsedLabel : expandedLabel}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
        <path
          d="M7 10l5 5 5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("itop");
  const [panels, setPanels] = useState({});
  const [drafts, setDrafts] = useState({});
  const [pdqStatus, setPdqStatus] = useState(null);
  const [taskMeta, setTaskMeta] = useState({ syncTaskTypes: [], syncCommandPresets: [] });
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingPanel, setSavingPanel] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [refreshingPdq, setRefreshingPdq] = useState(false);
  const [testingItop, setTestingItop] = useState(false);
  const [testingPdq, setTestingPdq] = useState(false);
  const [testingMail, setTestingMail] = useState(false);
  const [documentTypeAction, setDocumentTypeAction] = useState("");
  const [documentTypeSyncResult, setDocumentTypeSyncResult] = useState(null);
  const [validatedPanelSignatures, setValidatedPanelSignatures] = useState({
    itop: "",
    pdq: "",
    mail: "",
  });
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileCode, setSelectedProfileCode] = useState("");
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [savingProfile, setSavingProfile] = useState(false);
  const [collapsedProfileSections, setCollapsedProfileSections] = useState({
    details: false,
    permissions: true,
  });
  const [requirementCatalog, setRequirementCatalog] = useState({
    organizations: [],
    origins: [],
    services: [],
    serviceSubcategories: [],
    impacts: [],
    urgencies: [],
    priorities: [],
  });
  const [loadingRequirementCatalog, setLoadingRequirementCatalog] = useState(false);
  const [requirementCatalogLoaded, setRequirementCatalogLoaded] = useState(false);
  const [requirementCatalogError, setRequirementCatalogError] = useState("");

  const dirtyMap = useMemo(
    () => TABS.reduce((acc, tab) => ({ ...acc, [tab.id]: JSON.stringify(drafts[tab.id] || {}) !== JSON.stringify(panels[tab.id] || {}) }), {}),
    [drafts, panels]
  );

  const canSaveItop = !dirtyMap.itop || validatedPanelSignatures.itop === serializePanelConfig(drafts.itop);
  const canSavePdq = !dirtyMap.pdq || validatedPanelSignatures.pdq === serializePanelConfig(drafts.pdq);
  const canSaveMail = !dirtyMap.mail || validatedPanelSignatures.mail === serializePanelConfig(drafts.mail);
  const resolvedRequirementOrganizationId = useMemo(() => {
    const draftId = `${drafts.organization?.itopOrganizationId || ""}`.trim();
    if (draftId) return draftId;
    const draftName = `${drafts.organization?.itopOrganizationName || ""}`.trim();
    if (!draftName) return "";
    const match = requirementCatalog.organizations.find((item) => `${item.label || ""}`.trim() === draftName);
    return match ? `${match.value}`.trim() : "";
  }, [drafts.organization?.itopOrganizationId, drafts.organization?.itopOrganizationName, requirementCatalog.organizations]);
  const requirementOrganizationOptions = useMemo(
    () => buildSelectOptions(
      requirementCatalog.organizations,
      loadingRequirementCatalog ? "Cargando organizaciones..." : "Selecciona organizacion",
      resolvedRequirementOrganizationId,
      drafts.organization?.itopOrganizationName || ""
    ),
    [drafts.organization?.itopOrganizationName, loadingRequirementCatalog, requirementCatalog.organizations, resolvedRequirementOrganizationId]
  );
  const requirementOriginOptions = useMemo(
    () => buildSelectOptions(
      requirementCatalog.origins,
      loadingRequirementCatalog ? "Cargando origenes..." : "Selecciona origen",
      drafts.docs?.requirementOrigin || "",
      drafts.docs?.requirementOrigin || ""
    ),
    [drafts.docs?.requirementOrigin, loadingRequirementCatalog, requirementCatalog.origins]
  );
  const requirementServiceOptions = useMemo(
    () => buildSelectOptions(
      requirementCatalog.services,
      loadingRequirementCatalog ? "Cargando categorias..." : "Selecciona categoria",
      drafts.docs?.requirementServiceId || "",
      drafts.docs?.requirementServiceId || ""
    ),
    [drafts.docs?.requirementServiceId, loadingRequirementCatalog, requirementCatalog.services]
  );
  const requirementFilteredSubcategoryCatalog = useMemo(() => {
    const selectedServiceId = `${drafts.docs?.requirementServiceId || ""}`.trim();
    if (!selectedServiceId) return [];
    return requirementCatalog.serviceSubcategories.filter((item) => `${item.serviceId || ""}`.trim() === selectedServiceId);
  }, [drafts.docs?.requirementServiceId, requirementCatalog.serviceSubcategories]);
  const requirementSubcategoryOptions = useMemo(
    () => buildSelectOptions(
      requirementFilteredSubcategoryCatalog,
      loadingRequirementCatalog
        ? "Cargando subcategorias..."
        : drafts.docs?.requirementServiceId
          ? "Selecciona subcategoria"
          : "Selecciona categoria primero",
      drafts.docs?.requirementServiceSubcategoryId || "",
      drafts.docs?.requirementServiceSubcategoryId || ""
    ),
    [drafts.docs?.requirementServiceId, drafts.docs?.requirementServiceSubcategoryId, loadingRequirementCatalog, requirementFilteredSubcategoryCatalog]
  );
  const requirementImpactOptions = useMemo(
    () => buildSelectOptions(
      requirementCatalog.impacts,
      loadingRequirementCatalog ? "Cargando impactos..." : "Selecciona impacto",
      drafts.docs?.requirementImpact || "",
      drafts.docs?.requirementImpact || ""
    ),
    [drafts.docs?.requirementImpact, loadingRequirementCatalog, requirementCatalog.impacts]
  );
  const requirementUrgencyOptions = useMemo(
    () => buildSelectOptions(
      requirementCatalog.urgencies,
      loadingRequirementCatalog ? "Cargando urgencias..." : "Selecciona urgencia",
      drafts.docs?.requirementUrgency || "",
      drafts.docs?.requirementUrgency || ""
    ),
    [drafts.docs?.requirementUrgency, loadingRequirementCatalog, requirementCatalog.urgencies]
  );
  const requirementPriorityOptions = useMemo(
    () => buildSelectOptions(
      requirementCatalog.priorities,
      loadingRequirementCatalog ? "Cargando prioridades..." : "Selecciona prioridad",
      drafts.docs?.requirementPriority || "",
      drafts.docs?.requirementPriority || ""
    ),
    [drafts.docs?.requirementPriority, loadingRequirementCatalog, requirementCatalog.priorities]
  );
  const documentTypePreviewItems = useMemo(() => buildExpectedDocumentTypeItems(drafts.docs || {}), [drafts.docs]);
  const documentTypeStatusItems = useMemo(
    () => buildDocumentTypeStatusItems(documentTypePreviewItems, documentTypeSyncResult, documentTypeAction),
    [documentTypeAction, documentTypePreviewItems, documentTypeSyncResult]
  );
  const updateField = (panelId, field, value, options = {}) => {
    setDrafts((current) => {
      const nextPanel = { ...(current[panelId] || {}), [field]: value };
      if (panelId === "docs" && field === "requirementServiceId" && !options.preserveRequirementSubcategory) {
        nextPanel.requirementServiceSubcategoryId = "";
      }
      if (panelId === "docs" && (field === "itopDocumentTypeStrategy" || field === "itopDocumentTypeBaseName")) {
        nextPanel.itopDocumentTypeIds = {};
      }
      return { ...current, [panelId]: nextPanel };
    });
    if (panelId === "docs" && ["itopDocumentTypeStrategy", "itopDocumentTypeBaseName"].includes(field)) {
      setDocumentTypeSyncResult(null);
    }
  };

  const resetPanel = (panelId) => {
    setDrafts((current) => ({ ...current, [panelId]: panels[panelId] || {} }));
    if (panelId === "docs") {
      setDocumentTypeSyncResult(null);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [settingsPayload, pdqPayload, profilesPayload] = await Promise.all([getSettings(), getPdqStatus(), getSettingsProfiles()]);
      const nextPanels = {
        ...(settingsPayload.panels || {}),
        pdq: {
          ...(settingsPayload?.panels?.pdq || {}),
          databaseFilePath: resolvePdqDatabasePath(settingsPayload?.panels?.pdq?.databaseFilePath, pdqPayload),
        },
      };
      setPanels(nextPanels);
      setDrafts(nextPanels);
      setTasks(settingsPayload.syncTasks || []);
      setTaskMeta(settingsPayload.meta || { syncTaskTypes: [], syncCommandPresets: [] });
      setProfiles(profilesPayload || []);
      setPdqStatus(pdqPayload);
      setPdqModuleEnabled(nextPanels?.pdq?.moduleEnabled !== false);
      setValidatedPanelSignatures({
        itop: "",
        pdq: "",
        mail: "",
      });
      setDocumentTypeSyncResult(null);
      if ((profilesPayload || []).length > 0) {
        setSelectedProfileCode(profilesPayload[0].code);
        setProfileForm(profilesPayload[0]);
      }
      setTaskForm((current) => ({
        ...current,
        taskType: settingsPayload?.meta?.syncTaskTypes?.[0]?.value || current.taskType,
        commandValue: settingsPayload?.meta?.syncCommandPresets?.[0]?.value || current.commandValue,
      }));
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar la configuracion.");
    } finally {
      setLoading(false);
    }
  };

  const refreshPdq = async () => {
    setRefreshingPdq(true);
    try {
      setPdqStatus(await getPdqStatus());
    } catch (loadError) {
      setError(loadError.message || "No fue posible actualizar el estado de PDQ.");
    } finally {
      setRefreshingPdq(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (activeTab !== "requirement" || requirementCatalogLoaded) return;

    let cancelled = false;
    setLoadingRequirementCatalog(true);
    setRequirementCatalogError("");

    getItopRequirementCatalog()
      .then((payload) => {
        if (cancelled) return;
        setRequirementCatalog({
          organizations: payload?.organizations || [],
          origins: payload?.origins || [],
          services: payload?.services || [],
          serviceSubcategories: payload?.serviceSubcategories || [],
          impacts: payload?.impacts || [],
          urgencies: payload?.urgencies || [],
          priorities: payload?.priorities || [],
        });
        setRequirementCatalogLoaded(true);
      })
      .catch((catalogError) => {
        if (cancelled) return;
        setRequirementCatalogError(catalogError.message || "No fue posible cargar los catalogos de iTop.");
        setRequirementCatalogLoaded(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingRequirementCatalog(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, requirementCatalogLoaded]);

  useEffect(() => {
    if (!requirementCatalog.organizations.length) return;
    if (`${drafts.organization?.itopOrganizationId || ""}`.trim()) return;
    const draftName = `${drafts.organization?.itopOrganizationName || ""}`.trim();
    if (!draftName) return;
    const match = requirementCatalog.organizations.find((item) => `${item.label || ""}`.trim() === draftName);
    if (match) {
      updateField("organization", "itopOrganizationId", `${match.value}`.trim());
    }
  }, [drafts.organization?.itopOrganizationId, drafts.organization?.itopOrganizationName, requirementCatalog.organizations]);

  useEffect(() => {
    const currentOrganizationId = `${drafts.organization?.itopOrganizationId || ""}`.trim();
    const currentOrganizationName = `${drafts.organization?.itopOrganizationName || ""}`.trim();
    if (!currentOrganizationId && !currentOrganizationName) return;
    if (!requirementCatalog.organizations.length) return;

    const matchedById = currentOrganizationId
      ? requirementCatalog.organizations.find((item) => `${item.value}`.trim() === currentOrganizationId)
      : null;
    const matchedByName = currentOrganizationName
      ? requirementCatalog.organizations.find((item) => `${item.label || ""}`.trim() === currentOrganizationName)
      : null;

    if (matchedById || matchedByName) return;

    updateField("organization", "itopOrganizationId", "");
    updateField("organization", "itopOrganizationName", "");
  }, [drafts.organization?.itopOrganizationId, drafts.organization?.itopOrganizationName, requirementCatalog.organizations]);

  useEffect(() => {
    const currentServiceId = `${drafts.docs?.requirementServiceId || ""}`.trim();
    if (!currentServiceId || !requirementCatalog.services.length) return;
    if (requirementCatalog.services.some((item) => `${item.value}`.trim() === currentServiceId)) return;
    const match = requirementCatalog.services.find((item) => `${item.label || ""}`.trim() === currentServiceId);
    if (match) {
      updateField("docs", "requirementServiceId", `${match.value}`.trim(), { preserveRequirementSubcategory: true });
    }
  }, [drafts.docs?.requirementServiceId, requirementCatalog.services]);

  useEffect(() => {
    const currentSubcategoryId = `${drafts.docs?.requirementServiceSubcategoryId || ""}`.trim();
    if (!currentSubcategoryId || !requirementCatalog.serviceSubcategories.length) return;
    if (requirementCatalog.serviceSubcategories.some((item) => `${item.value}`.trim() === currentSubcategoryId)) return;
    const match = requirementCatalog.serviceSubcategories.find((item) => `${item.label || ""}`.trim() === currentSubcategoryId);
    if (match) {
      updateField("docs", "requirementServiceSubcategoryId", `${match.value}`.trim());
    }
  }, [drafts.docs?.requirementServiceSubcategoryId, requirementCatalog.serviceSubcategories]);

  useEffect(() => {
    const currentSubcategoryId = `${drafts.docs?.requirementServiceSubcategoryId || ""}`.trim();
    if (!currentSubcategoryId) return;
    if (loadingRequirementCatalog || !requirementCatalogLoaded) return;
    if (!requirementCatalog.serviceSubcategories.length) return;
    if (requirementFilteredSubcategoryCatalog.some((item) => `${item.value}`.trim() === currentSubcategoryId)) return;
    updateField("docs", "requirementServiceSubcategoryId", "");
  }, [
    drafts.docs?.requirementServiceSubcategoryId,
    loadingRequirementCatalog,
    requirementCatalogLoaded,
    requirementCatalog.serviceSubcategories,
    requirementFilteredSubcategoryCatalog,
  ]);

  const persistPanel = async (panelId, config = drafts[panelId] || {}) => {
    const response = await updateSettingsPanel(panelId, config);
    const nextPdqStatus = panelId === "pdq" ? await getPdqStatus() : null;
    const nextConfig = panelId === "pdq"
      ? {
          ...response.config,
          databaseFilePath: resolvePdqDatabasePath(response.config?.databaseFilePath, nextPdqStatus),
        }
      : response.config;
    setDrafts((current) => ({ ...current, [panelId]: nextConfig }));
    setPanels((current) => ({ ...current, [panelId]: nextConfig }));
    if (nextPdqStatus) {
      setPdqStatus(nextPdqStatus);
    }
    if (panelId === "pdq") setPdqModuleEnabled(nextConfig.moduleEnabled !== false);
    if (panelId === "itop" || panelId === "pdq" || panelId === "mail") {
      setValidatedPanelSignatures((current) => ({
        ...current,
        [panelId]: serializePanelConfig(nextConfig),
      }));
    }
    return nextConfig;
  };

  const savePanel = async (panelId, label) => {
    const confirmed = await ModalManager.confirm({
      title: `Guardar ${label}`,
      message: `Se aplicaran los cambios del panel ${label}.`,
      content: "Confirma para persistir esta configuracion en la base de datos del Hub.",
      buttons: { cancel: "Cancelar", confirm: "Guardar" },
    });
    if (!confirmed) return;
    setSavingPanel(panelId);
    try {
      await persistPanel(panelId);
      ModalManager.success({ title: "Configuracion actualizada", message: `El panel ${label} fue guardado correctamente.` });
    } catch (saveError) {
      ModalManager.error({ title: "No fue posible guardar", message: saveError.message || "Ocurrio un error al guardar." });
    } finally {
      setSavingPanel("");
    }
  };

  const resetRequirementPanel = () => {
    resetPanel("docs");
    resetPanel("organization");
  };

  const syncDocumentTypeDraft = (response) => {
    const nextConfig = response?.config || drafts.docs || {};
    setDrafts((current) => ({ ...current, docs: nextConfig }));
    setDocumentTypeSyncResult(response || null);
    return nextConfig;
  };

  const validateDocumentTypesInItop = async () => {
    setDocumentTypeAction("validate");
    try {
      const response = await validateItopDocumentTypes(drafts.docs || {});
      syncDocumentTypeDraft(response);
      if (response.ok) {
        ModalManager.success({
          title: "Tipos documentales validados",
          message: "Todos los tipos documentales esperados existen en iTop. Guarda el panel para persistir la referencia resuelta.",
        });
      } else {
        ModalManager.warning({
          title: "Faltan tipos documentales en iTop",
          message: "La configuracion fue validada, pero aun faltan tipos por crear. Revisa el detalle y usa Crear faltantes si corresponde.",
        });
      }
    } catch (actionError) {
      ModalManager.error({
        title: "No fue posible validar",
        message: actionError.message || "Ocurrio un error al validar los tipos documentales en iTop.",
      });
    } finally {
      setDocumentTypeAction("");
    }
  };

  const createDocumentTypesInItop = async () => {
    const confirmed = await ModalManager.confirm({
      title: "Crear tipos documentales en iTop",
      message: "Se crearan en iTop los tipos documentales faltantes segun la configuracion actual.",
      content: "Esta accion usa tu sesion runtime contra iTop. Luego debes guardar el panel Documentos para persistir los IDs resueltos en el Hub.",
      buttons: { cancel: "Cancelar", confirm: "Crear faltantes" },
    });
    if (!confirmed) return;

    setDocumentTypeAction("create");
    try {
      const response = await createItopDocumentTypes(drafts.docs || {});
      syncDocumentTypeDraft(response);
      ModalManager.success({
        title: "Tipos documentales creados",
        message: response.created?.length
          ? `Se crearon ${response.created.length} tipo(s) documental(es) en iTop. Guarda el panel para dejar la configuracion persistida.`
          : "No habia tipos pendientes por crear. Guarda el panel si quieres persistir los IDs resueltos.",
      });
    } catch (actionError) {
      ModalManager.error({
        title: "No fue posible crear",
        message: actionError.message || "Ocurrio un error al crear los tipos documentales en iTop.",
      });
    } finally {
      setDocumentTypeAction("");
    }
  };

  const saveRequirementPanel = async () => {
    const confirmed = await ModalManager.confirm({
      title: "Guardar Ticket iTop",
      message: "Se aplicaran los cambios del ticket iTop y su contexto organizacional.",
      content: "Confirma para persistir esta configuracion en la base de datos del Hub.",
      buttons: { cancel: "Cancelar", confirm: "Guardar" },
    });
    if (!confirmed) return;
    setSavingPanel("requirement");
    try {
      const organizationDraft = drafts.organization || {};
      const docsDraft = drafts.docs || {};
      const [organizationResponse, docsResponse] = await Promise.all([
        updateSettingsPanel("organization", organizationDraft),
        updateSettingsPanel("docs", docsDraft),
      ]);
      const nextPanels = {
        organization: organizationResponse.config,
        docs: docsResponse.config,
      };
      setPanels((current) => ({ ...current, ...nextPanels }));
      setDrafts((current) => ({ ...current, ...nextPanels }));
      ModalManager.success({ title: "Configuracion actualizada", message: "El panel Ticket iTop fue guardado correctamente." });
    } catch (saveError) {
      ModalManager.error({ title: "No fue posible guardar", message: saveError.message || "Ocurrio un error al guardar." });
    } finally {
      setSavingPanel("");
    }
  };

  const resetTask = () => {
    setEditingTaskId(null);
    setTaskForm({
      ...EMPTY_TASK,
      taskType: taskMeta.syncTaskTypes[0]?.value || EMPTY_TASK.taskType,
      commandValue: taskMeta.syncCommandPresets[0]?.value || EMPTY_TASK.commandValue,
    });
  };

  const saveTask = async () => {
    const confirmed = await ModalManager.confirm({
      title: editingTaskId ? "Actualizar tarea" : "Crear tarea",
      message: editingTaskId ? "Se actualizara la tarea seleccionada." : "Se creara una nueva tarea de sincronizacion.",
      content: "La definicion quedara registrada en la base de datos para futuras automatizaciones.",
      buttons: { cancel: "Cancelar", confirm: editingTaskId ? "Actualizar" : "Crear" },
    });
    if (!confirmed) return;
    setSavingTask(true);
    try {
      const response = editingTaskId ? await updateSyncTask(editingTaskId, taskForm) : await createSyncTask(taskForm);
      setTasks((current) => editingTaskId ? current.map((task) => (task.id === editingTaskId ? response.item : task)) : [response.item, ...current]);
      resetTask();
      ModalManager.success({ title: "Tarea guardada", message: "La tarea de sincronizacion fue persistida correctamente." });
    } catch (taskError) {
      ModalManager.error({ title: "No fue posible guardar la tarea", message: taskError.message || "Ocurrio un error al guardar la tarea." });
    } finally {
      setSavingTask(false);
    }
  };

  const editTask = (task) => {
    setEditingTaskId(task.id);
    setTaskForm({
      schedule: task.schedule,
      description: task.description,
      taskType: task.taskType,
      commandSource: task.commandSource,
      commandValue: task.commandValue,
      isActive: task.isActive,
    });
  };

  const removeTask = async (task) => {
    const confirmed = await ModalManager.confirm({
      title: "Eliminar tarea",
      message: `Se eliminara la tarea "${task.description}".`,
      content: "Esta accion solo remueve la definicion almacenada.",
      buttons: { cancel: "Cancelar", confirm: "Eliminar" },
    });
    if (!confirmed) return;
    try {
      await deleteSyncTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      if (editingTaskId === task.id) resetTask();
      ModalManager.success({ title: "Tarea eliminada", message: "La tarea fue eliminada correctamente." });
    } catch (taskError) {
      ModalManager.error({ title: "No fue posible eliminar la tarea", message: taskError.message || "Ocurrio un error al eliminar." });
    }
  };

  const resetProfileForm = () => {
    if (!selectedProfileCode) {
      setProfileForm({
        ...EMPTY_PROFILE,
        modules: (taskMeta.profileModules || []).map((item) => ({
          moduleCode: item.moduleCode,
          label: item.label,
          canView: false,
          canWrite: false,
        })),
      });
      return;
    }

    const selected = profiles.find((item) => item.code === selectedProfileCode);
    if (selected) {
      setProfileForm(selected);
    }
  };

  const startCreateProfile = () => {
    setSelectedProfileCode("");
    setProfileForm({
      ...EMPTY_PROFILE,
      modules: (taskMeta.profileModules || []).map((item) => ({
        moduleCode: item.moduleCode,
        label: item.label,
        canView: false,
        canWrite: false,
      })),
    });
  };

  const editProfile = (profile) => {
    setSelectedProfileCode(profile.code);
    setProfileForm(profile);
  };

  const saveProfile = async () => {
    const creating = !selectedProfileCode;
    const confirmed = await ModalManager.confirm({
      title: creating ? "Crear perfil" : "Actualizar perfil",
      message: creating
        ? `Se creara el perfil ${profileForm.name || "nuevo"}.`
        : `Se actualizara el perfil ${profileForm.name || profileForm.code}.`,
      content: "Confirma para persistir la configuracion del perfil y sus permisos por modulo.",
      buttons: { cancel: "Cancelar", confirm: creating ? "Crear" : "Guardar" },
    });
    if (!confirmed) return;

    setSavingProfile(true);
    try {
      const response = creating
        ? await createSettingsProfile(profileForm)
        : await updateSettingsProfile(selectedProfileCode, profileForm);
      const saved = response.item;
      setProfiles((current) => {
        if (creating) {
          return [...current, saved].sort((a, b) => a.name.localeCompare(b.name));
        }
        return current.map((item) => (item.code === selectedProfileCode ? saved : item));
      });
      setSelectedProfileCode(saved.code);
      setProfileForm(saved);
      ModalManager.success({
        title: "Perfil guardado",
        message: `El perfil ${saved.name} fue guardado correctamente.`,
      });
    } catch (profileError) {
      ModalManager.error({
        title: "No fue posible guardar el perfil",
        message: profileError.message || "Ocurrio un error al guardar el perfil.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const itopKpis = useMemo(() => {
    const itop = drafts.itop || {};
    const apiPath = buildItopApiPath(itop.integrationUrl);
    const serverLabel = buildItopServerLabel(itop.integrationUrl);
    return [
      { eyebrow: "iTop", value: itop.integrationUrl ? "Configurado" : "Pendiente", status: itop.integrationUrl ? "URL registrada" : "Sin URL", tone: itop.integrationUrl ? "success" : "warning" },
      { eyebrow: "API iTop", value: apiPath ? "Derivada" : "Pendiente", status: serverLabel || "Sin URL base", tone: apiPath ? "success" : "warning" },
      { eyebrow: "Autenticacion", value: "Credenciales iTop", status: "Login validado contra iTop", tone: "success" },
      { eyebrow: "TLS", value: itop.verifySsl ? "Activo" : "Flexible", status: itop.verifySsl ? "Verificacion habilitada" : "Sin validacion SSL", tone: itop.verifySsl ? "success" : "warning" },
    ];
  }, [drafts.itop]);

  if (loading) {
    return <div className="rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-panel)] p-6 shadow-[var(--shadow-subtle)]"><p className="text-sm text-[var(--text-secondary)]">Cargando configuracion del sistema...</p></div>;
  }

  return (
    <div className="grid gap-5">
      <article className="rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-panel)] p-6 shadow-[var(--shadow-subtle)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Parametros funcionales</p>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Configuracion del sistema</h3>
          </div>
          <Button type="button" variant="secondary" onClick={refreshPdq} disabled={refreshingPdq}>{refreshingPdq ? "Actualizando..." : "Actualizar estado"}</Button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]" : "border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error ? <div className="mt-5 rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">{error}</div> : null}

        {activeTab === "itop" ? (
          <div className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{itopKpis.map((item) => <KPI key={item.eyebrow} {...item} />)}</div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="URL de iTop" value={drafts.itop?.integrationUrl || ""} onChange={(e) => updateField("itop", "integrationUrl", e.target.value)} />
              <Field label="Ruta API derivada" value={buildItopApiPath(drafts.itop?.integrationUrl)} onChange={() => {}} readOnly />
              <Field label="Timeout (segundos)" type="number" value={drafts.itop?.timeoutSeconds || 30} onChange={(e) => updateField("itop", "timeoutSeconds", e.target.value)} />
              <Toggle label="Verificar SSL" description="Mantiene la validacion SSL/TLS activa para iTop." checked={Boolean(drafts.itop?.verifySsl)} onChange={(e) => updateField("itop", "verifySsl", e.target.checked)} />
            </div>
            <div className="mt-4 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4 text-sm leading-6 text-[var(--text-secondary)]">
              El login se valida con las credenciales del usuario en iTop. Si son correctas, el Hub recupera el token personal almacenado en backend y desde ahi opera con ese token durante la sesion activa.
            </div>
            <div className="mt-5 rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Sesion y token runtime</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Vigencia sesion iTop-Hub (min)" type="number" value={drafts.itop?.sessionTtlMinutes || 240} onChange={(e) => updateField("itop", "sessionTtlMinutes", e.target.value)} />
                <Field label="Vigencia token desofuscado (min)" type="number" value={drafts.itop?.runtimeTokenTtlMinutes || 60} onChange={(e) => updateField("itop", "runtimeTokenTtlMinutes", e.target.value)} />
                <Field label="Aviso previo expiracion (min)" type="number" value={drafts.itop?.sessionWarningMinutes || 1} onChange={(e) => updateField("itop", "sessionWarningMinutes", e.target.value)} />
              </div>
            </div>
            <Actions
              dirty={dirtyMap.itop}
              saving={savingPanel === "itop"}
              canSave={canSaveItop}
              onReset={() => resetPanel("itop")}
              onSave={() => savePanel("itop", "Integracion iTop")}
              leftContent={(
                <Button
                  type="button"
                  variant="secondary"
                  disabled={testingItop}
                  onClick={async () => {
                    setTestingItop(true);
                    try {
                      const response = await testItopSettings(drafts.itop || {});
                      setValidatedPanelSignatures((current) => ({
                        ...current,
                        itop: serializePanelConfig(drafts.itop),
                      }));
                      ModalManager.success({
                        title: "Conexion iTop correcta",
                        message: (
                          <div className="space-y-3">
                            <p>Conexion validada correctamente con iTop.</p>
                            <div className="flex items-start gap-2">
                              <LinkIcon className="mt-0.5 h-4 w-4 shrink-0" />
                              <span className="break-all">{drafts.itop?.integrationUrl || response.apiUrl || "Sin URL"}</span>
                            </div>
                            <p>
                              Respuesta HTTP {response.statusCode ?? "N/D"} con verificacion SSL{" "}
                              {response.verifySsl ? "habilitada" : "deshabilitada"}.
                            </p>
                          </div>
                        ),
                      });
                    } catch (testError) {
                      ModalManager.error({
                        title: "Conexion iTop fallida",
                        message: testError.message || "No fue posible validar la conectividad con iTop.",
                      });
                    } finally {
                      setTestingItop(false);
                    }
                  }}
                >
                  {testingItop ? "Probando conexion..." : "Test conexion"}
                </Button>
              )}
            />
          </div>
        ) : null}

        {activeTab === "pdq" ? (
          <div className="mt-6 space-y-5">
            {pdqStatus?.database_available === false ? (
              <div className="rounded-[18px] border border-[rgba(214,162,61,0.45)] bg-[rgba(214,162,61,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
                No se encontro la base de datos de PDQ en la ruta configurada. Verifica la ruta completa y el nombre del archivo antes de guardar nuevamente.
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <KPI eyebrow="Modulo" value={drafts.pdq?.moduleEnabled ? "Activo" : "Oculto"} status={drafts.pdq?.moduleEnabled ? "Visible en menu" : "No visible"} tone={drafts.pdq?.moduleEnabled ? "success" : "warning"} />
              <KPI eyebrow="Base SQLite" value={pdqStatus?.database_available ? "Detectada" : "Pendiente"} status={pdqStatus?.database_available ? "OK" : "Sin archivo"} tone={pdqStatus?.database_available ? "success" : "warning"} />
              <KPI eyebrow="Fecha DB" value={fmtDate(pdqRefDate(pdqStatus))} status={pdqStatus?.database_available ? "Archivo detectado" : "Sin referencia"} tone={pdqStatus?.database_available ? "success" : "warning"} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle label="Activar modulo PDQ" description="Controla la visibilidad del modulo PDQ desde el Hub." checked={Boolean(drafts.pdq?.moduleEnabled)} onChange={(e) => updateField("pdq", "moduleEnabled", e.target.checked)} />
              <Field label="Ruta y nombre del archivo base de datos PDQ" value={drafts.pdq?.databaseFilePath || ""} onChange={(e) => updateField("pdq", "databaseFilePath", e.target.value)} />
              <Field label="Nota operacional" rows={4} value={drafts.pdq?.inventoryNote || ""} onChange={() => {}} readOnly />
            </div>
            <Actions
              dirty={dirtyMap.pdq}
              saving={savingPanel === "pdq"}
              canSave={canSavePdq}
              onReset={() => resetPanel("pdq")}
              onSave={() => savePanel("pdq", "PDQ")}
              leftContent={(
                <Button
                  type="button"
                  variant="secondary"
                  disabled={testingPdq}
                  onClick={async () => {
                    setTestingPdq(true);
                    try {
                      const response = await testPdqSettings(drafts.pdq || {});
                      setValidatedPanelSignatures((current) => ({
                        ...current,
                        pdq: serializePanelConfig(drafts.pdq),
                      }));
                      setPdqStatus(response.status || pdqStatus);
                      ModalManager.success({
                        title: "Base PDQ disponible",
                        message: response.message || "La base de datos PDQ fue validada correctamente.",
                      });
                    } catch (testError) {
                      ModalManager.error({
                        title: "Base PDQ no disponible",
                        message: testError.message || "No fue posible validar la base de datos PDQ.",
                      });
                    } finally {
                      setTestingPdq(false);
                    }
                  }}
                >
                  {testingPdq ? "Probando PDQ..." : "Test PDQ"}
                </Button>
              )}
            />
          </div>
        ) : null}

        {activeTab === "sync" ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Ejecucion manual" value={drafts.sync?.manualExecutionLabel || ""} onChange={(e) => updateField("sync", "manualExecutionLabel", e.target.value)} />
              <Field label="Automatizacion" value={drafts.sync?.automationMode || ""} onChange={(e) => updateField("sync", "automationMode", e.target.value)} />
              <Field label="Modo de consulta" value={drafts.sync?.queryMode || ""} onChange={(e) => updateField("sync", "queryMode", e.target.value)} />
              <Field label="Notas del modulo" rows={4} value={drafts.sync?.notes || ""} onChange={(e) => updateField("sync", "notes", e.target.value)} />
            </div>
            <Actions dirty={dirtyMap.sync} saving={savingPanel === "sync"} onReset={() => resetPanel("sync")} onSave={() => savePanel("sync", "Sincronizacion")} />

            <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Gestion de tareas</p>
              <h4 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Tareas programadas del modulo de sincronizacion</h4>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Cada tarea guarda programacion, descripcion, tipo y comando. El comando puede ser predefinido o manual.</p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Programacion" value={taskForm.schedule} onChange={(e) => setTaskForm((c) => ({ ...c, schedule: e.target.value }))} />
                <Field label="Tipo de tarea" value={taskForm.taskType} options={taskMeta.syncTaskTypes} onChange={(e) => setTaskForm((c) => ({ ...c, taskType: e.target.value }))} />
                <Field label="Descripcion" rows={4} value={taskForm.description} onChange={(e) => setTaskForm((c) => ({ ...c, description: e.target.value }))} />
                <Field
                  label="Origen del comando"
                  value={taskForm.commandSource}
                  options={[{ value: "preset", label: "Lista predefinida" }, { value: "manual", label: "Ingreso manual" }]}
                  onChange={(e) => setTaskForm((c) => ({ ...c, commandSource: e.target.value, commandValue: e.target.value === "preset" ? taskMeta.syncCommandPresets[0]?.value || "" : "" }))}
                />
                {taskForm.commandSource === "preset" ? (
                  <Field label="Comando" value={taskForm.commandValue} options={taskMeta.syncCommandPresets} onChange={(e) => setTaskForm((c) => ({ ...c, commandValue: e.target.value }))} />
                ) : (
                  <Field label="Comando manual" value={taskForm.commandValue} onChange={(e) => setTaskForm((c) => ({ ...c, commandValue: e.target.value }))} />
                )}
                <Toggle label="Tarea activa" description="Permite dejar la definicion creada sin activarla aun." checked={taskForm.isActive} onChange={(e) => setTaskForm((c) => ({ ...c, isActive: e.target.checked }))} />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={resetTask} disabled={savingTask}>Limpiar formulario</Button>
                <Button type="button" variant="primary" onClick={saveTask} disabled={savingTask}>{savingTask ? "Guardando..." : editingTaskId ? "Actualizar tarea" : "Crear tarea"}</Button>
              </div>

              <div className="mt-6 space-y-3">
                {tasks.length > 0 ? tasks.map((task) => <TaskCard key={task.id} task={task} onEdit={editTask} onDelete={removeTask} />) : (
                  <div className="rounded-[18px] border border-dashed border-[var(--border-color)] px-4 py-6 text-sm text-[var(--text-secondary)]">Aun no hay tareas registradas en este modulo.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "mail" ? (
          <div className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Remitente visible" value={drafts.mail?.senderName || ""} onChange={(e) => updateField("mail", "senderName", e.target.value)} />
              <Field label="Correo remitente" value={drafts.mail?.senderEmail || ""} onChange={(e) => updateField("mail", "senderEmail", e.target.value)} />
              <Field label="Servidor SMTP" value={drafts.mail?.smtpHost || ""} onChange={(e) => updateField("mail", "smtpHost", e.target.value)} />
              <Field label="Puerto SMTP" value={drafts.mail?.smtpPort || ""} onChange={(e) => updateField("mail", "smtpPort", e.target.value)} />
              <Field
                label="Seguridad"
                value={drafts.mail?.smtpSecurity || "none"}
                options={[
                  { value: "none", label: "Sin seguridad" },
                  { value: "ssl_tls", label: "SSL/TLS" },
                  { value: "starttls", label: "STARTTLS" },
                ]}
                onChange={(e) => updateField("mail", "smtpSecurity", e.target.value)}
              />
              <Field
                label="Formato del correo"
                value={drafts.mail?.mailFormat || "html"}
                options={[
                  { value: "html", label: "HTML" },
                  { value: "txt", label: "Texto plano" },
                ]}
                onChange={(e) => updateField("mail", "mailFormat", e.target.value)}
              />
              <Field label="Pie de correo documental" rows={4} value={drafts.mail?.footerNote || ""} onChange={(e) => updateField("mail", "footerNote", e.target.value)} />
            </div>
            <Actions
              dirty={dirtyMap.mail}
              saving={savingPanel === "mail"}
              canSave={canSaveMail}
              onReset={() => resetPanel("mail")}
              onSave={() => savePanel("mail", "Correo")}
              leftContent={(
                <Button
                  type="button"
                  variant="secondary"
                  disabled={testingMail}
                  onClick={async () => {
                    setTestingMail(true);
                    try {
                      const response = await testMailSettings(drafts.mail || {});
                      setValidatedPanelSignatures((current) => ({
                        ...current,
                        mail: serializePanelConfig(drafts.mail),
                      }));
                      ModalManager.success({
                        title: "Prueba SMTP correcta",
                        message: response.message || "El correo de prueba fue enviado correctamente.",
                      });
                    } catch (testError) {
                      ModalManager.error({
                        title: "Prueba SMTP fallida",
                        message: testError.message || "No fue posible enviar el correo de prueba.",
                      });
                    } finally {
                      setTestingMail(false);
                    }
                  }}
                >
                  {testingMail ? "Probando SMTP..." : "Test SMTP"}
                </Button>
              )}
            />
          </div>
        ) : null}

        {activeTab === "organization" ? (
          <div className="mt-6">
            <div className="grid gap-5 xl:grid-cols-2 xl:items-stretch">
              <div className="flex h-full flex-col rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5 shadow-[var(--shadow-subtle)]">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Identidad base</p>
                <p className="mt-2 text-base font-semibold text-[var(--text-primary)]">Datos institucionales</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Configura el nombre visible del Hub y la sigla corta utilizada en referencias internas.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1.5fr)_220px]">
                  <Field
                    label="Nombre de la organizacion"
                    value={drafts.organization?.organizationName || ""}
                    onChange={(e) => updateField("organization", "organizationName", e.target.value)}
                  />
                  <Field
                    label="Sigla"
                    value={drafts.organization?.organizationAcronym || ""}
                    onChange={(e) => updateField("organization", "organizationAcronym", e.target.value)}
                  />
                </div>
              </div>

              <div className="flex h-full flex-col rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5 shadow-[var(--shadow-subtle)]">
                <div className="flex h-full flex-col">
                  <div>
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Identidad visual</p>
                      <p className="mt-2 text-base font-semibold text-[var(--text-primary)]">Logo institucional</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Este logo se utilizara en la generacion de PDFs y se almacena dentro de la configuracion del Hub.
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)]">
                        Cargar logo
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const dataUrl = await readFileAsDataUrl(file);
                              setDrafts((current) => ({
                                ...current,
                                organization: {
                                  ...(current.organization || {}),
                                  organizationLogoUpload: dataUrl,
                                  organizationLogoRemoved: false,
                                  organizationLogoUrl: dataUrl,
                                },
                              }));
                            } catch (uploadError) {
                              ModalManager.error({
                                title: "No fue posible cargar el logo",
                                message: uploadError.message || "Ocurrio un error al leer el archivo.",
                              });
                            } finally {
                              e.target.value = "";
                            }
                          }}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!drafts.organization?.organizationLogoUrl}
                        onClick={() => setDrafts((current) => ({
                          ...current,
                          organization: {
                            ...(current.organization || {}),
                            organizationLogoUpload: "",
                            organizationLogoRemoved: true,
                            organizationLogoUrl: "",
                            organizationLogoPath: "",
                            organizationLogoVersion: "",
                          },
                        }))}
                      >
                        Quitar logo
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 flex min-h-[240px] flex-1 items-center justify-center rounded-[20px] border border-[var(--border-color)] bg-[linear-gradient(180deg,rgba(81,152,194,0.08),rgba(81,152,194,0.03))] p-5">
                    {drafts.organization?.organizationLogoUrl ? (
                      <img
                        src={drafts.organization.organizationLogoUrl}
                        alt={drafts.organization?.organizationName || "Logo organizacion"}
                        className="max-h-[140px] max-w-full object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.18)]"
                      />
                    ) : (
                      <div className="max-w-[260px] text-center">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Aun no hay logo institucional</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                          Cuando cargues uno, esta vista te mostrara la referencia visual que se utilizara en los PDFs del Hub.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <Actions
              dirty={dirtyMap.organization}
              saving={savingPanel === "organization"}
              onReset={() => resetPanel("organization")}
              onSave={() => savePanel("organization", "Organizacion")}
            />
          </div>
        ) : null}

        {activeTab === "qr" ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Firma QR móvil</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Controla la URL pública, vigencia del QR y las reglas de uso para la firma digital desde dispositivos móviles.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={Boolean(drafts.qr?.enabled)}
                      onChange={(e) => updateField("qr", "enabled", e.target.checked)}
                      className="accent-[var(--accent-strong)]"
                    />
                    Activar
                  </label>
                </div>

                <div className={`${drafts.qr?.enabled ? "" : "pointer-events-none opacity-50"} mt-4 grid gap-4`}>
                  <Field
                    label="URL pública del Hub"
                    value={drafts.qr?.hubPublicBaseUrl || ""}
                    onChange={(e) => updateField("qr", "hubPublicBaseUrl", e.target.value)}
                  />
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field
                      label="Ruta pública"
                      value={drafts.qr?.sessionRoutePath || "firma/h"}
                      onChange={(e) => updateField("qr", "sessionRoutePath", e.target.value)}
                    />
                    <Field
                      label="Vigencia QR (min)"
                      type="number"
                      value={String(drafts.qr?.sessionTtlMinutes || 20)}
                      onChange={(e) => updateField("qr", "sessionTtlMinutes", e.target.value)}
                    />
                    <Toggle
                      label="Bloqueo por dispositivo"
                      description="El primer móvil que abra el QR reserva la sesión hasta firmar o expirar."
                      checked={Boolean(drafts.qr?.singleDeviceLock)}
                      onChange={(e) => updateField("qr", "singleDeviceLock", e.target.checked)}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Toggle
                      label="Mostrar documento detalle"
                      description="Permite revisar el documento complementario desde la vista móvil."
                      checked={Boolean(drafts.qr?.allowDetailDocumentPreview)}
                      onChange={(e) => updateField("qr", "allowDetailDocumentPreview", e.target.checked)}
                    />
                  </div>
                  <Field
                    label="Mensaje al firmar"
                    rows={3}
                    value={drafts.qr?.successMessage || ""}
                    onChange={(e) => updateField("qr", "successMessage", e.target.value)}
                  />
                  <Field
                    label="Indicacion final"
                    rows={2}
                    value={drafts.qr?.completionHint || ""}
                    onChange={(e) => updateField("qr", "completionHint", e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Resumen operacional</p>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Branding móvil</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      La vista móvil usa el nombre y logo configurados en el panel Organizacion.
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Ejemplo de ruta</p>
                    <p className="mt-1 break-all text-sm font-semibold text-[var(--text-primary)]">
                      {drafts.qr?.hubPublicBaseUrl
                        ? `${String(drafts.qr.hubPublicBaseUrl).replace(/\/+$/, "")}/${String(drafts.qr?.sessionRoutePath || "firma/h").replace(/^\/+|\/+$/g, "")}/TOKEN`
                        : "Configura primero la URL pública del Hub"}
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Uso recomendado</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Usa un dominio o IP alcanzable desde el móvil del destinatario. Evita `localhost` o rutas locales del navegador.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <Actions
              dirty={dirtyMap.qr}
              saving={savingPanel === "qr"}
              onReset={() => resetPanel("qr")}
              onSave={() => savePanel("qr", "Firma QR")}
            />
          </div>
        ) : null}

        {activeTab === "docs" ? (
          <div className="mt-6">
            <div className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-4 xl:items-stretch">
                <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5 xl:col-span-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Numeracion documental</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Define prefijos y formato base de folios para los distintos documentos del Hub.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Prefijo actas entrega" value={drafts.docs?.handoverPrefix || ""} onChange={(e) => updateField("docs", "handoverPrefix", e.target.value)} />
                    <Field label="Prefijo actas devolucion" value={drafts.docs?.handoverReturnPrefix || ""} onChange={(e) => updateField("docs", "handoverReturnPrefix", e.target.value)} />
                    <Field label="Prefijo actas reasignacion" value={drafts.docs?.handoverReassignmentPrefix || ""} onChange={(e) => updateField("docs", "handoverReassignmentPrefix", e.target.value)} />
                    <Field label="Prefijo actas normalizacion" value={drafts.docs?.handoverNormalizationPrefix || ""} onChange={(e) => updateField("docs", "handoverNormalizationPrefix", e.target.value)} />
                    <Field label="Prefijo actas laboratorio" value={drafts.docs?.handoverLaboratoryPrefix || ""} onChange={(e) => updateField("docs", "handoverLaboratoryPrefix", e.target.value)} />
                    <Field label="Formato numeracion" value={drafts.docs?.numberingFormat || ""} onChange={(e) => updateField("docs", "numberingFormat", e.target.value)} />
                  </div>
                </div>

                <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5 xl:col-span-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Evidencias</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Controla la carga de documentos firmados y los tipos permitidos para el cierre operativo.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={Boolean(drafts.docs?.allowEvidenceUpload)}
                        onChange={(e) => updateField("docs", "allowEvidenceUpload", e.target.checked)}
                        className="accent-[var(--accent-strong)]"
                      />
                      Activar
                    </label>
                  </div>
                  <div className={`${drafts.docs?.allowEvidenceUpload ? "" : "pointer-events-none opacity-50"} mt-4 grid gap-4`}>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Tipos permitidos para evidencia</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Selecciona las extensiones admitidas para la carga manual de evidencias en documentos.
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {EVIDENCE_EXTENSION_OPTIONS.map((item) => (
                          <label key={item.value} className="rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                            <input
                              type="checkbox"
                              checked={Boolean(drafts.docs?.evidenceAllowedExtensions?.includes(item.value))}
                              onChange={(e) => {
                                const current = drafts.docs?.evidenceAllowedExtensions || [];
                                const next = e.target.checked ? [...current, item.value] : current.filter((value) => value !== item.value);
                                updateField("docs", "evidenceAllowedExtensions", next);
                              }}
                              className="mr-3 accent-[var(--accent-strong)]"
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Parametrizacion PDF</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Configura estructura visual, tamano de pagina y margenes del documento generado.
                </p>
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
                  <div className="grid gap-4">
                    <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Formato de hoja</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Selecciona el tamano base y define rapidamente el espacio util del documento.
                      </p>
                      <div className="mt-4 w-full">
                        <FilterDropdown
                          label="Tamano de pagina"
                          selectedValues={drafts.docs?.pageSize ? [drafts.docs.pageSize] : ["A4"]}
                          options={[
                            { value: "A4", label: "A4 (210 x 297 mm)" },
                            { value: "LETTER", label: "Letter (216 x 279 mm)" },
                            { value: "LEGAL", label: "Legal (216 x 356 mm)" },
                          ]}
                          selectionMode="single"
                          onToggleOption={(value) => updateField("docs", "pageSize", value)}
                          onClear={() => updateField("docs", "pageSize", "A4")}
                          title="Tamano de pagina"
                          description="Selecciona un formato base para la hoja del PDF."
                          iconName="sliders"
                          renderSelection={renderSingleSelection}
                          getOptionClassName={getSettingsFilterOptionClassName}
                        />
                      </div>
                      <div className="mt-4 rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                        <div className="grid grid-cols-3 items-center gap-3">
                          <div />
                          <div>
                            <Field label="Superior (mm)" type="number" value={String(drafts.docs?.marginTopMm ?? 12)} onChange={(e) => updateField("docs", "marginTopMm", e.target.value)} inputClassName="text-center" />
                          </div>
                          <div />
                          <div>
                            <Field label="Izquierdo (mm)" type="number" value={String(drafts.docs?.marginLeftMm ?? 12)} onChange={(e) => updateField("docs", "marginLeftMm", e.target.value)} inputClassName="text-center" />
                          </div>
                          <div className="flex min-h-[176px] items-center justify-center rounded-[18px] border border-dashed border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(81,152,194,0.08),rgba(81,152,194,0.03))] px-4 text-center">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Area util</p>
                              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{drafts.docs?.pageSize || "A4"}</p>
                              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                                El contenido del PDF se distribuira dentro de este espacio considerando los margenes configurados.
                              </p>
                            </div>
                          </div>
                          <div>
                            <Field label="Derecho (mm)" type="number" value={String(drafts.docs?.marginRightMm ?? 12)} onChange={(e) => updateField("docs", "marginRightMm", e.target.value)} inputClassName="text-center" />
                          </div>
                          <div />
                          <div>
                            <Field label="Inferior (mm)" type="number" value={String(drafts.docs?.marginBottomMm ?? 18)} onChange={(e) => updateField("docs", "marginBottomMm", e.target.value)} inputClassName="text-center" />
                          </div>
                          <div />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">Cabecera</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            Define si el documento mostrara banda superior y que datos institucionales incluira.
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">
                          <input
                            type="checkbox"
                            checked={Boolean(drafts.docs?.showHeader)}
                            onChange={(e) => updateField("docs", "showHeader", e.target.checked)}
                            className="accent-[var(--accent-strong)]"
                          />
                          Activar
                        </label>
                      </div>
                      <div className={`${drafts.docs?.showHeader ? "" : "pointer-events-none opacity-50"} mt-4 grid gap-3 md:grid-cols-2`}>
                        <Toggle
                          label="Mostrar logo"
                          description="Usa el logo configurado en Organizacion."
                          checked={Boolean(drafts.docs?.headerShowLogo)}
                          onChange={(e) => updateField("docs", "headerShowLogo", e.target.checked)}
                        />
                        <Toggle
                          label="Mostrar nombre organizacional"
                          description="Incluye el nombre de la organizacion en el encabezado."
                          checked={Boolean(drafts.docs?.headerShowOrganizationName)}
                          onChange={(e) => updateField("docs", "headerShowOrganizationName", e.target.checked)}
                        />
                        <label className="md:col-span-2 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4">
                          <span className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={Boolean(drafts.docs?.handoverDocumentLegendEnabled)}
                              onChange={(e) => updateField("docs", "handoverDocumentLegendEnabled", e.target.checked)}
                              className="mt-1 h-4 w-4 accent-[var(--accent-strong)]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-[var(--text-primary)]">Mostrar leyenda documental</span>
                              <span className={`${drafts.docs?.handoverDocumentLegendEnabled ? "" : "pointer-events-none opacity-50"} mt-3 block`}>
                                <Field
                                 rows={2}
                                  value={drafts.docs?.handoverDocumentLegendText || ""}
                                  onChange={(e) => updateField("docs", "handoverDocumentLegendText", e.target.value)}
                                />
                              </span>
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">Pie de pagina</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            Controla la trazabilidad y referencias visibles al final del documento.
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">
                          <input
                            type="checkbox"
                            checked={Boolean(drafts.docs?.showFooter)}
                            onChange={(e) => updateField("docs", "showFooter", e.target.checked)}
                            className="accent-[var(--accent-strong)]"
                          />
                          Activar
                        </label>
                      </div>
                      <div className={`${drafts.docs?.showFooter ? "" : "pointer-events-none opacity-50"} mt-4 grid gap-3 md:grid-cols-3`}>
                        <Toggle
                          label="Nombre organizacional"
                          description="Muestra la organizacion en el pie."
                          checked={Boolean(drafts.docs?.footerShowOrganizationName)}
                          onChange={(e) => updateField("docs", "footerShowOrganizationName", e.target.checked)}
                        />
                        <Toggle
                          label="Folio"
                          description="Muestra el folio del legajo."
                          checked={Boolean(drafts.docs?.footerShowFolio)}
                          onChange={(e) => updateField("docs", "footerShowFolio", e.target.checked)}
                        />
                        <Toggle
                          label="Numero de pagina"
                          description="Muestra paginacion X / Y."
                          checked={Boolean(drafts.docs?.footerShowPageNumber)}
                          onChange={(e) => updateField("docs", "footerShowPageNumber", e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Tipo documental iTop</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Define como el Hub resolvera o creara el `DocumentType` de iTop para las actas sincronizadas.
                  </p>
                </div>
                <div className="rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                  {drafts.docs?.itopDocumentTypeStrategy === "per_type" ? "Uno por tipo" : "Tipo unico"}
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(240px,0.7fr)_minmax(240px,0.7fr)_minmax(0,1.1fr)]">
                  <Field
                    label="Estrategia documental"
                    value={drafts.docs?.itopDocumentTypeStrategy || "single"}
                    options={HANDOVER_DOCUMENT_TYPE_STRATEGY_OPTIONS}
                    onChange={(e) => updateField("docs", "itopDocumentTypeStrategy", e.target.value)}
                  />
                  <Field
                    label="Nombre base"
                    value={drafts.docs?.itopDocumentTypeBaseName || "Acta"}
                    onChange={(e) => updateField("docs", "itopDocumentTypeBaseName", e.target.value)}
                  />
                  <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Validacion y provision</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Valida la existencia en iTop y, si faltan tipos, puedes crearlos desde aqui antes de guardar el panel.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={documentTypeAction === "validate" || documentTypeAction === "create"}
                        onClick={validateDocumentTypesInItop}
                      >
                        {documentTypeAction === "validate" ? "Validando..." : "Validar en iTop"}
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        disabled={documentTypeAction === "validate" || documentTypeAction === "create"}
                        onClick={createDocumentTypesInItop}
                      >
                        {documentTypeAction === "create" ? "Creando..." : "Crear faltantes"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Tipos documentales esperados</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Cada tarjeta muestra el nombre esperado y su semaforo de validacion en iTop.
                      </p>
                    </div>
                    {documentTypeSyncResult ? (
                      <span className={`inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] ${
                        documentTypeSyncResult.ok
                          ? "bg-[rgba(109,204,146,0.12)] text-[var(--success)]"
                          : "bg-[rgba(220,171,78,0.12)] text-[var(--warning)]"
                      }`}>
                        {documentTypeSyncResult.ok ? "Completo" : "Revision pendiente"}
                      </span>
                    ) : null}
                  </div>

                  <div className={`mt-4 grid gap-3 ${drafts.docs?.itopDocumentTypeStrategy === "per_type" ? "md:grid-cols-2" : ""}`}>
                    {documentTypeStatusItems.map((item) => {
                      const statusStyles = {
                        success: {
                          dot: "bg-[var(--success)]",
                          pill: "bg-[rgba(109,204,146,0.12)] text-[var(--success)]",
                        },
                        warning: {
                          dot: "bg-[var(--warning)]",
                          pill: "bg-[rgba(220,171,78,0.12)] text-[var(--warning)]",
                        },
                        danger: {
                          dot: "bg-[var(--danger)]",
                          pill: "bg-[rgba(210,138,138,0.12)] text-[var(--danger)]",
                        },
                        neutral: {
                          dot: "bg-[var(--text-muted)]",
                          pill: "bg-[var(--bg-app)] text-[var(--text-secondary)]",
                        },
                      }[item.statusTone];

                      return (
                        <div key={item.key} className="rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{item.typeLabel}</p>
                              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{item.documentTypeName}</p>
                              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                ID: {item.documentTypeId || "Pendiente"}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] ${statusStyles.pill}`}>
                              <span className={`h-2.5 w-2.5 rounded-full ${statusStyles.dot}`} aria-hidden="true" />
                              {item.statusLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {documentTypeSyncResult?.created?.length ? (
                    <div className="mt-4 rounded-[16px] border border-[rgba(109,204,146,0.24)] bg-[rgba(109,204,146,0.08)] px-4 py-4 text-sm text-[var(--text-primary)]">
                      Se crearon: {documentTypeSyncResult.created.map((item) => item.documentTypeName).join(", ")}.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Pie Acta</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Texto que aparece al pie del acta de asignacion, bajo las firmas.</p>
              <div className="mt-4">
                <Field label="Mensaje pie de acta" rows={3} value={drafts.docs?.handoverFooterNote || ""} onChange={(e) => updateField("docs", "handoverFooterNote", e.target.value)} />
              </div>
            </div>
            <Actions dirty={dirtyMap.docs} saving={savingPanel === "docs"} onReset={() => resetPanel("docs")} onSave={() => savePanel("docs", "Documentos")} />
          </div>
        ) : null}

        {activeTab === "requirement" ? (
          <div className="mt-6">
            <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Ticket iTop</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Parametriza el ticket iTop que se utilizara cuando el proceso de acta requiera crear un requerimiento.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={Boolean(drafts.docs?.requirementEnabled)}
                    onChange={(e) => updateField("docs", "requirementEnabled", e.target.checked)}
                    className="accent-[var(--accent-strong)]"
                  />
                  Activar
                </label>
              </div>
              <div className={`${drafts.docs?.requirementEnabled ? "" : "pointer-events-none opacity-50"} mt-4 grid gap-4 xl:grid-cols-2`}>
                {loadingRequirementCatalog ? (
                  <div className="rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-secondary)] xl:col-span-2">
                    Cargando catalogos de iTop para el ticket iTop...
                  </div>
                ) : null}
                {requirementCatalogError ? (
                  <div className="rounded-[16px] border border-[rgba(214,106,106,0.22)] bg-[rgba(214,106,106,0.08)] px-4 py-3 text-sm text-[var(--text-secondary)] xl:col-span-2">
                    {requirementCatalogError}
                  </div>
                ) : null}
                <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[14px] border border-[rgba(81,152,194,0.22)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      <LinkIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Organizacion y clase</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        Base estructural del requerimiento que se enviara a iTop.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <Field
                      label="Nombre organizacion iTop"
                      value={resolvedRequirementOrganizationId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const selectedOrganization = requirementCatalog.organizations.find((item) => `${item.value}`.trim() === selectedId);
                        updateField("organization", "itopOrganizationId", selectedId);
                        updateField("organization", "itopOrganizationName", selectedOrganization?.label || "");
                      }}
                      options={requirementOrganizationOptions}
                    />
                    <Field
                      label="Clase de ticket"
                      value={drafts.docs?.requirementTicketClass || "UserRequest"}
                      onChange={(e) => updateField("docs", "requirementTicketClass", e.target.value)}
                      options={REQUIREMENT_TICKET_CLASS_OPTIONS}
                    />
                    <Field
                      label="Estado inicial"
                      value={drafts.docs?.requirementInitialStatus || "assigned"}
                      onChange={(e) => updateField("docs", "requirementInitialStatus", e.target.value)}
                      options={REQUIREMENT_INITIAL_STATUS_OPTIONS}
                    />
                  </div>
                </div>

                <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[14px] border border-[rgba(81,152,194,0.22)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      <FolderTree className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Categorizacion</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        Define la categoria y subcategoria que usara el ticket para su clasificacion.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <Field
                      label="Categoria"
                      value={drafts.docs?.requirementServiceId || ""}
                      onChange={(e) => updateField("docs", "requirementServiceId", e.target.value)}
                      options={requirementServiceOptions}
                    />
                    <Field
                      label="SubCategoria"
                      value={drafts.docs?.requirementServiceSubcategoryId || ""}
                      onChange={(e) => updateField("docs", "requirementServiceSubcategoryId", e.target.value)}
                      options={requirementSubcategoryOptions}
                      disabled={!drafts.docs?.requirementServiceId}
                    />
                  </div>
                </div>

                <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[14px] border border-[rgba(81,152,194,0.22)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Datos del ticket</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        Define el contenido visible del requerimiento que se creara en iTop.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <Field
                      label="Origen"
                      value={drafts.docs?.requirementOrigin || ""}
                      onChange={(e) => updateField("docs", "requirementOrigin", e.target.value)}
                      options={requirementOriginOptions}
                      disabled={!loadingRequirementCatalog && requirementCatalog.origins.length === 0}
                    />
                    <Field
                      label="Asunto"
                      value={drafts.docs?.requirementSubject || ""}
                      onChange={(e) => updateField("docs", "requirementSubject", e.target.value)}
                    />
                    <Field
                      label="Descripcion"
                      rows={4}
                      value={drafts.docs?.requirementTicketTemplate || ""}
                      onChange={(e) => updateField("docs", "requirementTicketTemplate", e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[14px] border border-[rgba(81,152,194,0.22)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      <CircleAlert className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Criticidad</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        Valores base para prioridad operativa del ticket en iTop.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <Field
                      label="Impacto"
                      value={drafts.docs?.requirementImpact || ""}
                      onChange={(e) => updateField("docs", "requirementImpact", e.target.value)}
                      options={requirementImpactOptions}
                      disabled={!loadingRequirementCatalog && requirementCatalog.impacts.length === 0}
                    />
                    <Field
                      label="Urgencia"
                      value={drafts.docs?.requirementUrgency || ""}
                      onChange={(e) => updateField("docs", "requirementUrgency", e.target.value)}
                      options={requirementUrgencyOptions}
                      disabled={!loadingRequirementCatalog && requirementCatalog.urgencies.length === 0}
                    />
                    <Field
                      label="Prioridad"
                      value={drafts.docs?.requirementPriority || ""}
                      onChange={(e) => updateField("docs", "requirementPriority", e.target.value)}
                      options={requirementPriorityOptions}
                      disabled={!loadingRequirementCatalog && requirementCatalog.priorities.length === 0}
                    />
                  </div>
                </div>
              </div>
            </div>
            <Actions
              dirty={dirtyMap.docs || dirtyMap.organization}
              saving={savingPanel === "requirement"}
              onReset={resetRequirementPanel}
              onSave={saveRequirementPanel}
            />
          </div>
        ) : null}

        {activeTab === "cmdb" ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Alcance actual</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {CMDB_OPTIONS.map((item) => (
                  <label key={item} className="rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={Boolean(drafts.cmdb?.enabledAssetTypes?.includes(item))}
                      onChange={(e) => {
                        const current = drafts.cmdb?.enabledAssetTypes || [];
                        const next = e.target.checked ? [...current, item] : current.filter((value) => value !== item);
                        updateField("cmdb", "enabledAssetTypes", next);
                      }}
                      className="mr-3 accent-[var(--accent-strong)]"
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle
                label="Mostrar equipos obsoletos"
                description="Permite incluir activos con estado Obsoleto en Assets y en los objetos CMDB visibles dentro de Personas."
                checked={Boolean(drafts.cmdb?.showObsoleteAssets)}
                onChange={(e) => updateField("cmdb", "showObsoleteAssets", e.target.checked)}
              />
              <Toggle
                label="Mostrar equipos en implementacion"
                description="Permite incluir activos con estado interno iTop Implementation, tratados como no productivos, en Assets y en los objetos CMDB visibles dentro de Personas."
                checked={Boolean(drafts.cmdb?.showImplementationAssets)}
                onChange={(e) => updateField("cmdb", "showImplementationAssets", e.target.checked)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Estado al generar acta de devolucion</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Define el estado CMDB que debe usarse como destino cuando se implemente el flujo operacional de devolucion.
                  </p>
                </div>
                <div className="mt-4">
                  <Field
                    label="Estado destino"
                    value={drafts.cmdb?.handoverReturnAssetStatus || "stock"}
                    onChange={(e) => updateField("cmdb", "handoverReturnAssetStatus", e.target.value)}
                    options={HANDOVER_RETURN_ASSET_STATUS_OPTIONS}
                  />
                </div>
              </div>
              <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Alerta de vencimiento</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Define la anticipacion, en dias, para advertir vencimientos de garantia en vistas que consumen esta regla CMDB.
                  </p>
                </div>
                <div className="mt-4">
                  <Field
                    label="Dias de alerta"
                    type="number"
                    value={String(drafts.cmdb?.warrantyAlertDays || 30)}
                    onChange={(e) => updateField("cmdb", "warrantyAlertDays", e.target.value)}
                  />
                </div>
              </div>
            </div>
            <Actions dirty={dirtyMap.cmdb} saving={savingPanel === "cmdb"} onReset={() => resetPanel("cmdb")} onSave={() => savePanel("cmdb", "CMDB")} />
          </div>
        ) : null}

        {activeTab === "profiles" ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-subtle)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Configuracion</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">Perfiles disponibles</p>
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={startCreateProfile}>
                    Nuevo perfil
                  </Button>
                </div>
                <div className="mt-4 space-y-3">
                  {profiles.map((profile) => (
                    <ProfileCard
                      key={profile.code}
                      profile={profile}
                      active={selectedProfileCode === profile.code}
                      onClick={() => editProfile(profile)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <section className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow-subtle)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Perfil
                      </p>
                      <h4 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Datos base y descripcion</h4>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        Define identidad, estado y alcance administrativo del perfil seleccionado.
                      </p>
                    </div>
                    <SectionToggleButton
                      isCollapsed={collapsedProfileSections.details}
                      onClick={() => setCollapsedProfileSections((current) => ({ ...current, details: !current.details }))}
                      collapsedLabel="Expandir perfil"
                      expandedLabel="Colapsar perfil"
                    />
                  </div>

                  {!collapsedProfileSections.details ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Codigo perfil" value={profileForm.code || ""} onChange={(e) => setProfileForm((c) => ({ ...c, code: e.target.value }))} readOnly={Boolean(selectedProfileCode)} />
                      <Field label="Nombre perfil" value={profileForm.name || ""} onChange={(e) => setProfileForm((c) => ({ ...c, name: e.target.value }))} />
                      <Field label="Estado" value={profileForm.status || "active"} options={[{ value: "active", label: "Activo" }, { value: "inactive", label: "Inactivo" }]} onChange={(e) => setProfileForm((c) => ({ ...c, status: e.target.value }))} />
                      <Toggle label="Perfil administrador" description="Permite que el perfil sea tratado como administrador del Hub." checked={Boolean(profileForm.isAdmin)} onChange={(e) => setProfileForm((c) => ({ ...c, isAdmin: e.target.checked }))} />
                      <Field label="Descripcion" rows={4} value={profileForm.description || ""} onChange={(e) => setProfileForm((c) => ({ ...c, description: e.target.value }))} />
                    </div>
                  ) : null}
                </section>

                <section className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow-subtle)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Permisos
                      </p>
                      <h4 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Acceso por modulo</h4>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        Gestiona visibilidad y edicion en una tabla simple, separada de la identidad del perfil.
                      </p>
                    </div>
                    <SectionToggleButton
                      isCollapsed={collapsedProfileSections.permissions}
                      onClick={() => setCollapsedProfileSections((current) => ({ ...current, permissions: !current.permissions }))}
                      collapsedLabel="Expandir permisos"
                      expandedLabel="Colapsar permisos"
                    />
                  </div>

                  {!collapsedProfileSections.permissions ? (
                    <div className="mt-4 overflow-hidden rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)]">
                      <div className="grid grid-cols-[minmax(0,1.8fr)_120px_120px_120px] bg-[var(--bg-hover)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        <span>Modulo</span>
                        <span className="text-center">Sin acceso</span>
                        <span className="text-center">Lectura</span>
                        <span className="text-center">Edicion</span>
                      </div>
                      <div className="divide-y divide-[var(--border-color)]">
                        {(profileForm.modules || []).map((module, index) => (
                          <div
                            key={module.moduleCode}
                            className={`grid grid-cols-[minmax(0,1.8fr)_120px_120px_120px] items-center px-4 py-3 ${
                              index % 2 === 0 ? "bg-[var(--bg-app)]" : "bg-[var(--bg-hover)]"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{module.label}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{module.moduleCode}</p>
                            </div>
                            <div className="flex justify-center">
                              <input
                                type="radio"
                                name={`module-access-${module.moduleCode}`}
                                checked={getModuleAccessLevel(module) === "none"}
                                onChange={(e) => setProfileForm((current) => ({
                                  ...current,
                                  modules: current.modules.map((item) =>
                                    item.moduleCode === module.moduleCode
                                      ? setModuleAccessLevel(item, e.target.value)
                                      : item
                                  ),
                                }))}
                                value="none"
                                className="h-4 w-4 accent-[var(--accent-strong)]"
                              />
                            </div>
                            <div className="flex justify-center">
                              <input
                                type="radio"
                                name={`module-access-${module.moduleCode}`}
                                checked={getModuleAccessLevel(module) === "read"}
                                onChange={(e) => setProfileForm((current) => ({
                                  ...current,
                                  modules: current.modules.map((item) =>
                                    item.moduleCode === module.moduleCode
                                      ? setModuleAccessLevel(item, e.target.value)
                                      : item
                                  ),
                                }))}
                                value="read"
                                className="h-4 w-4 accent-[var(--accent-strong)]"
                              />
                            </div>
                            <div className="flex justify-center">
                              <input
                                type="radio"
                                name={`module-access-${module.moduleCode}`}
                                checked={getModuleAccessLevel(module) === "write"}
                                onChange={(e) => setProfileForm((current) => ({
                                  ...current,
                                  modules: current.modules.map((item) =>
                                    item.moduleCode === module.moduleCode
                                      ? setModuleAccessLevel(item, e.target.value)
                                      : item
                                  ),
                                }))}
                                value="write"
                                className="h-4 w-4 accent-[var(--accent-strong)]"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>

            <div className="sticky bottom-0 z-10">
              <Actions
                dirty
                saving={savingProfile}
                onReset={resetProfileForm}
                onSave={saveProfile}
              />
            </div>
          </div>
        ) : null}
      </article>
    </div>
  );
}
