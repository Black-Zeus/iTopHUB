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
    <div ref={ref} className="user-chip-wrap">
      <button
        onClick={() => setOpen((currentValue) => !currentValue)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="user-chip"
      >
        <span className="user-chip-avatar">{initials}</span>
        <span className="user-chip-copy">
          <strong className="user-chip-name">{displayName}</strong>
          <span className="user-chip-meta">{displayMeta}</span>
        </span>
        <span className="user-chip-caret" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="user-chip-menu">
          <div className="user-chip-menu-header">
            <p className="user-chip-name">{displayName}</p>
            <p className="user-chip-meta">{displayMeta}</p>
          </div>
          <div>
            <button onClick={handleLogout} className="user-chip-menu-action">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
