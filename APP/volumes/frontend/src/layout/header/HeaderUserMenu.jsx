import { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/App";

export function HeaderUserMenu() {
  const { user, logout } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
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
    logout();
    navigate("/login");
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
          <div>
            <button
              onClick={handleLogout}
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
