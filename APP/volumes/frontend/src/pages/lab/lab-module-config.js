export const LAB_REASON_OPTIONS = [
  { value: "maintenance", label: "Mantenimiento" },
  { value: "cleaning", label: "Limpieza" },
  { value: "backup", label: "Respaldo" },
  { value: "virus_analysis", label: "Analisis de virus" },
  { value: "full_reset", label: "Reinicio completo" },
  { value: "warranty_referral", label: "Derivado a garantia" },
  { value: "donation_format", label: "Formateo para donacion" },
  { value: "retirement_format", label: "Formateo para baja" },
  { value: "hardware_analysis", label: "Analisis de hardware" },
  { value: "hardware_repair", label: "Reparacion de hardware" },
  { value: "software_update", label: "Actualizacion de software" },
  { value: "functional_verification", label: "Verificacion funcional" },
  { value: "reinstallation", label: "Reinstalacion" },
  { value: "diagnosis", label: "Diagnostico" },
  { value: "other", label: "Otro procedimiento" },
];

export const LAB_STATUS_OPTIONS = [
  { value: "draft", label: "Borrador de ingreso" },
  { value: "in_execution", label: "En ejecucion" },
  { value: "ready_for_closure", label: "Lista para cierre" },
  { value: "pending_admin_signature", label: "Pendiente firma administrador" },
  { value: "pending_itop_sync", label: "Pendiente registro iTop" },
  { value: "completed_return_to_stock", label: "Cerrada a stock" },
  { value: "completed_obsolete", label: "Cerrada por obsolescencia" },
  { value: "cancelled", label: "Anulada" },
];

export const LAB_STATUS_UI_MAP = {
  "Borrador de ingreso": { tone: "warning", db: "draft" },
  "En ejecucion": { tone: "accent", db: "in_execution" },
  "Lista para cierre": { tone: "default", db: "ready_for_closure" },
  "Pendiente firma administrador": { tone: "danger", db: "pending_admin_signature" },
  "Pendiente registro iTop": { tone: "warning", db: "pending_itop_sync" },
  "Cerrada a stock": { tone: "success", db: "completed_return_to_stock" },
  "Cerrada por obsolescencia": { tone: "danger", db: "completed_obsolete" },
  "Anulada": { tone: "danger", db: "cancelled" },
};

export const LAB_EXIT_FINAL_STATE_OPTIONS = [
  { value: "production", label: "En produccion" },
  { value: "stock", label: "A stock" },
  { value: "implementation", label: "En implementacion" },
  { value: "repair", label: "En reparacion" },
  { value: "test", label: "En prueba" },
  { value: "inactive", label: "Inactivo" },
  { value: "obsolete", label: "Derivado a obsoleto" },
  { value: "disposed", label: "Dado de baja" },
];

export const LAB_OBSOLETE_EXIT_STATES = new Set(["obsolete", "disposed"]);

export function getReasonLabel(reasonValue) {
  return LAB_REASON_OPTIONS.find((opt) => opt.value === reasonValue)?.label || reasonValue || "—";
}

export function createEmptyLabForm(bootstrap = {}) {
  const today = bootstrap?.currentDate || new Date().toISOString().slice(0, 10);
  return {
    reason: "maintenance",
    requestedActions: ["maintenance"],
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
  return {
    reason: detail.reason || "maintenance",
    requestedActions: detail.requestedActions || (detail.reason ? [detail.reason] : ["maintenance"]),
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
