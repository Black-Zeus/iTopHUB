export const LAB_REASON_OPTIONS = [
  { value: "maintenance",    label: "Mantenimiento" },
  { value: "cleaning",       label: "Limpieza" },
  { value: "reinstallation", label: "Reinstalacion" },
  { value: "backup",         label: "Respaldo" },
  { value: "diagnosis",      label: "Diagnostico" },
  { value: "software_update",label: "Actualizacion de software" },
  { value: "verification",   label: "Verificacion funcional" },
  { value: "hardware_repair",label: "Reparacion de hardware" },
];

export const LAB_STATUS_OPTIONS = [
  { value: "draft",             label: "En creacion" },
  { value: "in_lab",            label: "En laboratorio" },
  { value: "completed",         label: "Completada" },
  { value: "derived_obsolete",  label: "Derivada a obsoleto" },
  { value: "cancelled",         label: "Anulada" },
];

export const LAB_STATUS_UI_MAP = {
  "En creacion":        { tone: "warning", db: "draft" },
  "En laboratorio":     { tone: "accent",  db: "in_lab" },
  "Completada":         { tone: "success", db: "completed" },
  "Derivada a obsoleto":{ tone: "danger",  db: "derived_obsolete" },
  "Anulada":            { tone: "danger",  db: "cancelled" },
};

export function getReasonLabel(reasonValue) {
  return LAB_REASON_OPTIONS.find((opt) => opt.value === reasonValue)?.label || reasonValue || "—";
}

export function createEmptyLabForm(bootstrap = {}) {
  const today = bootstrap?.currentDate || new Date().toISOString().slice(0, 10);
  return {
    reason: "maintenance",
    asset: null,
    entryDate: today,
    entryObservations: "",
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
    markedObsolete: false,
    obsoleteNotes: "",
    normalizationActCode: "",
  };
}

export function createFormFromDetail(detail) {
  return {
    reason: detail.reason || "maintenance",
    asset: detail.assetItopId ? {
      id: String(detail.assetItopId),
      code: detail.assetCode || "",
      name: detail.assetName || "",
      className: detail.assetClass || "",
      serial: detail.assetSerial || "",
      organization: detail.assetOrganization || "",
      location: detail.assetLocation || "",
    } : null,
    entryDate: detail.entryDate || "",
    entryObservations: detail.entryObservations || "",
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
    markedObsolete: Boolean(detail.markedObsolete),
    obsoleteNotes: detail.obsoleteNotes || "",
    normalizationActCode: detail.normalizationActCode || "",
  };
}
