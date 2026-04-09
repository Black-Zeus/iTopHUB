import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/App";
import { ActaModulePage } from "../../components/ui/general/ActaModulePage";
import { StatusChip, normalizeStatus } from "../../components/ui/general/StatusChip";
import { Button } from "../../ui/Button";
import { Icon } from "../../components/ui/icon/Icon";
import ModalManager from "../../components/ui/modal";
import { createUser, getUserRoles, getUsers, searchItopUsers, updateUser } from "../../services/user-service";


const STATUS_OPTIONS = [
  { value: "operativo", label: "Operativo" },
  { value: "asignado", label: "Asignado" },
  { value: "laboratorio", label: "Laboratorio" },
  { value: "pendiente", label: "Pendiente" },
  { value: "inactivo", label: "Inactivo" },
  { value: "bloqueado", label: "Bloqueado" },
];

const STATUS_CODE_OPTIONS = [
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "blocked", label: "Bloqueado" },
];


function mapUserStatusToTable(statusCode) {
  if (statusCode === "blocked") return "pendiente";
  if (statusCode === "inactive") return "asignado";
  return "operativo";
}


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
      label: "Sin token",
      value: String(rows.filter((row) => !row.hasToken).length).padStart(2, "0"),
      helper: "Requieren token Hub",
      tone: "warning",
    },
    {
      label: "Bloqueados",
      value: String(rows.filter((row) => row.statusCode === "blocked").length).padStart(2, "0"),
      helper: "Con accion requerida",
      tone: "danger",
    },
  ];
}


function UserEditModalContent({ user, roles, onCancel, onSave }) {
  const [form, setForm] = useState({
    fullName: user.person,
    roleCode: user.roleCode,
    statusCode: user.statusCode,
    tokenValue: user.tokenMasked || "",
    tokenChanged: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave({
        fullName: form.fullName.trim(),
        roleCode: form.roleCode,
        statusCode: form.statusCode,
        tokenValue: form.tokenChanged ? form.tokenValue.trim() : "",
        tokenChanged: form.tokenChanged,
      });
    } catch (saveError) {
      setError(saveError.message || "No fue posible guardar el usuario.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Usuario</span>
          <input
            type="text"
            value={user.username}
            readOnly
            className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 text-sm text-[var(--text-secondary)] outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Nombre</span>
          <input
            type="text"
            value={form.fullName}
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Rol</span>
          <select
            value={form.roleCode}
            onChange={(event) => setForm((current) => ({ ...current, roleCode: event.target.value }))}
            className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none"
          >
            {roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Estado</span>
          <select
            value={form.statusCode}
            onChange={(event) => setForm((current) => ({ ...current, statusCode: event.target.value }))}
            className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none"
          >
            {STATUS_CODE_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Token personal de iTop</span>
          <input
            type="text"
            value={form.tokenValue}
            onFocus={() =>
              setForm((current) => (
                current.tokenChanged
                  ? current
                  : { ...current, tokenValue: "", tokenChanged: true }
              ))
            }
            onChange={(event) => setForm((current) => ({ ...current, tokenValue: event.target.value, tokenChanged: true }))}
            placeholder={user.hasToken ? "Ingresa un nuevo token para reemplazar el actual" : "usr_..."}
            className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none"
          />
        </label>
      </div>

      <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-secondary)]">
        El token se muestra ofuscado con los primeros 3 y ultimos 3 caracteres visibles. Solo se reemplaza si editas ese campo. Si lo dejas vacio despues de modificarlo, el usuario quedara sin token Hub.
      </div>

      {error ? (
        <div className="rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
          {error}
        </div>
      ) : null}

      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>
          {saving ? "Guardando..." : "Guardar usuario"}
        </Button>
      </div>
    </div>
  );
}


function LinkUserModalContent({ roles, onCancel, onSave }) {
  const [form, setForm] = useState({
    username: "",
    fullName: "",
    roleCode: roles[0]?.code || "support_general",
    statusCode: "active",
  });
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (form.username.trim().length < 2) {
        setSuggestions([]);
        setError("");
        return;
      }

      setLoadingSuggestions(true);
      try {
        const result = await searchItopUsers(form.username.trim());
        if (!cancelled) {
          setSuggestions(result);
          setError("");
        }
      } catch (searchError) {
        if (!cancelled) {
          setSuggestions([]);
          setError(searchError.message || "No fue posible buscar usuarios iTop.");
        }
      } finally {
        if (!cancelled) {
          setLoadingSuggestions(false);
        }
      }
    };

    const timer = window.setTimeout(run, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.username]);

  const selectSuggestion = (item) => {
    setForm((current) => ({
      ...current,
      username: item.username,
      fullName: item.fullName || item.username,
    }));
    setSuggestions([]);
    setError("");
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave({
        username: form.username.trim(),
        fullName: form.fullName.trim() || form.username.trim(),
        roleCode: form.roleCode,
        statusCode: form.statusCode,
      });
    } catch (saveError) {
      setError(saveError.message || "No fue posible vincular el usuario.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2 md:col-span-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Usuario iTop</span>
          <div className="relative">
            <input
              type="text"
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              placeholder="Escribe login de iTop"
              className="h-[50px] w-full rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none"
            />
            {(loadingSuggestions || suggestions.length > 0) && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-soft)]">
                {loadingSuggestions ? (
                  <div className="px-3 py-2 text-sm text-[var(--text-secondary)]">Buscando usuarios iTop...</div>
                ) : (
                  suggestions.map((item) => (
                    <button
                      key={`${item.itopClass}-${item.username}`}
                      type="button"
                      onClick={() => selectSuggestion(item)}
                      className="flex w-full items-start justify-between gap-3 rounded-[12px] px-3 py-3 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-app)]"
                    >
                      <span>
                        <span className="block font-semibold">{item.username}</span>
                        <span className="block text-xs text-[var(--text-secondary)]">{item.fullName}</span>
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{item.itopClass}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Nombre visible</span>
          <input
            type="text"
            value={form.fullName}
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Rol</span>
          <select
            value={form.roleCode}
            onChange={(event) => setForm((current) => ({ ...current, roleCode: event.target.value }))}
            className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none"
          >
            {roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Estado</span>
          <select
            value={form.statusCode}
            onChange={(event) => setForm((current) => ({ ...current, statusCode: event.target.value }))}
            className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none"
          >
            {STATUS_CODE_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-secondary)]">
        Aqui no creas cuentas nuevas en iTop. Solo vinculas al Hub usuarios que ya existen en iTop. El buscador consulta clases de usuarios de iTop, no Personas.
      </div>

      {error ? (
        <div className="rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
          {error}
        </div>
      ) : null}

      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving || !form.username.trim()}>
          {saving ? "Vinculando..." : "Vincular usuario"}
        </Button>
      </div>
    </div>
  );
}


export function UsersPage() {
  const { user: sessionUser, refreshSession } = useContext(AuthContext);
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const [usersPayload, rolesPayload] = await Promise.all([getUsers(), getUserRoles()]);
      setRows(usersPayload.map((user) => ({ ...user, status: mapUserStatusToTable(user.statusCode) })));
      setRoles(rolesPayload);
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openEditModal = (row) => {
    const modalId = ModalManager.custom({
      title: `Editar ${row.person}`,
      size: "clientWide",
      showFooter: false,
      content: (
        <UserEditModalContent
          user={row}
          roles={roles}
          onCancel={() => ModalManager.close(modalId)}
          onSave={async (payload) => {
            const response = await updateUser(row.id, payload);
            const updated = response.item;
            setRows((currentRows) =>
              currentRows.map((currentRow) =>
                currentRow.id === row.id
                  ? { ...updated, status: mapUserStatusToTable(updated.statusCode) }
                  : currentRow
              )
            );
            if (response.session || row.id === sessionUser?.id) {
              await refreshSession();
            }
            ModalManager.close(modalId);
            ModalManager.success({
              title: "Usuario actualizado",
              message: `${updated.person} fue actualizado correctamente.`,
            });
          }}
        />
      ),
    });
  };

  const openCreateModal = () => {
    const modalId = ModalManager.custom({
      title: "Vincular usuario",
      size: "clientWide",
      showFooter: false,
      content: (
        <LinkUserModalContent
          roles={roles}
          onCancel={() => ModalManager.close(modalId)}
          onSave={async (payload) => {
            const created = await createUser(payload);
            setRows((currentRows) => [
              { ...created, status: mapUserStatusToTable(created.statusCode) },
              ...currentRows,
            ]);
            ModalManager.close(modalId);
            ModalManager.success({
              title: "Usuario vinculado",
              message: `${created.person} fue vinculado correctamente al Hub.`,
            });
          }}
        />
      ),
    });
  };

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
          <Button type="button" variant="secondary" size="sm" onClick={() => openEditModal(row)}>
            <Icon name="edit" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Editar
          </Button>
        ),
      },
    ],
    [roles, sessionUser]
  );

  return (
    <div className="grid gap-4">
      {error ? (
        <div className="rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
          {error}
        </div>
      ) : null}

      <ActaModulePage
        eyebrow="Administracion"
        title="Usuarios del Sistema"
        searchPlaceholder="Buscar por codigo, usuario, correo, area o rol"
        useRichSearchInput
        statusOptions={STATUS_OPTIONS}
        rows={rows}
        loading={loading}
        columns={columns}
        searchKeys={["code", "person", "asset", "area", "role", "date", "username"]}
        buildKpis={buildUserKpis}
        primaryActionLabel="Vincular usuario"
        primaryActionIcon="plus"
        onPrimaryAction={openCreateModal}
        emptyMessage="No hay usuarios que coincidan con los filtros actuales."
      />
    </div>
  );
}
