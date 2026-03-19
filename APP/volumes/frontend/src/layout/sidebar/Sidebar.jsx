import { SidebarBrand }  from "./SidebarBrand";
import { SidebarNav }    from "./SidebarNav";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarToggle } from "./SidebarToggle";

/**
 * Sidebar — aside principal de la app
 * Recibe collapsed + onToggle desde Layout.jsx via useSidebar()
 */
export function Sidebar({ collapsed, onToggle }) {
  return (
    <>
      <aside
        className="sticky top-0 z-20 flex h-screen flex-col overflow-x-hidden overflow-y-auto border-r border-[var(--border-color)] scrollbar-gutter-stable transition-all duration-[250ms] ease-in-out"
        style={{
          background: "linear-gradient(180deg, var(--bg-sidebar) 0%, var(--bg-surface) 100%)",
          paddingInline: collapsed ? "1rem" : "1.25rem",
          paddingBlock: "2rem",
          gap: "2rem",
        }}
      >
        <SidebarBrand collapsed={collapsed} />
        <SidebarNav   collapsed={collapsed} />
        <SidebarFooter collapsed={collapsed} />
      </aside>

      <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
    </>
  );
}