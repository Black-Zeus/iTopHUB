export const LAB_REASON_OPTIONS = [
  { value: "incident", label: "Incidente o falla reportada" },
  { value: "preventive", label: "Mantencion preventiva" },
  { value: "corrective", label: "Mantencion correctiva" },
  { value: "warranty", label: "Revision por garantia" },
  { value: "preparation", label: "Preparacion operacional" },
  { value: "decommission", label: "Preparacion para baja" },
  { value: "other", label: "Otro procedimiento" },
];

export const LAB_REQUESTED_ACTION_OPTIONS = [
  { value: "diagnose", label: "Diagnosticar falla" },
  { value: "inspect_hardware", label: "Revisar hardware" },
  { value: "repair_hardware", label: "Reparar hardware" },
  { value: "clean_equipment", label: "Limpiar equipo" },
  { value: "backup_data", label: "Respaldar informacion" },
  { value: "scan_malware", label: "Analizar malware" },
  { value: "reset_os", label: "Reinstalar o restaurar sistema" },
  { value: "update_software", label: "Actualizar software" },
  { value: "functional_test", label: "Verificar funcionamiento" },
  { value: "prepare_warranty", label: "Preparar derivacion a garantia" },
  { value: "prepare_decommission", label: "Preparar para baja" },
  { value: "other", label: "Otra accion tecnica" },
];

export const LAB_STATUS_OPTIONS = [
  { value: "draft", label: "Borrador de ingreso" },
  { value: "in_execution", label: "En ejecucion" },
  { value: "ready_for_closure", label: "Lista para cierre" },
  { value: "pending_admin_signature", label: "Pendiente firma administrador" },
  { value: "pending_itop_sync", label: "Pendiente registro iTop" },
  { value: "completed_return_to_stock", label: "Cerrada" },
  { value: "completed_obsolete", label: "Cerrada con normalizacion" },
  { value: "cancelled", label: "Anulada" },
];

export const LAB_STATUS_UI_MAP = {
  "Borrador de ingreso": { tone: "warning", db: "draft" },
  "En ejecucion": { tone: "accent", db: "in_execution" },
  "Lista para cierre": { tone: "default", db: "ready_for_closure" },
  "Pendiente firma administrador": { tone: "danger", db: "pending_admin_signature" },
  "Pendiente registro iTop": { tone: "warning", db: "pending_itop_sync" },
  "Cerrada": { tone: "success", db: "completed_return_to_stock" },
  "Cerrada con normalizacion": { tone: "success", db: "completed_obsolete" },
  "Anulada": { tone: "danger", db: "cancelled" },
};

export const LAB_OBSOLETE_EXIT_STATES = new Set(["obsolete"]);

export function getReasonLabel(reasonValue) {
  return LAB_REASON_OPTIONS.find((opt) => opt.value === reasonValue)?.label || reasonValue || "—";
}

function normalizeRequestedActions(actions = []) {
  const validValues = new Set(LAB_REQUESTED_ACTION_OPTIONS.map((option) => option.value));
  return [...new Set(
    (Array.isArray(actions) ? actions : [])
      .filter((value) => validValues.has(value))
  )];
}

export function createEmptyLabForm(bootstrap = {}) {
  const today = bootstrap?.currentDate || new Date().toISOString().slice(0, 10);
  return {
    reason: "incident",
    requestedActions: ["diagnose"],
    asset: null,
    requesterAdmin: null,
    entryDate: today,
    entryObservations: "",
    entryConditionNotes: "",
    entryReceivedNotes: "",
    entryEvidences: [],
    entryGeneratedDocument: null,
    processingDate: today,
    processingObservations: "",
    processingEvidences: [],
    processingGeneratedDocument: null,
    processingChecklists: [],
    exitDate: today,
    exitObservations: "",
    workPerformed: "",
    exitEvidences: [],
    exitGeneratedDocument: null,
    exitFinalState: "",
    obsoleteNotes: "",
    normalizationActCode: "",
    itopTicket: null,
  };
}

export function createFormFromDetail(detail) {
  const requestedActions = normalizeRequestedActions(detail.requestedActions);
  return {
    reason: detail.reason || "incident",
    requestedActions: requestedActions.length ? requestedActions : ["diagnose"],
    asset: detail.assetItopId ? {
      id: String(detail.assetItopId),
      code: detail.assetCode || "",
      name: detail.assetName || "",
      className: detail.assetClass || "",
      serial: detail.assetSerial || "",
      organization: detail.assetOrganization || "",
      location: detail.assetLocation || "",
      status: detail.assetStatus || "",
      assignedUser: detail.assetAssignedUser || "",
    } : null,
    requesterAdmin: detail.requesterAdmin || null,
    entryDate: detail.entryDate || "",
    entryObservations: detail.entryObservations || "",
    entryConditionNotes: detail.entryConditionNotes || "",
    entryReceivedNotes: detail.entryReceivedNotes || "",
    entryEvidences: detail.entryEvidences || [],
    entryGeneratedDocument: detail.entryGeneratedDocument || null,
    processingDate: detail.processingDate || "",
    processingObservations: detail.processingObservations || "",
    processingEvidences: detail.processingEvidences || [],
    processingGeneratedDocument: detail.processingGeneratedDocument || null,
    processingChecklists: detail.processingChecklists || [],
    exitDate: detail.exitDate || "",
    exitObservations: detail.exitObservations || "",
    workPerformed: detail.workPerformed || "",
    exitEvidences: detail.exitEvidences || [],
    exitGeneratedDocument: detail.exitGeneratedDocument || null,
    exitFinalState: detail.exitFinalState || "",
    obsoleteNotes: detail.obsoleteNotes || "",
    normalizationActCode: detail.normalizationActCode || "",
    itopTicket: detail.itopTicket || null,
  };
}
