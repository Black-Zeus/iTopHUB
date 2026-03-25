import { SidebarBrand } from "./SidebarBrand";
import { SidebarNav } from "./SidebarNav";
import { SidebarToggle } from "./SidebarToggle";
import "@styles/layout_side.css";

/**
 * Sidebar - aside principal de la app.
 */
export function Sidebar({ collapsed, onToggle }) {
  return (
    <>
      <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`}>
        <SidebarBrand collapsed={collapsed} />
        <SidebarNav collapsed={collapsed} />
      </aside>

      <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
    </>
  );
}
