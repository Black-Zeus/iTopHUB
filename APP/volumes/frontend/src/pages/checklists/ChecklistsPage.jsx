import { useEffect, useMemo, useState } from "react";
import { DataTable, FilterDropdown, Panel, PanelHeader, SoftActionButton } from "../../components/ui/general";
import { Icon } from "../../components/ui/icon/Icon";
import { Button } from "../../ui/Button";
import ModalManager from "../../components/ui/modal";
import { createChecklist, getChecklists, updateChecklist } from "../../services/checklists-service";

const CHECK_ITEM_TYPES = ["Input text", "Text area", "Check", "Option / Radio"];

const MODULES = [
  { id: "lab", tabLabel: "Checklist Laboratorio", title: "Checklist Laboratorio", helper: "Cada checklist corresponde a una clase CMDB soportada. Desde aqui puedes abrir su configuracion interna.", usesCmdbClass: true, hasStatusToggle: false },
  { id: "handover", tabLabel: "Checklist Entrega", title: "Checklist Entrega", helper: "Cada checklist de entrega permite modelar que insumos y validaciones se documentan al asignar activos a una persona.", usesCmdbClass: false, hasStatusToggle: true },
  { id: "reassignment", tabLabel: "Checklist Reasignacion", title: "Checklist Reasignacion", helper: "Cada checklist de reasignacion permite documentar origen, destino y validaciones del traspaso sin repetir controles manuales.", usesCmdbClass: false, hasStatusToggle: true },
  { id: "reception", tabLabel: "Checklist Recepcion", title: "Checklist Recepcion", helper: "Cada checklist de recepcion permite registrar devolucion, faltantes, accesorios e insumos recibidos junto al activo principal.", usesCmdbClass: false, hasStatusToggle: true },
];

const EMPTY_BY_MODULE = { lab: [], handover: [], reassignment: [], reception: [] };

function getModule(id) {
  return MODULES.find((item) => item.id === id);
}

function StatusBadge({ status }) {
  const active = status === "Activo";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-[rgba(127,191,156,0.14)] text-[var(--success)]" : "bg-[rgba(210,138,138,0.14)] text-[var(--danger)]"}`}>
      <span className={`inline-flex h-2 w-2 rounded-full ${active ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`} />
      {status}
    </span>
  );
}

function ToggleButton({ isCollapsed, onClick, collapsedLabel, expandedLabel }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--border-strong)] bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-[var(--shadow-subtle)] transition-transform ${isCollapsed ? "rotate-180" : ""}`} title={isCollapsed ? collapsedLabel : expandedLabel} aria-label={isCollapsed ? collapsedLabel : expandedLabel}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

function ChecklistPreview({ moduleConfig, checklist }) {
  const helper = moduleConfig.usesCmdbClass
    ? checklist.cmdbClass
    : `Plantilla ${checklist.status.toLowerCase()} disponible para seleccion en actas de ${moduleConfig.id === "handover" ? "entrega" : moduleConfig.id === "reassignment" ? "reasignacion" : "recepcion"}.`;

  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-secondary)]">{helper}</div>
      <div className="overflow-hidden rounded-[18px] border border-[var(--border-color)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--bg-app)] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.06em]">No</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.06em]">Check</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.06em]">Respuesta</th>
              </tr>
            </thead>
            <tbody>
              {checklist.checks.map((item, index) => (
                <tr key={item.id ?? `${checklist.id}-${index}`} className="border-t border-[var(--border-color)]">
                  <td className="px-4 py-4 align-top text-[var(--text-secondary)]">{index + 1}.</td>
                  <td className="px-4 py-4 align-top">
                    <strong className="block text-[var(--text-primary)]">{item.name}</strong>
                    <span className="mt-1 block text-[var(--text-secondary)]">{item.description}</span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    {item.type === "Input text" ? <input type="text" readOnly placeholder="Completar campo" className="h-[44px] w-full rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] outline-none" /> : null}
                    {item.type === "Text area" ? <textarea rows="4" readOnly placeholder="Completar detalle" className="w-full rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" /> : null}
                    {item.type === "Check" ? <label className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" readOnly /><span>Validado</span></label> : null}
                    {item.type === "Option / Radio" ? (
                      <div className="flex flex-wrap gap-3">
                        <label className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-secondary)]"><input type="radio" name={`preview-${checklist.id}-${index}`} readOnly /><span>{item.optionA || "Opcion A"}</span></label>
                        <label className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-secondary)]"><input type="radio" name={`preview-${checklist.id}-${index}`} readOnly /><span>{item.optionB || "Opcion B"}</span></label>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ItemModalContent({ initialItem, onCancel, onSave }) {
  const [form, setForm] = useState(initialItem ?? { name: "", type: "Input text", description: "", optionA: "", optionB: "" });
  const isRadio = form.type === "Option / Radio";

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--text-secondary)]">Define como se presentara este campo dentro del checklist tecnico y que informacion debera completar el operador.</p>
      <div className="grid grid-cols-2 gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Nombre del check</span>
          <input type="text" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none" placeholder="Ej. Camara web" />
        </label>
        <div className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Tipo de check</span>
          <FilterDropdown
            label="Tipo de check"
            options={CHECK_ITEM_TYPES.map((type) => ({ value: type, label: type }))}
            selectedValues={form.type ? [form.type] : []}
            selectionMode="single"
            onToggleOption={(nextValue) => setForm((current) => ({ ...current, type: nextValue, optionA: nextValue === "Option / Radio" ? current.optionA : "", optionB: nextValue === "Option / Radio" ? current.optionB : "" }))}
            onClear={() => setForm((current) => ({ ...current, type: "Input text", optionA: "", optionB: "" }))}
            title="Seleccionar tipo de check"
            showTriggerIcon
            triggerClassName="min-h-[50px]"
            buttonHeightClassName="min-h-[50px]"
            menuOffsetClassName="top-[calc(100%+0.55rem)]"
            menuClassName="rounded-[18px]"
            renderSelection={({ label, selectedOptions }) => <><span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</span><span className="mt-1 block truncate text-sm font-semibold text-[var(--text-primary)]">{selectedOptions[0]?.label ?? "Input text"}</span></>}
            renderOptionDescription={() => "Disponible para este check"}
            renderOptionLeading={() => <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />}
            getOptionClassName={(_, isActive) => isActive ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]" : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"}
          />
        </div>
        <label className={`grid gap-2 ${isRadio ? "" : "col-span-2"}`}>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Descripcion</span>
          <textarea rows="7" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none" placeholder="Describe que debe validar o completar el tecnico." />
        </label>
        {isRadio ? (
          <div className="grid gap-4">
            <label className="grid gap-2"><span className="text-sm font-semibold text-[var(--text-primary)]">Estado A</span><input type="text" value={form.optionA} onChange={(event) => setForm((current) => ({ ...current, optionA: event.target.value }))} className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none" placeholder="Ej. Si" /></label>
            <label className="grid gap-2"><span className="text-sm font-semibold text-[var(--text-primary)]">Estado B</span><input type="text" value={form.optionB} onChange={(event) => setForm((current) => ({ ...current, optionB: event.target.value }))} className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none" placeholder="Ej. No" /></label>
          </div>
        ) : null}
      </div>
      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <SoftActionButton onClick={() => { if (!form.name.trim() || !form.description.trim()) return; if (isRadio && (!form.optionA.trim() || !form.optionB.trim())) return; onSave({ ...form, optionA: isRadio ? form.optionA.trim() : "", optionB: isRadio ? form.optionB.trim() : "" }); }}>Guardar check</SoftActionButton>
      </div>
    </div>
  );
}

function NewChecklistContent({ moduleConfig, onCancel, onSave }) {
  const [form, setForm] = useState({ name: "", description: "", status: "Activo", cmdbClass: "" });
  const options = [
    { value: "Laptop (Laptop)", label: "Laptop (Laptop)" },
    { value: "Desktop (PC)", label: "Desktop (PC)" },
    { value: "Tableta (Tablet)", label: "Tableta (Tablet)" },
    { value: "Celular (MobilePhone)", label: "Celular (MobilePhone)" },
    { value: "Impresora (Printer)", label: "Impresora (Printer)" },
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--text-secondary)]">Define la plantilla base que estara disponible dentro de esta seccion.</p>
      <div className="grid grid-cols-2 gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Nombre del checklist</span>
          <input type="text" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none" placeholder="Ej. Checklist notebook" />
        </label>
        {moduleConfig.usesCmdbClass ? (
          <div className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Clase CMDB</span>
            <FilterDropdown
              label="Clase CMDB"
              options={options}
              selectedValues={form.cmdbClass ? [form.cmdbClass] : []}
              selectionMode="single"
              onToggleOption={(nextValue) => setForm((current) => ({ ...current, cmdbClass: nextValue }))}
              onClear={() => setForm((current) => ({ ...current, cmdbClass: "" }))}
              title="Seleccionar clase CMDB"
              showTriggerIcon
              triggerClassName="min-h-[50px]"
              buttonHeightClassName="min-h-[50px]"
              menuOffsetClassName="top-[calc(100%+0.55rem)]"
              menuClassName="rounded-[18px]"
              renderSelection={({ label, selectedOptions }) => <><span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</span><span className="mt-1 block truncate text-sm font-semibold text-[var(--text-primary)]">{selectedOptions[0]?.label ?? "Selecciona una clase"}</span></>}
              renderOptionDescription={() => "Clase soportada por la plantilla"}
              renderOptionLeading={() => <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />}
              getOptionClassName={(_, isActive) => isActive ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]" : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"}
            />
          </div>
        ) : null}
        <label className="col-span-2 grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Descripcion</span>
          <textarea rows="6" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none" placeholder="Describe el objetivo operativo de la plantilla." />
        </label>
      </div>
      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <SoftActionButton onClick={() => { if (!form.name.trim() || !form.description.trim()) return; if (moduleConfig.usesCmdbClass && !form.cmdbClass.trim()) return; onSave(form); }}>Guardar checklist</SoftActionButton>
      </div>
    </div>
  );
}

export function ChecklistsPage() {
  const [activeModuleId, setActiveModuleId] = useState("lab");
  const [checklistsByModule, setChecklistsByModule] = useState(EMPTY_BY_MODULE);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState({ lab: null, handover: null, reassignment: null, reception: null });
  const [summaryCollapsedByModule, setSummaryCollapsedByModule] = useState({ lab: true, handover: true, reassignment: true, reception: true });
  const [descriptionEditByModule, setDescriptionEditByModule] = useState({ lab: false, handover: false, reassignment: false, reception: false });
  const [descriptionDraftByModule, setDescriptionDraftByModule] = useState({ lab: "", handover: "", reassignment: "", reception: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingChecklistId, setSavingChecklistId] = useState(null);

  const activeModule = getModule(activeModuleId);
  const activeChecklists = checklistsByModule[activeModuleId] ?? [];
  const selectedChecklist = activeChecklists.find((item) => item.id === selectedChecklistIds[activeModuleId]) ?? null;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await getChecklists();
        if (!cancelled) setChecklistsByModule({ ...EMPTY_BY_MODULE, ...(payload?.itemsByModule || {}) });
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "No fue posible cargar los checklists.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const updateSelectedChecklist = (updater) => {
    if (!selectedChecklist) return;
    setChecklistsByModule((current) => ({
      ...current,
      [activeModuleId]: current[activeModuleId].map((checklist) => checklist.id === selectedChecklist.id ? updater(checklist) : checklist),
    }));
  };

  const listColumns = useMemo(() => {
    const columns = [{ key: "name", label: "Checklist", sortable: true }];
    if (activeModule?.usesCmdbClass) columns.push({ key: "cmdbClass", label: "Clase CMDB", sortable: true });
    columns.push({ key: "description", label: "Descripcion" });
    if (activeModule?.hasStatusToggle) columns.push({ key: "status", label: "Estado", render: (value) => <StatusBadge status={value} /> });
    columns.push({
      key: "action",
      label: "Acciones",
      render: (_, row) => (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSelectedChecklistIds((current) => ({ ...current, [activeModuleId]: row.id }))}>
            <Icon name="edit" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Editar
          </Button>
          <Button variant="secondary" size="sm" onClick={() => ModalManager.custom({ title: row.name, size: "lg", showFooter: false, content: <ChecklistPreview moduleConfig={activeModule} checklist={row} /> })}>
            <Icon name="eye" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Ver
          </Button>
        </div>
      ),
    });
    return columns;
  }, [activeModule, activeModuleId]);

  const itemColumns = useMemo(() => [
    { key: "name", label: "Check", sortable: true },
    { key: "description", label: "Descripcion" },
    { key: "type", label: "Tipo", sortable: true },
    {
      key: "action",
      label: "Acciones",
      render: (_, row) => (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const modalId = ModalManager.custom({
                title: "Editar check",
                size: "clientWide",
                showFooter: false,
                content: <ItemModalContent initialItem={row} onCancel={() => ModalManager.close(modalId)} onSave={(nextItem) => { updateSelectedChecklist((checklist) => ({ ...checklist, checks: checklist.checks.map((item) => item.id === row.id ? { ...item, ...nextItem } : item) })); ModalManager.close(modalId); }} />,
              });
            }}
          >
            <Icon name="edit" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Editar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const modalId = ModalManager.custom({
                title: "Confirmar eliminacion",
                size: "md",
                showFooter: false,
                content: <div className="space-y-5"><p className="text-sm text-[var(--text-secondary)]">{`Confirma si deseas eliminar "${row.name}" del checklist seleccionado.`}</p><div className="flex justify-between gap-3"><Button variant="secondary" onClick={() => ModalManager.close(modalId)}>Cancelar</Button><SoftActionButton onClick={() => { updateSelectedChecklist((checklist) => ({ ...checklist, checks: checklist.checks.filter((item) => item.id !== row.id) })); ModalManager.close(modalId); }}>Eliminar check</SoftActionButton></div></div>,
              });
            }}
          >
            <Icon name="trash" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Eliminar
          </Button>
        </div>
      ),
    },
  ], [activeModuleId, selectedChecklist]);

  const openNewCheckModal = () => {
    const modalId = ModalManager.custom({
      title: "Nuevo check",
      size: "clientWide",
      showFooter: false,
      content: <ItemModalContent onCancel={() => ModalManager.close(modalId)} onSave={(nextItem) => { updateSelectedChecklist((checklist) => ({ ...checklist, checks: [{ id: `draft-check-${Date.now()}`, ...nextItem }, ...checklist.checks] })); ModalManager.close(modalId); }} />,
    });
  };

  const openNewChecklistModal = () => {
    const modalId = ModalManager.custom({
      title: "Nuevo checklist",
      size: "clientWide",
      showFooter: false,
      content: <NewChecklistContent moduleConfig={activeModule} onCancel={() => ModalManager.close(modalId)} onSave={(nextChecklist) => { const nextId = `draft-checklist-${Date.now()}`; setChecklistsByModule((current) => ({ ...current, [activeModuleId]: [{ id: nextId, moduleCode: activeModuleId, name: nextChecklist.name, description: nextChecklist.description, status: nextChecklist.status, cmdbClass: nextChecklist.cmdbClass, checks: [] }, ...current[activeModuleId]] })); setSelectedChecklistIds((current) => ({ ...current, [activeModuleId]: nextId })); ModalManager.close(modalId); }} />,
    });
  };

  const startDescriptionEdit = () => {
    if (!selectedChecklist) return;
    setDescriptionDraftByModule((current) => ({ ...current, [activeModuleId]: selectedChecklist.description }));
    setDescriptionEditByModule((current) => ({ ...current, [activeModuleId]: true }));
  };

  const saveDescriptionEdit = () => {
    const nextDescription = descriptionDraftByModule[activeModuleId].trim();
    if (!nextDescription) return;
    updateSelectedChecklist((checklist) => ({ ...checklist, description: nextDescription }));
    setDescriptionEditByModule((current) => ({ ...current, [activeModuleId]: false }));
  };

  const saveChecklist = async () => {
    if (!selectedChecklist) return;
    const payload = { moduleCode: activeModuleId, name: selectedChecklist.name, description: selectedChecklist.description, status: selectedChecklist.status, cmdbClass: selectedChecklist.cmdbClass, checks: selectedChecklist.checks.map((item) => ({ name: item.name, description: item.description, type: item.type, optionA: item.optionA, optionB: item.optionB })) };
    setSavingChecklistId(selectedChecklist.id);
    try {
      const response = String(selectedChecklist.id).startsWith("draft-checklist-") ? await createChecklist(payload) : await updateChecklist(selectedChecklist.id, payload);
      const saved = response.item;
      setChecklistsByModule((current) => ({ ...current, [activeModuleId]: current[activeModuleId].map((item) => item.id === selectedChecklist.id ? saved : item) }));
      setSelectedChecklistIds((current) => ({ ...current, [activeModuleId]: saved.id }));
      ModalManager.success({ title: "Checklist actualizado", message: "La plantilla y su contenido quedaron guardados en base de datos." });
    } catch (saveError) {
      ModalManager.error({ title: "No fue posible guardar", message: saveError.message || "Ocurrio un error al guardar el checklist." });
    } finally {
      setSavingChecklistId(null);
    }
  };

  return (
    <div className="grid gap-5">
      {error ? <div className="rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">{error}</div> : null}
      <Panel wide className="grid gap-6">
        <PanelHeader eyebrow="Plantillas operativas" title="Checklist" />
        <div className="flex flex-wrap gap-3">
          {MODULES.map((module) => (
            <button key={module.id} type="button" onClick={() => setActiveModuleId(module.id)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${module.id === activeModuleId ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)] hover:border-[var(--accent-strong)] hover:text-[var(--text-primary)]"}`}>{module.tabLabel}</button>
          ))}
        </div>

        {!selectedChecklist ? (
          <div className="grid gap-4">
            <PanelHeader eyebrow="Listas soportadas" title="Checklists que maneja el sistema" actions={<SoftActionButton onClick={openNewChecklistModal}>Nuevo checklist</SoftActionButton>} />
            <DataTable columns={listColumns} rows={activeChecklists} loading={loading} emptyMessage="No hay checklists cargados en esta seccion." />
            <p className="text-sm text-[var(--text-muted)]">{activeModule?.helper}</p>
          </div>
        ) : (
          <div className="grid gap-5">
            <Panel wide>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <button type="button" onClick={() => setSelectedChecklistIds((current) => ({ ...current, [activeModuleId]: null }))} className="inline-flex h-[52px] w-[52px] min-w-[52px] items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-muted)] text-[var(--text-primary)]" title="Volver a menu checklist" aria-label="Volver a menu checklist"><svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <div>
                        <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{activeModule?.title}{activeModule?.usesCmdbClass && selectedChecklist.cmdbClass ? ` (${selectedChecklist.cmdbClass})` : ""}</p>
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">{selectedChecklist.name}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => descriptionEditByModule[activeModuleId] ? saveDescriptionEdit() : startDescriptionEdit()}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                        title={descriptionEditByModule[activeModuleId] ? "Guardar descripcion" : "Editar descripcion"}
                        aria-label={descriptionEditByModule[activeModuleId] ? "Guardar descripcion" : "Editar descripcion"}
                      >
                        {descriptionEditByModule[activeModuleId] ? (
                          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
                            <path d="M5 4h11l3 3v13H5zM8 4v6h8M9 18h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
                            <path d="M4 20h4l10-10-4-4L4 16v4zm9-13 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        <span>{descriptionEditByModule[activeModuleId] ? "Guardar" : "Editar"}</span>
                      </button>
                    </div>
                    <div className="mt-3 grid w-full gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">Descripcion</span>
                      {descriptionEditByModule[activeModuleId] ? <label className="flex min-h-[48px] w-full items-start gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-2"><span className="pt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Edicion</span><textarea rows="2" value={descriptionDraftByModule[activeModuleId]} onChange={(event) => setDescriptionDraftByModule((current) => ({ ...current, [activeModuleId]: event.target.value }))} className="min-h-[24px] w-full resize-none border-0 bg-transparent text-sm leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" placeholder="Describe el objetivo operativo de esta lista de checklist." /></label> : <p className="w-full text-sm leading-7 text-[var(--text-secondary)]">{selectedChecklist.description}</p>}
                    </div>
                  </div>
                </div>
                <ToggleButton isCollapsed={summaryCollapsedByModule[activeModuleId]} onClick={() => setSummaryCollapsedByModule((current) => ({ ...current, [activeModuleId]: !current[activeModuleId] }))} collapsedLabel="Expandir resumen" expandedLabel="Colapsar resumen" />
              </div>
              {!summaryCollapsedByModule[activeModuleId] && activeModule?.hasStatusToggle ? <div className="mt-5 grid gap-4"><label className="flex items-center gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={selectedChecklist.status === "Activo"} onChange={(event) => updateSelectedChecklist((checklist) => ({ ...checklist, status: event.target.checked ? "Activo" : "Inactivo" }))} className="h-4 w-4 rounded border-[var(--border-color)]" /><span>Checklist activo para seleccion en actas</span></label></div> : null}
            </Panel>

            <Panel wide>
              <PanelHeader eyebrow="Contenido" title="Checks del checklist" actions={<SoftActionButton onClick={openNewCheckModal}>Nuevo check</SoftActionButton>} />
              <DataTable columns={itemColumns} rows={selectedChecklist.checks} emptyMessage="No hay checks cargados en esta lista." />
              <div className="mt-5 flex justify-end">
                <SoftActionButton onClick={saveChecklist} disabled={savingChecklistId === selectedChecklist.id}>{savingChecklistId === selectedChecklist.id ? "Guardando..." : "Guardar checklist"}</SoftActionButton>
              </div>
            </Panel>
          </div>
        )}
      </Panel>
    </div>
  );
}
