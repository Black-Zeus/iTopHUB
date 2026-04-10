import { MockActaModulePage } from "../../components/ui/general";

const RECEPTION_ROWS = [
  { id: 1, code: "REC-0041", person: "Mario Salgado", asset: "HP ProBook 440", area: "Comercial", date: "2026-03-24", status: "pendiente" },
  { id: 2, code: "REC-0042", person: "Javiera Mella", asset: "ThinkPad E14", area: "Operaciones", date: "2026-03-23", status: "laboratorio" },
  { id: 3, code: "REC-0043", person: "Sebastian Rios", asset: "Dock Lenovo USB-C", area: "TI", date: "2026-03-22", status: "disponible" },
  { id: 4, code: "REC-0044", person: "Andrea Vera", asset: "MacBook Air M2", area: "Diseno", date: "2026-03-21", status: "stock" },
];

export function ReceptionPage() {
  return (
    <MockActaModulePage
      eyebrow="Operacion"
      title="Actas de Recepcion"
      searchPlaceholder="Buscar por acta, origen o activo recibido"
      statusOptions={[
        { value: "pendiente", label: "Pendiente" },
        { value: "laboratorio", label: "Laboratorio" },
        { value: "disponible", label: "Disponible" },
        { value: "stock", label: "Stock" },
      ]}
      rows={RECEPTION_ROWS}
    />
  );
}
