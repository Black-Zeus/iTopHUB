/**
 * SidebarFooter - nota de version al pie del sidebar.
 */
export function SidebarFooter({ collapsed }) {
  return (
    <div className="sidebar-footer">
      <p
        className="sidebar-note"
        style={collapsed ? { opacity: 0, transform: "translateX(-10px)", pointerEvents: "none" } : { opacity: 1, transform: "none" }}
      >
        iTop Hub
        <br />
        <span style={{ fontSize: "0.72rem" }}>
          {import.meta.env.VITE_APP_NAME ?? "v0.1"} · dev
        </span>
      </p>
    </div>
  );
}
