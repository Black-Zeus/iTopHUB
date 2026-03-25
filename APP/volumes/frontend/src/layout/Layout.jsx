import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar/Sidebar";
import { HeaderContainer } from "./header/HeaderContainer";
import { useSidebar } from "../hooks/useSidebar";
import "@styles/layout.css";

/**
 * Layout (AppShell) - grid principal de la app autenticada.
 * Sidebar | HeaderContainer + <Outlet />
 */
export function Layout() {
  const { collapsed, toggle } = useSidebar();

  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="content-shell">
        <HeaderContainer />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
