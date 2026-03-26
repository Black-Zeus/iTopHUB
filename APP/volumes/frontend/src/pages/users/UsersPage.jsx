import { useMemo } from "react";
import { ActaModulePage } from "../../components/ui/general/ActaModulePage";
import { StatusChip, normalizeStatus } from "../../components/ui/general/StatusChip";
import { Button } from "../../ui/Button";
import { Icon } from "../../components/ui/icon/Icon";
import ModalManager from "../../components/ui/modal";

const USER_ROWS = [
  {
    id: 1,
    code: "USR-001",
    person: "Victor Soto",
    asset: "victor.soto@itophub.local",
    area: "Administracion",
    date: "2026-03-24",
    status: "operativo",
    role: "Administrador",
  },
  {
    id: 2,
    code: "USR-002",
    person: "Camila Soto",
    asset: "camila.soto@itophub.local",
    area: "Recepcion",
    date: "2026-03-23",
    status: "asignado",
    role: "Operadora",
  },
  {
    id: 3,
    code: "USR-003",
    person: "Joaquin Herrera",
    asset: "joaquin.herrera@itophub.local",
    area: "Laboratorio",
    date: "2026-03-22",
    status: "laboratorio",
    role: "Tecnico",
  },
  {
    id: 4,
    code: "USR-004",
    person: "Andrea Vera",
    asset: "andrea.vera@itophub.local",
    area: "Comercial",
    date: "2026-03-21",
    status: "pendiente",
    role: "Supervisora",
  },
];

function buildUserKpis(rows) {
  return [
    {
      label: "Total usuarios",
      value: String(rows.length).padStart(2, "0"),
      helper: "Accesos visibles",
      tone: "default",
    },
    {
      label: "Operativos",
      value: String(rows.filter((row) => normalizeStatus(row.status) === "operativo").length).padStart(2, "0"),
      helper: "Con acceso activo",
      tone: "success",
    },
    {
      label: "Asignados",
      value: String(rows.filter((row) => normalizeStatus(row.status) === "asignado").length).padStart(2, "0"),
      helper: "Con rol aplicado",
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

export function UsersPage() {
  const columns = useMemo(
    () => [
      { key: "code", label: "Codigo", sortable: true },
      { key: "person", label: "Usuario", sortable: true },
      { key: "asset", label: "Correo", sortable: true },
      { key: "area", label: "Area", sortable: true },
      { key: "role", label: "Rol", sortable: true },
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
                title: `Usuario ${row.person}`,
                message: "Placeholder inicial para la ficha de usuario.",
                content: (
                  <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4 text-sm text-[var(--text-secondary)]">
                    <p><span className="font-semibold text-[var(--text-primary)]">Correo:</span> {row.asset}</p>
                    <p><span className="font-semibold text-[var(--text-primary)]">Area:</span> {row.area}</p>
                    <p><span className="font-semibold text-[var(--text-primary)]">Rol:</span> {row.role}</p>
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
      eyebrow="Administracion"
      title="Usuarios del Sistema"
      searchPlaceholder="Buscar por codigo, usuario, correo, area o rol"
      statusOptions={[
        { value: "operativo", label: "Operativo" },
        { value: "asignado", label: "Asignado" },
        { value: "laboratorio", label: "Laboratorio" },
        { value: "pendiente", label: "Pendiente" },
      ]}
      rows={USER_ROWS}
      columns={columns}
      searchKeys={["code", "person", "asset", "area", "role", "date"]}
      buildKpis={buildUserKpis}
      primaryActionLabel="Nuevo usuario"
      primaryActionIcon="plus"
      onPrimaryAction={() =>
        ModalManager.info({
          title: "Nuevo usuario",
          message: "Placeholder inicial para la creacion de usuarios.",
          content: (
            <p className="text-sm text-[var(--text-secondary)]">
              Aqui conectaremos el formulario para crear usuarios y asignarles permisos.
            </p>
          ),
        })
      }
      emptyMessage="No hay usuarios que coincidan con los filtros actuales."
    />
  );
}
