import { useMemo } from "react";
import { ActaModulePage } from "../../components/ui/general/ActaModulePage";
import { StatusChip, normalizeStatus } from "../../components/ui/general/StatusChip";
import { Button } from "../../ui/Button";
import { Icon } from "../../components/ui/icon/Icon";
import ModalManager from "../../components/ui/modal";

const PEOPLE_ROWS = [
  {
    id: 1,
    code: "PER-001",
    person: "Paula Ferreyra",
    asset: "paula.ferreyra@itophub.local",
    area: "Infraestructura",
    date: "2026-03-24",
    status: "asignado",
    role: "Jefa de Operaciones",
  },
  {
    id: 2,
    code: "PER-002",
    person: "Joaquin Herrera",
    asset: "joaquin.herrera@itophub.local",
    area: "Laboratorio",
    date: "2026-03-23",
    status: "laboratorio",
    role: "Tecnico Senior",
  },
  {
    id: 3,
    code: "PER-003",
    person: "Camila Soto",
    asset: "camila.soto@itophub.local",
    area: "Recepcion",
    date: "2026-03-22",
    status: "pendiente",
    role: "Analista de Recepcion",
  },
  {
    id: 4,
    code: "PER-004",
    person: "Andrea Vera",
    asset: "andrea.vera@itophub.local",
    area: "Comercial",
    date: "2026-03-21",
    status: "operativo",
    role: "Ejecutiva Comercial",
  },
];

function buildPeopleKpis(rows) {
  return [
    {
      label: "Total personas",
      value: String(rows.length).padStart(2, "0"),
      helper: "Padron visible",
      tone: "default",
    },
    {
      label: "Asignadas",
      value: String(rows.filter((row) => normalizeStatus(row.status) === "asignado").length).padStart(2, "0"),
      helper: "Con activos asociados",
      tone: "success",
    },
    {
      label: "En laboratorio",
      value: String(rows.filter((row) => normalizeStatus(row.status) === "laboratorio").length).padStart(2, "0"),
      helper: "Con revision tecnica",
      tone: "warning",
    },
    {
      label: "Pendientes",
      value: String(rows.filter((row) => normalizeStatus(row.status) === "pendiente").length).padStart(2, "0"),
      helper: "Con accion requerida",
      tone: "danger",
    },
  ];
}

export function PeoplePage() {
  const columns = useMemo(
    () => [
      { key: "code", label: "Codigo", sortable: true },
      { key: "person", label: "Nombre", sortable: true },
      { key: "asset", label: "Correo", sortable: true },
      { key: "area", label: "Area", sortable: true },
      { key: "role", label: "Cargo", sortable: true },
      {
        key: "status",
        label: "Estado",
        render: (value) => <StatusChip status={value} />,
      },
      {
        key: "action",
        label: "Acciones",
        render: (_, row) => (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              ModalManager.info({
                title: `Persona ${row.person}`,
                message: "Placeholder inicial para la ficha de persona.",
                content: (
                  <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4 text-sm text-[var(--text-secondary)]">
                    <p><span className="font-semibold text-[var(--text-primary)]">Correo:</span> {row.asset}</p>
                    <p><span className="font-semibold text-[var(--text-primary)]">Area:</span> {row.area}</p>
                    <p><span className="font-semibold text-[var(--text-primary)]">Cargo:</span> {row.role}</p>
                    <p><span className="font-semibold text-[var(--text-primary)]">Estado:</span> {row.status}</p>
                  </div>
                ),
              })
            }
          >
            <Icon name="eye" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Ver
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <ActaModulePage
      eyebrow="Consultas"
      title="Personas"
      searchPlaceholder="Buscar por codigo, nombre, correo o area"
      statusOptions={[
        { value: "asignado", label: "Asignado" },
        { value: "operativo", label: "Operativo" },
        { value: "laboratorio", label: "Laboratorio" },
        { value: "pendiente", label: "Pendiente" },
      ]}
      rows={PEOPLE_ROWS}
      columns={columns}
      searchKeys={["code", "person", "asset", "area", "role", "date"]}
      buildKpis={buildPeopleKpis}
      primaryActionLabel="Nueva persona"
      primaryActionIcon="plus"
      onPrimaryAction={() =>
        ModalManager.info({
          title: "Nueva persona",
          message: "Placeholder inicial para la creacion de personas.",
          content: (
            <p className="text-sm text-[var(--text-secondary)]">
              Aqui conectaremos el formulario para crear o importar personas desde CMDB.
            </p>
          ),
        })
      }
      emptyMessage="No hay personas que coincidan con los filtros actuales."
    />
  );
}
