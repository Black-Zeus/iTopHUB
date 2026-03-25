/**
 * SidebarToggle - boton flotante para colapsar o expandir el sidebar.
 */
export function SidebarToggle({ collapsed, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
      className={`sidebar-toggle${collapsed ? " is-collapsed" : ""}`}
    >
      <span className="sidebar-toggle-icon" aria-hidden="true">
        <svg className="sidebar-toggle-svg" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M14.5 5.5L8 12l6.5 6.5" />
        </svg>
      </span>
    </button>
  );
}
