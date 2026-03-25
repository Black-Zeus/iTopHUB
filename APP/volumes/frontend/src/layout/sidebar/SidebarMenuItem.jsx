/**
 * SidebarMenuItem - item individual del nav.
 */
export function SidebarMenuItem({ label, icon, active = false, collapsed = false, onClick }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`nav-link${active ? " is-active" : ""}${collapsed ? " is-collapsed" : ""}`}
    >
      <span className="nav-link-icon" aria-hidden="true">
        {icon}
      </span>
      <span
        className="nav-link-label"
        style={collapsed ? { opacity: 0, transform: "translateX(-10px)", width: 0, margin: 0, pointerEvents: "none" } : undefined}
      >
        {label}
      </span>
    </button>
  );
}
