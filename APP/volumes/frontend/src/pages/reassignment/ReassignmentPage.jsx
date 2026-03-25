import { ActaModulePage } from "../../components/ui/general/ActaModulePage";

const REASSIGNMENT_ROWS = [
  { id: 1, code: "REA-0007", person: "Claudia Neira", asset: "Dell 5420", area: "RRHH", date: "2026-03-24", status: "asignado" },
  { id: 2, code: "REA-0008", person: "Ignacio Pinto", asset: "Samsung A54", area: "Operaciones", date: "2026-03-22", status: "pendiente" },
  { id: 3, code: "REA-0009", person: "Valentina Diaz", asset: "HP EliteBook 840", area: "Compras", date: "2026-03-21", status: "operativo" },
  { id: 4, code: "REA-0010", person: "Rodrigo Pavez", asset: "Monitor LG 27", area: "Contabilidad", date: "2026-03-20", status: "laboratorio" },
];

export function ReassignmentPage() {
  return (
    <ActaModulePage
      eyebrow="Operacion"
      title="Acta de Reasignacion"
      searchPlaceholder="Buscar por acta, nuevo responsable o activo"
      statusOptions={[
        { value: "asignado", label: "Asignado" },
        { value: "operativo", label: "Operativo" },
        { value: "pendiente", label: "Pendiente" },
        { value: "laboratorio", label: "Laboratorio" },
      ]}
      rows={REASSIGNMENT_ROWS}
    />
  );
}
