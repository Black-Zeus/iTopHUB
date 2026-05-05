import { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/App";
import ModalManager from "@/components/ui/modal";

export function HeaderUserMenu() {
  const { user, logout, refreshSession } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const displayName = user?.name ?? "Usuario";
  const displayMeta = user?.role ?? user?.email ?? "-";
  const profileRows = [
    { label: "Usuario", value: user?.username },
    { label: "Correo", value: user?.email },
    { label: "Perfil", value: user?.role },
    { label: "Estado", value: user?.status === "active" ? "Activo" : user?.status },
    { label: "Persona iTop", value: user?.itopPersonKey ? `ID ${user.itopPersonKey}` : "" },
    { label: "Acceso", value: user?.accessMode === "admin_limited" ? "Administrador limitado" : "Completo" },
  ].filter((item) => String(item.value || "").trim());
  const visibleModuleCount = user?.permissions?.viewModules?.length ?? 0;
  const writableModuleCount = user?.permissions?.writeModules?.length ?? 0;

  useEffect(() => {
    const handler = (event) => {
      if (!ref.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = displayName
    ? displayName.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase()
    : "??";

  const handleLogout = () => {
    Promise.resolve(logout()).finally(() => {
      navigate("/login");
    });
  };

  const openProfileModal = () => {
    setOpen(false);
    ModalManager.custom({
      title: `Perfil de ${displayName}`,
      size: "medium",
      showFooter: false,
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-lg font-bold text-[var(--accent-strong)]">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[var(--text-primary)]">{displayName}</p>
              <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">{displayMeta}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {profileRows.map((item) => (
              <div
                key={item.label}
                className="min-w-0 rounded-[14px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
              >
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {item.label}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Token iTop
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                {user?.hasRuntimeToken ? "Activo" : user?.hasItopToken ? "Registrado" : "No registrado"}
              </p>
            </div>
            <div className="rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Modulos
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{visibleModuleCount}</p>
            </div>
            <div className="rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Escritura
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{writableModuleCount}</p>
            </div>
          </div>

          {user?.notice ? (
            <div className="rounded-[14px] border border-[rgba(210,171,105,0.32)] bg-[rgba(210,171,105,0.1)] px-4 py-3 text-sm text-[var(--text-primary)]">
              {user.notice}
            </div>
          ) : null}
        </div>
      ),
    });
  };

  const handleRefreshSession = async () => {
    setOpen(false);
    setRefreshing(true);
    try {
      await refreshSession();
      ModalManager.success({
        title: "Permisos recargados",
        message: "La sesion se actualizo con la parametrizacion vigente del Hub.",
      });
    } catch (error) {
      ModalManager.error({
        title: "No fue posible recargar",
        message: error.message || "No se pudo actualizar la sesion actual.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((currentValue) => !currentValue)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-w-[220px] items-center gap-3 rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] max-[768px]:w-full max-[768px]:min-w-0"
      >
        <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent-strong)]">
          {initials}
        </span>
        <span className="min-w-0 text-left">
          <strong className="block truncate text-[0.92rem] font-semibold text-[var(--text-primary)]">
            {displayName}
          </strong>
          <span className="block truncate text-[0.82rem] text-[var(--text-muted)]">{displayMeta}</span>
        </span>
        <span className="ml-auto inline-flex items-center justify-center text-[var(--text-secondary)]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 grid w-[320px] gap-1 rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-soft)] max-[768px]:w-[min(320px,100%)]">
          <div className="border-b border-[var(--border-color)] px-4 py-3">
            <p className="block truncate text-[0.92rem] font-semibold text-[var(--text-primary)]">{displayName}</p>
            <p className="block truncate text-[0.82rem] text-[var(--text-muted)]">{displayMeta}</p>
          </div>
          <div className="grid gap-1">
            <button
              onClick={openProfileModal}
              className="flex w-full items-center gap-2 rounded-[10px] bg-transparent px-3 py-3 text-left text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              </svg>
              Perfil
            </button>
            <button
              onClick={handleRefreshSession}
              disabled={refreshing}
              className="flex w-full items-center gap-2 rounded-[10px] bg-transparent px-3 py-3 text-left text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-60"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
              {refreshing ? "Recargando..." : "Recargar permisos"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center gap-2 rounded-[10px] bg-transparent px-3 py-3 text-left text-[var(--danger)] transition hover:bg-[rgba(210,138,138,0.1)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Cerrar sesion
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
