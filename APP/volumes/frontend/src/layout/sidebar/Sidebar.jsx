import { SidebarBrand } from "./SidebarBrand";
import { SidebarNav } from "./SidebarNav";
import { SidebarToggle } from "./SidebarToggle";

/**
 * Sidebar - aside principal de la app.
 */
export function Sidebar({ collapsed, onToggle, brand = {} }) {
  return (
    <>
      <aside
        className={`sticky top-0 z-20 flex h-screen flex-col overflow-x-hidden overflow-y-auto border-r border-[var(--border-color)] bg-[linear-gradient(180deg,var(--bg-sidebar)_0%,var(--bg-surface)_100%)] px-5 py-6 transition-[padding] duration-[250ms] ease-in-out max-[768px]:hidden ${
          collapsed ? "overflow-y-hidden px-4" : ""
        }`}
        style={{ scrollbarGutter: "stable" }}
      >
        <SidebarBrand collapsed={collapsed} brand={brand} />
        <SidebarNav collapsed={collapsed} />
      </aside>

      <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
    </>
  );
}
