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
    ModalManager.info({
      title: "Perfil",
      message: "Placeholder inicial para la vista de perfil.",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Aqui mostraremos los datos del usuario autenticado.
          </p>
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4 text-sm text-[var(--text-secondary)]">
            <p><span className="font-semibold text-[var(--text-primary)]">Nombre:</span> {displayName}</p>
            <p><span className="font-semibold text-[var(--text-primary)]">Referencia:</span> {displayMeta}</p>
          </div>
        </div>
      ),
    });
  };

  const openPasswordModal = () => {
    setOpen(false);
    ModalManager.info({
      title: "Cambiar contrasena",
      message: "Placeholder inicial para el cambio de contrasena.",
      content: (
        <p className="text-sm text-[var(--text-secondary)]">
          Aqui conectaremos el formulario para actualizar la contrasena del usuario.
        </p>
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
              onClick={openPasswordModal}
              className="flex w-full items-center gap-2 rounded-[10px] bg-transparent px-3 py-3 text-left text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <path d="M7 11V8a5 5 0 0 1 10 0v3" />
              </svg>
              Cambiar contrasena
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
