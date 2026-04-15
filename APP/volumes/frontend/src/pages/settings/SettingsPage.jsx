import { useEffect, useMemo, useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import ModalManager from "../../components/ui/modal";
import { Button } from "../../ui/Button";
import { setPdqModuleEnabled } from "../../services/module-visibility-service";
import { getPdqStatus } from "../../services/pdq-service";
import {
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
} from "../../services/settings-service";

const TABS = [
  { id: "itop", label: "Integracion iTop" },
  { id: "pdq", label: "PDQ" },
  { id: "sync", label: "Sincronizacion" },
  { id: "mail", label: "Correo" },
  { id: "docs", label: "Documentos" },
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

function Field({ label, value, onChange, type = "text", rows = 0, options = null, readOnly = false }) {
  const base = "w-full rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none";
  return (
    <label className={rows ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">{label}</span>
      {options ? (
        <select value={value} onChange={onChange} className={base}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : rows ? (
        <textarea rows={rows} value={value} onChange={onChange} readOnly={readOnly} className={base} />
      ) : (
        <input type={type} value={value} onChange={onChange} readOnly={readOnly} className={base} />
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

  const dirtyMap = useMemo(
    () => TABS.reduce((acc, tab) => ({ ...acc, [tab.id]: JSON.stringify(drafts[tab.id] || {}) !== JSON.stringify(panels[tab.id] || {}) }), {}),
    [drafts, panels]
  );

  const canSaveItop = !dirtyMap.itop || validatedPanelSignatures.itop === serializePanelConfig(drafts.itop);
  const canSavePdq = !dirtyMap.pdq || validatedPanelSignatures.pdq === serializePanelConfig(drafts.pdq);
  const canSaveMail = !dirtyMap.mail || validatedPanelSignatures.mail === serializePanelConfig(drafts.mail);

  const updateField = (panelId, field, value) => {
    setDrafts((current) => ({ ...current, [panelId]: { ...(current[panelId] || {}), [field]: value } }));
  };

  const resetPanel = (panelId) => {
    setDrafts((current) => ({ ...current, [panelId]: panels[panelId] || {} }));
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
      const response = await updateSettingsPanel(panelId, drafts[panelId] || {});
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
      ModalManager.success({ title: "Configuracion actualizada", message: `El panel ${label} fue guardado correctamente.` });
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

        {activeTab === "docs" ? (
          <div className="mt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Prefijo actas entrega" value={drafts.docs?.handoverPrefix || ""} onChange={(e) => updateField("docs", "handoverPrefix", e.target.value)} />
              <Field label="Prefijo actas recepcion" value={drafts.docs?.receptionPrefix || ""} onChange={(e) => updateField("docs", "receptionPrefix", e.target.value)} />
              <Field label="Prefijo laboratorio" value={drafts.docs?.laboratoryPrefix || ""} onChange={(e) => updateField("docs", "laboratoryPrefix", e.target.value)} />
              <Field label="Formato numeracion" value={drafts.docs?.numberingFormat || ""} onChange={(e) => updateField("docs", "numberingFormat", e.target.value)} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Observacion por defecto" rows={4} value={drafts.docs?.defaultObservation || ""} onChange={(e) => updateField("docs", "defaultObservation", e.target.value)} />
            </div>
            <Actions dirty={dirtyMap.docs} saving={savingPanel === "docs"} onReset={() => resetPanel("docs")} onSave={() => savePanel("docs", "Documentos")} />
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
              <Field
                label="Alerta de vencimiento (dias)"
                type="number"
                value={String(drafts.cmdb?.warrantyAlertDays || 30)}
                onChange={(e) => updateField("cmdb", "warrantyAlertDays", e.target.value)}
              />
              <Field label="Nota operacional" rows={4} value={drafts.cmdb?.supportNote || ""} onChange={(e) => updateField("cmdb", "supportNote", e.target.value)} />
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
