/**
 * SidebarMenuGroup - agrupacion semantica de items del nav.
 */
export function SidebarMenuGroup({ label, children, collapsed = false }) {
  return (
    <div className="sidebar-group">
      {label ? (
        <p
          className="sidebar-group-label"
          style={collapsed ? { opacity: 0, height: 0, pointerEvents: "none" } : { opacity: 1, height: "auto" }}
        >
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
}
