import { ActaModulePage } from "../../components/ui/general/ActaModulePage";

const LAB_ROWS = [
  { id: 1, code: "LAB-0021", person: "Marcelo Fuentes", asset: "Dell Latitude 7420", area: "Soporte", date: "2026-03-24", status: "laboratorio" },
  { id: 2, code: "LAB-0022", person: "Camila Soto", asset: "iPhone 12", area: "Comercial", date: "2026-03-23", status: "pendiente" },
  { id: 3, code: "LAB-0023", person: "Nicolas Vera", asset: "HP ProBook 445", area: "Finanzas", date: "2026-03-22", status: "operativo" },
  { id: 4, code: "LAB-0024", person: "Daniela Riquelme", asset: "Monitor Dell 24", area: "Operaciones", date: "2026-03-21", status: "baja" },
];

export function LabPage() {
  return (
    <ActaModulePage
      eyebrow="Laboratorio"
      title="Actas de Laboratorio"
      searchPlaceholder="Buscar por acta, tecnico responsable o equipo en revision"
      statusOptions={[
        { value: "laboratorio", label: "Laboratorio" },
        { value: "pendiente", label: "Pendiente" },
        { value: "operativo", label: "Operativo" },
        { value: "baja", label: "Baja" },
      ]}
      rows={LAB_ROWS}
    />
  );
}
