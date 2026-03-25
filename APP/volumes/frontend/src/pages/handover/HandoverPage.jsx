import { ActaModulePage } from "../../components/ui/general/ActaModulePage";

const HANDOVER_ROWS = [
  { id: 1, code: "ENT-0012", person: "Victor Soto", asset: "Dell Latitude 5440", area: "Infraestructura", date: "2026-03-22", status: "asignado" },
  { id: 2, code: "ENT-0013", person: "Camila Rojas", asset: "Lenovo T14", area: "Soporte", date: "2026-03-21", status: "operativo" },
  { id: 3, code: "ENT-0014", person: "Daniel Ibarra", asset: "Monitor Samsung 24", area: "Finanzas", date: "2026-03-20", status: "pendiente" },
  { id: 4, code: "ENT-0015", person: "Paula Torres", asset: "iPhone 13", area: "Gerencia", date: "2026-03-19", status: "laboratorio" },
];

export function HandoverPage() {
  return (
    <ActaModulePage
      eyebrow="Operacion"
      title="Actas de Entrega"
      searchPlaceholder="Buscar por acta, colaborador o activo entregado"
      statusOptions={[
        { value: "asignado", label: "Asignado" },
        { value: "operativo", label: "Operativo" },
        { value: "pendiente", label: "Pendiente" },
        { value: "laboratorio", label: "Laboratorio" },
      ]}
      rows={HANDOVER_ROWS}
    />
  );
}
