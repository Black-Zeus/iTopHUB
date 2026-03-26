import { useMemo, useState } from "react";
import { FilterDateField } from "../../components/ui/general/FilterDateField";
import { FilterDropdown } from "../../components/ui/general/FilterDropdown";
import { Panel, PanelHeader } from "../../components/ui/general/Panel";
import { SoftActionButton } from "../../components/ui/general/SoftActionButton";
import { Button } from "../../ui/Button";
import ModalManager from "../../components/ui/modal";

const REPORTS = [
  {
    id: "report-1",
    name: "Personas con equipo asignado",
    category: "Asignacion",
    frequency: "Semanal",
    description:
      "Consolida el parque asignado por colaborador con foco en custodia vigente, fecha de entrega y responsable operativo.",
    parameters: [
      { type: "select", label: "Estado de asignacion", key: "assignment", options: ["Vigentes", "Todos"] },
      { type: "date", label: "Fecha corte", key: "cutoff" },
      { type: "select", label: "Orden", key: "sort", options: ["Persona", "Fecha asignacion", "Activo"] },
    ],
    columns: ["Persona", "Area", "Activo", "Tipo", "Modelo", "Fecha asignacion", "Responsable"],
    rows: [
      ["Paula Ferreyra", "Direccion Comercial", "NB-24017", "Notebook", "Latitude 5440", "2026-03-10", "Marina Sosa"],
      ["Paula Ferreyra", "Direccion Comercial", "DK-19008", "Periferico", "WD19S", "2026-03-10", "Marina Sosa"],
      ["Carla Rosales", "Finanzas", "MN-11044", "Monitor", "P2423D", "2026-02-01", "Damian Ochoa"],
    ],
  },
  {
    id: "report-2",
    name: "Historial de movimientos por activo",
    category: "Movimientos",
    frequency: "Bajo demanda",
    description:
      "Reconstruye la trazabilidad de un activo, incluyendo cambios de estado, transferencias, ingresos a laboratorio y referencias documentales.",
    parameters: [
      { type: "search", label: "Codigo de activo", key: "asset_code", placeholder: "NB-24017" },
      { type: "date", label: "Desde", key: "from_date" },
      { type: "date", label: "Hasta", key: "to_date" },
      { type: "select", label: "Tipo de movimiento", key: "movement", options: ["Todos", "Entrega", "Recepcion", "Reasignacion", "Cambio de estado"] },
    ],
    columns: ["Fecha", "Activo", "Movimiento", "Origen", "Destino", "Estado previo", "Estado nuevo", "Acta"],
    rows: [
      ["2026-03-10", "NB-24017", "Entrega", "Stock TI", "Paula Ferreyra", "Disponible", "Asignado", "ENT-2026-0317"],
      ["2026-03-13", "NB-24021", "Recepcion", "Joaquin Herrera", "Laboratorio", "Asignado", "Laboratorio", "REC-2026-0142"],
      ["2026-02-01", "MN-11044", "Reasignacion", "Administracion", "Carla Rosales", "Asignado", "Asignado", "ENT-2026-0088"],
    ],
  },
  {
    id: "report-3",
    name: "Equipos en laboratorio",
    category: "Laboratorio",
    frequency: "Diario",
    description:
      "Resume la carga vigente del laboratorio con prioridad, tecnico asignado, motivo de ingreso y estado tecnico.",
    parameters: [
      { type: "select", label: "Prioridad", key: "priority", options: ["Todas", "Alta", "Media", "Baja"] },
      { type: "select", label: "Estado", key: "status", options: ["Todos", "En diagnostico", "Pendiente de revision", "Listo para devolucion"] },
      { type: "select", label: "Tecnico", key: "technician", options: ["Todos", "Natalia Quiroga", "Lucia Vera", "Marina Sosa"] },
      { type: "date", label: "Fecha de ingreso", key: "entry_date" },
    ],
    columns: ["Acta recepcion", "Activo", "Motivo", "Prioridad", "Estado", "Tecnico", "Acta tecnica"],
    rows: [
      ["REC-2026-0142", "NB-24021", "Recalentamiento", "Alta", "En diagnostico", "Natalia Quiroga", "LAB-2026-0048"],
      ["REC-2026-0138", "PR-70031", "Atasco recurrente", "Media", "Pendiente de revision", "Lucia Vera", "LAB-2026-0049"],
      ["REC-2026-0131", "PC-19077", "Error de disco", "Alta", "Listo para devolucion", "Marina Sosa", "LAB-2026-0045"],
    ],
  },
  {
    id: "report-4",
    name: "Actas emitidas por periodo",
    category: "Documental",
    frequency: "Mensual",
    description:
      "Centraliza la emision documental del periodo para medir volumen de entregas, recepciones y registros tecnicos por responsable.",
    parameters: [
      { type: "date", label: "Desde", key: "from_date" },
      { type: "date", label: "Hasta", key: "to_date" },
      { type: "select", label: "Tipo documental", key: "document_type", options: ["Todos", "Entrega", "Recepcion", "Laboratorio"] },
      { type: "select", label: "Responsable", key: "owner", options: ["Todos", "Marina Sosa", "Lucia Vera", "Natalia Quiroga"] },
    ],
    columns: ["Tipo", "Numero", "Fecha", "Responsable", "Activo", "Usuario relacionado", "Estado"],
    rows: [
      ["Entrega", "ENT-2026-0317", "2026-03-10", "Marina Sosa", "NB-24017", "Paula Ferreyra", "Emitida"],
      ["Recepcion", "REC-2026-0142", "2026-03-13", "Lucia Vera", "NB-24021", "Joaquin Herrera", "En analisis"],
      ["Laboratorio", "LAB-2026-0048", "2026-03-13", "Natalia Quiroga", "NB-24021", "Joaquin Herrera", "Diagnostico emitido"],
    ],
  },
  {
    id: "report-5",
    name: "Personas sin equipo asignado",
    category: "Asignacion",
    frequency: "Semanal",
    description:
      "Detecta personas activas sin equipamiento vigente para identificar ingresos recientes o inconsistencias entre operacion y CMDB.",
    parameters: [
      { type: "select", label: "Estado persona", key: "person_status", options: ["Activo", "Todos"] },
      { type: "date", label: "Ingreso desde", key: "entry_from" },
      { type: "select", label: "Ordenar por", key: "sort", options: ["Nombre", "Fecha de ingreso", "Estado"] },
    ],
    columns: ["Persona", "Area", "Cargo", "Correo", "Fecha ingreso", "Estado"],
    rows: [
      ["Joaquin Herrera", "Operaciones", "Analista senior", "joaquin.herrera@itophub.local", "2023-09-04", "Activo"],
      ["Laura Ponce", "Finanzas", "Analista", "laura.ponce@itophub.local", "2026-02-18", "Activo"],
      ["Tomas Aguero", "Direccion Comercial", "Ejecutivo", "tomas.aguero@itophub.local", "2026-03-01", "Activo"],
    ],
  },
  {
    id: "report-6",
    name: "Activos por estado CMDB",
    category: "Inventario",
    frequency: "Mensual",
    description:
      "Muestra la distribucion actual del inventario por estado CMDB para analizar disponibilidad, uso efectivo y pendientes tecnicos.",
    parameters: [
      { type: "select", label: "Tipo de activo", key: "asset_type", options: ["Todos", "Notebook", "Monitor", "Periferico", "Servidor"] },
      { type: "select", label: "Estado CMDB", key: "cmdb_status", options: ["Todos", "En uso", "En revision", "Mantenimiento"] },
      { type: "date", label: "Fecha corte", key: "cutoff" },
      { type: "select", label: "Vista", key: "view", options: ["Resumen", "Detalle"] },
    ],
    columns: ["Codigo", "Tipo", "Modelo", "Estado CMDB", "Estado operativo", "Usuario actual"],
    rows: [
      ["NB-24017", "Notebook", "Latitude 5440", "En uso", "Operativo", "Paula Ferreyra"],
      ["NB-24021", "Notebook", "EliteBook 840 G10", "En revision", "No operativo", "Joaquin Herrera"],
      ["SV-0009", "Servidor", "PowerEdge R650", "Mantenimiento", "Operativo", "Infraestructura"],
    ],
  },
  {
    id: "report-7",
    name: "Activos proximos a recambio",
    category: "Renovacion",
    frequency: "Mensual",
    description:
      "Identifica equipos cercanos al fin de vida util o con antiguedad critica para planificar renovacion y reasignaciones preventivas.",
    parameters: [
      { type: "select", label: "Familia de activo", key: "asset_family", options: ["Todas", "Notebook", "Desktop", "Monitor", "Servidor"] },
      { type: "select", label: "Antiguedad minima", key: "age", options: ["36 meses", "48 meses", "60 meses"] },
      { type: "date", label: "Fecha corte", key: "cutoff" },
      { type: "select", label: "Ordenar por", key: "sort", options: ["Antiguedad", "Area", "Modelo"] },
    ],
    columns: ["Codigo", "Activo", "Modelo", "Fecha alta", "Antiguedad", "Usuario actual", "Estado"],
    rows: [
      ["NB-21003", "Notebook Ejecutiva", "Latitude 7420", "2021-02-16", "49 meses", "Paula Ferreyra", "Operativo"],
      ["PC-18077", "Desktop Administrativo", "OptiPlex 7090", "2020-11-08", "52 meses", "Laura Ponce", "Operativo"],
      ["MN-10440", "Monitor Corporativo", "P2419H", "2020-07-22", "56 meses", "Carla Rosales", "Operativo"],
    ],
  },
  {
    id: "report-8",
    name: "Recepciones con reparacion requerida",
    category: "Laboratorio",
    frequency: "Semanal",
    description:
      "Lista recepciones que derivaron en reparacion para medir carga tecnica, identificar causas recurrentes y priorizar repuestos.",
    parameters: [
      { type: "date", label: "Desde", key: "from_date" },
      { type: "date", label: "Hasta", key: "to_date" },
      { type: "select", label: "Estado del caso", key: "case_status", options: ["Todos", "Pendiente", "En reparacion", "Resuelto"] },
      { type: "select", label: "Tecnico", key: "technician", options: ["Todos", "Natalia Quiroga", "Lucia Vera", "Marina Sosa"] },
    ],
    columns: ["Acta", "Activo", "Falla inicial", "Diagnostico", "Tecnico", "Estado", "Fecha ingreso"],
    rows: [
      ["REC-2026-0142", "NB-24021", "Apagado aleatorio", "Bateria degradada", "Natalia Quiroga", "Pendiente", "2026-03-13"],
      ["REC-2026-0131", "PC-19077", "Error de disco", "SSD con fallas", "Marina Sosa", "En reparacion", "2026-03-11"],
      ["REC-2026-0127", "NB-23318", "Pantalla intermitente", "Flex danado", "Lucia Vera", "Resuelto", "2026-03-08"],
    ],
  },
  {
    id: "report-9",
    name: "Entregas pendientes de confirmacion",
    category: "Documental",
    frequency: "Diario",
    description:
      "Controla actas de entrega emitidas que aun no tienen validacion final del receptor o cierre documental completo.",
    parameters: [
      { type: "date", label: "Desde", key: "from_date" },
      { type: "date", label: "Hasta", key: "to_date" },
      { type: "select", label: "Pendiente de", key: "pending_type", options: ["Todos", "Firma", "Envio", "Cierre documental"] },
      { type: "select", label: "Responsable", key: "owner", options: ["Todos", "Marina Sosa", "Damian Ochoa", "Lucia Vera"] },
    ],
    columns: ["Acta", "Fecha", "Activo", "Persona", "Responsable", "Pendiente", "Estado"],
    rows: [
      ["ENT-2026-0318", "2026-03-13", "NB-24025", "Ivana Paez", "Marina Sosa", "Firma", "Pendiente"],
      ["ENT-2026-0315", "2026-03-09", "DK-19018", "Paula Ferreyra", "Marina Sosa", "Envio", "Pendiente"],
      ["ENT-2026-0309", "2026-03-06", "MN-11201", "Sergio Luna", "Damian Ochoa", "Cierre documental", "Pendiente"],
    ],
  },
  {
    id: "report-11",
    name: "Stock disponible por tipo de activo",
    category: "Inventario",
    frequency: "Diario",
    description:
      "Muestra los activos disponibles en stock, segmentados por familia, modelo y estado operativo para acelerar nuevas asignaciones.",
    parameters: [
      { type: "select", label: "Tipo de activo", key: "asset_type", options: ["Todos", "Notebook", "Desktop", "Monitor", "Periferico"] },
      { type: "select", label: "Estado operativo", key: "asset_state", options: ["Todos", "Operativo", "Pendiente", "En preparacion"] },
      { type: "date", label: "Fecha corte", key: "cutoff" },
      { type: "select", label: "Ordenar por", key: "sort", options: ["Tipo", "Modelo", "Cantidad"] },
    ],
    columns: ["Codigo", "Activo", "Tipo", "Modelo", "Estado", "Ubicacion logica"],
    rows: [
      ["NB-24031", "Notebook Operativa", "Notebook", "Latitude 5450", "Operativo", "Stock TI"],
      ["MN-11452", "Monitor Corporativo", "Monitor", "P2425H", "Operativo", "Stock TI"],
      ["DK-19107", "Docking USB-C", "Periferico", "WD19S", "En preparacion", "Almacen"],
    ],
  },
  {
    id: "report-14",
    name: "Actas sin respaldo completo",
    category: "Documental",
    frequency: "Diario",
    description:
      "Detecta documentacion emitida con validaciones, anexos o cierres pendientes para reforzar control y completitud del circuito documental.",
    parameters: [
      { type: "date", label: "Desde", key: "from_date" },
      { type: "date", label: "Hasta", key: "to_date" },
      { type: "select", label: "Tipo documental", key: "document_type", options: ["Todos", "Entrega", "Recepcion", "Laboratorio"] },
      { type: "select", label: "Faltante", key: "missing", options: ["Todos", "Firma", "Adjunto", "Cierre"] },
    ],
    columns: ["Documento", "Tipo", "Fecha", "Activo", "Responsable", "Faltante", "Estado"],
    rows: [
      ["ENT-2026-0318", "Entrega", "2026-03-13", "NB-24025", "Marina Sosa", "Firma", "Pendiente"],
      ["REC-2026-0140", "Recepcion", "2026-03-12", "PR-70028", "Lucia Vera", "Adjunto", "Pendiente"],
      ["LAB-2026-0046", "Laboratorio", "2026-03-10", "NB-23318", "Natalia Quiroga", "Cierre", "Pendiente"],
    ],
  },
  {
    id: "report-15",
    name: "Modelos fuera de estandar",
    category: "Renovacion",
    frequency: "Mensual",
    description:
      "Agrupa activos que no pertenecen al catalogo tecnologico vigente para apoyar decisiones de normalizacion y renovacion progresiva.",
    parameters: [
      { type: "select", label: "Tipo de activo", key: "asset_type", options: ["Todos", "Notebook", "Desktop", "Monitor"] },
      { type: "select", label: "Area", key: "business_area", options: ["Todas", "Operaciones", "Finanzas", "Direccion Comercial"] },
      { type: "date", label: "Fecha corte", key: "cutoff" },
      { type: "select", label: "Ordenar por", key: "sort", options: ["Modelo", "Antiguedad", "Area"] },
    ],
    columns: ["Codigo", "Activo", "Modelo", "Area", "Usuario", "Antiguedad", "Estado"],
    rows: [
      ["NB-21003", "Notebook Ejecutiva", "Latitude 7420", "Direccion Comercial", "Paula Ferreyra", "49 meses", "Operativo"],
      ["PC-18077", "Desktop Administrativo", "OptiPlex 7090", "Finanzas", "Laura Ponce", "52 meses", "Operativo"],
      ["NB-22018", "Notebook Operativa", "ProBook 440 G8", "Operaciones", "Tomas Aguero", "44 meses", "Operativo"],
    ],
  },
  {
    id: "report-16",
    name: "Activos sin usuario o ubicacion",
    category: "Calidad CMDB",
    frequency: "Semanal",
    description:
      "Detecta registros incompletos en CMDB donde faltan relaciones clave como usuario asignado o ubicacion logica.",
    parameters: [
      { type: "select", label: "Dato faltante", key: "missing_data", options: ["Todos", "Usuario", "Ubicacion", "Ambos"] },
      { type: "select", label: "Tipo de activo", key: "asset_type", options: ["Todos", "Notebook", "Monitor", "Servidor", "Periferico"] },
      { type: "date", label: "Fecha corte", key: "cutoff" },
      { type: "select", label: "Ordenar por", key: "sort", options: ["Codigo", "Tipo", "Dato faltante"] },
    ],
    columns: ["Codigo", "Activo", "Tipo", "Usuario actual", "Ubicacion", "Dato faltante"],
    rows: [
      ["NB-24044", "Notebook Operativa", "Notebook", "-", "Oficina Norte", "Usuario"],
      ["MN-11502", "Monitor Corporativo", "Monitor", "Carla Rosales", "-", "Ubicacion"],
      ["DK-19128", "Docking USB-C", "Periferico", "-", "-", "Ambos"],
    ],
  },
  {
    id: "report-17",
    name: "Inconsistencias entre CMDB y actas",
    category: "Calidad CMDB",
    frequency: "Semanal",
    description:
      "Compara la relacion documental con el estado actual de CMDB para encontrar activos con asignacion, estado o custodio que no coinciden con el respaldo emitido.",
    parameters: [
      { type: "date", label: "Desde", key: "from_date" },
      { type: "date", label: "Hasta", key: "to_date" },
      { type: "select", label: "Tipo de diferencia", key: "difference", options: ["Todos", "Usuario", "Estado", "Documento faltante"] },
      { type: "select", label: "Prioridad", key: "priority", options: ["Todas", "Alta", "Media", "Baja"] },
    ],
    columns: ["Activo", "CMDB actual", "Documento", "Dato observado", "Diferencia", "Prioridad"],
    rows: [
      ["NB-24017", "Paula Ferreyra", "ENT-2026-0317", "Usuario", "Sin diferencia", "Baja"],
      ["NB-24025", "Ivana Paez", "-", "Documento faltante", "Asignacion sin acta", "Alta"],
      ["PR-70031", "En revision", "REC-2026-0138", "Estado", "CMDB sin actualizar", "Media"],
    ],
  },
  {
    id: "report-18",
    name: "Activos por locacion",
    category: "Inventario",
    frequency: "Semanal",
    description:
      "Distribuye el inventario por sede o ubicacion logica para facilitar control territorial, planificacion de soporte y validacion de presencia operativa.",
    parameters: [
      { type: "select", label: "Locacion", key: "location", options: ["Todas", "Oficina Central", "Oficina Norte", "Finanzas", "Mesa de ayuda", "Datacenter San Juan"] },
      { type: "select", label: "Tipo de activo", key: "asset_type", options: ["Todos", "Notebook", "Desktop", "Monitor", "Periferico", "Servidor"] },
      { type: "select", label: "Estado", key: "status", options: ["Todos", "Asignado", "Laboratorio", "Pendiente", "Disponible"] },
      { type: "date", label: "Fecha corte", key: "cutoff" },
    ],
    columns: ["Locacion", "Codigo", "Activo", "Tipo", "Modelo", "Estado", "Usuario actual"],
    rows: [
      ["Oficina Central", "NB-24017", "Notebook Ejecutiva", "Notebook", "Latitude 5440", "Asignado", "Paula Ferreyra"],
      ["Finanzas", "MN-11044", "Monitor Corporativo", "Monitor", "P2423D", "Asignado", "Carla Rosales"],
      ["Mesa de ayuda", "NB-24021", "Notebook Analista", "Notebook", "EliteBook 840 G10", "Laboratorio", "Joaquin Herrera"],
    ],
  },
];

const CATEGORY_ORDER = ["Inventario", "Asignacion", "Movimientos", "Laboratorio", "Documental", "Renovacion", "Calidad CMDB"];

function getDateOffset(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildDefaultParams(report) {
  const defaults = {};

  for (let index = 0; index < report.parameters.length; index += 1) {
    const parameter = report.parameters[index];
    const nextParameter = report.parameters[index + 1];

    if (
      parameter?.type === "date" &&
      nextParameter?.type === "date" &&
      parameter.key === "from_date" &&
      nextParameter.key === "to_date"
    ) {
      defaults[parameter.key] = getDateOffset(-6);
      defaults[nextParameter.key] = getDateOffset(0);
      index += 1;
      continue;
    }

    if (parameter.type === "select") {
      defaults[parameter.key] = parameter.options[0];
      continue;
    }

    if (parameter.type === "date") {
      defaults[`${parameter.key}_start`] = getDateOffset(-6);
      defaults[`${parameter.key}_end`] = getDateOffset(0);
      continue;
    }

    defaults[parameter.key] = "";
  }

  return defaults;
}

function getFormColumnClass(parameterCount) {
  if (parameterCount === 3) return "grid-cols-1 md:grid-cols-3";
  if (parameterCount % 2 === 0) return "grid-cols-1 md:grid-cols-2";
  return "grid-cols-1";
}

function getVisibleParameters(parameters) {
  const visibleParameters = [];

  for (let index = 0; index < parameters.length; index += 1) {
    const current = parameters[index];
    const next = parameters[index + 1];

    if (
      current?.type === "date" &&
      next?.type === "date" &&
      current.key === "from_date" &&
      next.key === "to_date"
    ) {
      visibleParameters.push({
        type: "date-range",
        key: `${current.key}:${next.key}`,
        label: "Rango de fechas",
        startKey: current.key,
        endKey: next.key,
      });
      index += 1;
      continue;
    }

    if (current?.type === "date") {
      visibleParameters.push({
        type: "date-range",
        key: `${current.key}_start:${current.key}_end`,
        label: current.label,
        startKey: `${current.key}_start`,
        endKey: `${current.key}_end`,
      });
      continue;
    }

    visibleParameters.push(current);
  }

  return visibleParameters;
}

function ReportToggleButton({ isCollapsed, onClick, collapsedLabel, expandedLabel }) {
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

function ReportIconButton({ title, onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--border-strong)] bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-[var(--shadow-subtle)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function ReportParameterField({ parameter, value, onChange }) {
  if (parameter.type === "date-range") {
    return (
      <FilterDateField
        label={parameter.label}
        mode="range"
        startValue={value?.start ?? ""}
        endValue={value?.end ?? ""}
        onRangeChange={({ start, end }) => onChange(parameter.key, { start, end })}
      />
    );
  }

  if (parameter.type === "date") {
    return (
      <FilterDateField
        label={parameter.label}
        mode="single"
        value={value ?? ""}
        onChange={(nextValue) => onChange(parameter.key, nextValue)}
      />
    );
  }

  const inputClassName =
    "w-full min-w-0 border-none bg-transparent p-0 text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]";

  if (parameter.type === "select") {
    return (
      <FilterDropdown
        label={parameter.label}
        options={[
          { value: "all", label: parameter.options[0] },
          ...parameter.options.slice(1).map((option) => ({
            value: option,
            label: option,
          })),
        ]}
        selectedValues={value && value !== parameter.options[0] ? [value] : []}
        selectionMode="single"
        onToggleOption={(nextValue) =>
          onChange(parameter.key, nextValue === "all" ? parameter.options[0] : nextValue)
        }
        onClear={() => onChange(parameter.key, parameter.options[0])}
        title={`Filtrar por ${parameter.label.toLowerCase()}`}
        showTriggerIcon={true}
        triggerClassName="min-h-[66px]"
        buttonHeightClassName="min-h-[66px]"
        menuOffsetClassName="top-[calc(100%+0.55rem)]"
        menuClassName="rounded-[18px]"
        renderSelection={({ label, selectedOptions }) => (
          <>
            <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {label}
            </span>
            <span className="mt-1 block truncate text-sm font-semibold text-[var(--text-primary)]">
              {selectedOptions[0]?.label ?? parameter.options[0]}
            </span>
          </>
        )}
        renderOptionDescription={(option) =>
          option.value === "all" ? "Sin restriccion aplicada" : "Selecciona un valor"
        }
        renderOptionLeading={() => (
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
        )}
        getOptionClassName={(_, isActive) =>
          isActive
            ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
            : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"
        }
      />
    );
  }

  return (
    <label className="flex min-h-[66px] min-w-0 items-center gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 shadow-[var(--shadow-subtle)] transition focus-within:border-[var(--accent-strong)]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-panel)] text-[var(--accent-strong)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M11 19a8 8 0 1 1 5.3-14l4.2 4.2-1.4 1.4-4.2-4.2A6 6 0 1 0 17 11h2a8 8 0 0 1-8 8z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <span className="grid min-w-0 flex-1 gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {parameter.label}
        </span>
        <input
          type="search"
          value={value ?? ""}
          onChange={(event) => onChange(parameter.key, event.target.value)}
          placeholder={parameter.placeholder || ""}
          className={inputClassName}
        />
      </span>
    </label>
  );
}

function ReportCategorySection({ category, items, isCollapsed, onToggle, onOpen }) {
  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Categoria
          </p>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{category}</h3>
            <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-1 text-[0.72rem] font-semibold text-[var(--text-secondary)]">
              {items.length} informe{items.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <ReportToggleButton
          isCollapsed={isCollapsed}
          onClick={onToggle}
          collapsedLabel="Expandir categoria"
          expandedLabel="Colapsar categoria"
        />
      </div>

      {!isCollapsed ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {items.map((report) => (
            <article
              key={report.id}
              className="flex h-full flex-col rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-panel-muted)] p-5"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <h4 className="text-base font-semibold text-[var(--text-primary)]">{report.name}</h4>
                <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-1 text-[0.72rem] font-semibold text-[var(--text-secondary)]">
                  {report.frequency}
                </span>
              </div>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">{report.description}</p>
              <div className="mt-4 flex justify-center pt-4">
                <SoftActionButton onClick={() => onOpen(report.id)}>
                  Ver informe
                </SoftActionButton>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ReportsPage() {
  const [activeReportId, setActiveReportId] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState(() =>
    CATEGORY_ORDER.reduce((acc, category, index) => {
      acc[category] = index !== 0;
      return acc;
    }, {})
  );
  const [isParamsCollapsed, setIsParamsCollapsed] = useState(true);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(true);
  const [reportParams, setReportParams] = useState({});
  const [reportResults, setReportResults] = useState({});
  const [reportVisibleColumns, setReportVisibleColumns] = useState({});

  const groupedReports = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: REPORTS.filter((report) => report.category === category),
      })).filter((group) => group.items.length),
    []
  );

  const activeReport = useMemo(
    () => REPORTS.find((report) => report.id === activeReportId) || null,
    [activeReportId]
  );
  const visibleParameters = useMemo(
    () => (activeReport ? getVisibleParameters(activeReport.parameters) : []),
    [activeReport]
  );

  const activeParams = activeReport ? reportParams[activeReport.id] ?? buildDefaultParams(activeReport) : {};
  const activeRows = activeReport ? reportResults[activeReport.id] ?? [] : [];
  const activeVisibleColumns = activeReport
    ? reportVisibleColumns[activeReport.id] ?? activeReport.columns
    : [];

  const openReport = (reportId) => {
    const nextReport = REPORTS.find((report) => report.id === reportId);
    if (!nextReport) return;

    setActiveReportId(reportId);
    setReportParams((current) => ({
      ...current,
      [reportId]: current[reportId] ?? buildDefaultParams(nextReport),
    }));
    setReportVisibleColumns((current) => ({
      ...current,
      [reportId]: current[reportId] ?? nextReport.columns,
    }));
    setIsParamsCollapsed(true);
    setIsResultsCollapsed(true);
  };

  const closeReport = () => {
    setActiveReportId(null);
    setIsParamsCollapsed(true);
    setIsResultsCollapsed(true);
  };

  const updateParam = (key, value) => {
    if (!activeReport) return;

    if (typeof value === "object" && value !== null && key.includes(":")) {
      const [startKey, endKey] = key.split(":");

      setReportParams((current) => ({
        ...current,
        [activeReport.id]: {
          ...(current[activeReport.id] ?? buildDefaultParams(activeReport)),
          [startKey]: value.start,
          [endKey]: value.end,
        },
      }));
      return;
    }

    setReportParams((current) => ({
      ...current,
      [activeReport.id]: {
        ...(current[activeReport.id] ?? buildDefaultParams(activeReport)),
        [key]: value,
      },
    }));
  };

  const runReport = () => {
    if (!activeReport) return;

    setReportResults((current) => ({
      ...current,
      [activeReport.id]: activeReport.rows,
    }));
    setIsResultsCollapsed(false);
  };

  const handleExport = () => {
    if (!activeReport || !activeRows.length) return;

    ModalManager.custom({
      title: `Exportar ${activeReport.name}`,
      size: "md",
      showFooter: false,
      content: (
        <div className="space-y-4">
          <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4 text-sm text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">Archivo</p>
            <p>{`${activeReport.name}.xlsx`}</p>
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() =>
                ModalManager.success({
                  title: "Exportacion preparada",
                  message: "Placeholder listo para conectar la descarga real del informe.",
                })
              }
            >
              Descargar
            </Button>
          </div>
        </div>
      ),
    });
  };

  const handleConfigureColumns = () => {
    if (!activeReport) return;

    const selectedColumns = new Set(activeVisibleColumns);

    const toggleColumn = (column) => {
      if (selectedColumns.has(column)) {
        if (selectedColumns.size === 1) return;
        selectedColumns.delete(column);
      } else {
        selectedColumns.add(column);
      }

      ModalManager.update(modalId, {
        content: renderColumnModalContent(),
      });
    };

    const applyColumns = () => {
      setReportVisibleColumns((current) => ({
        ...current,
        [activeReport.id]: activeReport.columns.filter((column) => selectedColumns.has(column)),
      }));
      ModalManager.close(modalId);
    };

    const renderColumnModalContent = () => (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeReport.columns.map((column) => {
            const isSelected = selectedColumns.has(column);

            return (
              <button
                key={column}
                type="button"
                onClick={() => toggleColumn(column)}
                className={`flex min-h-[108px] flex-col items-center justify-center gap-4 rounded-[18px] border p-4 text-center transition ${
                  isSelected
                    ? "border-[rgba(81,152,194,0.38)] bg-[rgba(81,152,194,0.12)] text-[var(--text-primary)] shadow-[0_10px_22px_rgba(81,152,194,0.12)]"
                    : "border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:border-[var(--accent-strong)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"
                }`}
                aria-pressed={isSelected}
              >
                <span className="block text-sm font-semibold leading-6 text-[var(--text-primary)]">
                  {column}
                </span>

                <span className="inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isSelected ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`} />
                  {isSelected ? "Visible" : "Oculta"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => ModalManager.close(modalId)}>
            Cancelar
          </Button>
          <SoftActionButton onClick={applyColumns}>
            Aplicar
          </SoftActionButton>
        </div>
      </div>
    );

    const modalId = ModalManager.custom({
      title: `Columnas de ${activeReport.name}`,
      size: "md",
      showFooter: false,
      content: renderColumnModalContent(),
    });
  };

  return (
    <div className="grid gap-5">
      {!activeReport ? (
        <Panel wide className="grid gap-6">
          <PanelHeader eyebrow="Catalogo" title="Informes disponibles" />

          <div className="grid gap-6">
            {groupedReports.map(({ category, items }, index) => (
              <div
                key={category}
                className={index > 0 ? "border-t border-[var(--border-color)] pt-6" : ""}
              >
                <ReportCategorySection
                  category={category}
                  items={items}
                  isCollapsed={collapsedCategories[category]}
                  onToggle={() =>
                    setCollapsedCategories((current) => ({
                      ...current,
                      [category]: !current[category],
                    }))
                  }
                  onOpen={openReport}
                />
              </div>
            ))}
          </div>
        </Panel>
      ) : (
        <div className="grid gap-5">
          <Panel wide>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={closeReport}
                className="inline-flex h-[52px] w-[52px] min-w-[52px] items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-muted)] text-[var(--text-primary)]"
                title="Volver a menu informes"
                aria-label="Volver a menu informes"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                  <path
                    d="M14.5 5.5L8 12l6.5 6.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div>
                <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Visualizacion de informe
                </p>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{activeReport.name}</h3>
                <p className="mt-2 max-w-[760px] text-sm leading-7 text-[var(--text-secondary)]">
                  {activeReport.description}
                </p>
              </div>
            </div>
          </Panel>

          <Panel wide>
            <PanelHeader
              eyebrow="Parametros"
              title="Configuracion del informe"
              actions={
                <>
                  <SoftActionButton onClick={runReport}>
                    Cargar datos
                  </SoftActionButton>
                  <ReportToggleButton
                    isCollapsed={isParamsCollapsed}
                    onClick={() => setIsParamsCollapsed((current) => !current)}
                    collapsedLabel="Expandir parametros"
                    expandedLabel="Colapsar parametros"
                  />
                </>
              }
            />

            {!isParamsCollapsed ? (
              <form className={`grid gap-4 ${getFormColumnClass(visibleParameters.length)}`}>
                {visibleParameters.map((parameter) => (
                  <ReportParameterField
                    key={parameter.key}
                    parameter={parameter}
                    value={
                      parameter.type === "date-range"
                        ? {
                            start: activeParams[parameter.startKey],
                            end: activeParams[parameter.endKey],
                          }
                        : activeParams[parameter.key]
                    }
                    onChange={updateParam}
                  />
                ))}
              </form>
            ) : null}
          </Panel>

          <Panel wide>
            <PanelHeader
              eyebrow="Datos"
              title="Resultado del informe"
              actions={
                <>
                  <ReportIconButton
                    title="Seleccionar columnas"
                    disabled={!activeReport}
                    onClick={handleConfigureColumns}
                  >
                    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" aria-hidden="true">
                      <path
                        d="M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M12 16v4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </ReportIconButton>
                  <ReportIconButton
                    title="Descargar datos"
                    disabled={!activeRows.length}
                    onClick={handleExport}
                  >
                    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" aria-hidden="true">
                      <path
                        d="M12 4v10M8 10l4 4 4-4M5 19h14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </ReportIconButton>
                  <ReportToggleButton
                    isCollapsed={isResultsCollapsed}
                    onClick={() => setIsResultsCollapsed((current) => !current)}
                    collapsedLabel="Expandir resultados"
                    expandedLabel="Colapsar resultados"
                  />
                </>
              }
            />

            {!isResultsCollapsed ? (
              activeRows.length ? (
                <div className="overflow-hidden rounded-[20px] border border-[var(--border-color)]">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[var(--bg-app)] text-[var(--text-muted)]">
                        <tr>
                          {activeVisibleColumns.map((column) => (
                            <th key={column} className="px-5 py-4 font-semibold uppercase tracking-[0.06em]">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeRows.map((row, rowIndex) => (
                          <tr key={`${activeReport.id}-${rowIndex}`} className="border-t border-[var(--border-color)]">
                            {row
                              .filter((_, cellIndex) => activeVisibleColumns.includes(activeReport.columns[cellIndex]))
                              .map((cell, cellIndex) => (
                              <td
                                key={`${activeReport.id}-${rowIndex}-${cellIndex}`}
                                className="px-5 py-4 text-[var(--text-secondary)]"
                              >
                                {cell}
                              </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-[20px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-8 text-sm text-[var(--text-secondary)]">
                  Configura los parametros y pulsa `Cargar datos` para visualizar el listado.
                </div>
              )
            ) : null}
          </Panel>
        </div>
      )}
    </div>
  );
}
