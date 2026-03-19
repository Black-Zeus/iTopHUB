import { Outlet } from "react-router-dom";
import { Sidebar }          from "./sidebar/Sidebar";
import { HeaderContainer }  from "./header/HeaderContainer";
import { useSidebar }       from "../hooks/useSidebar";

/**
 * Layout (AppShell) — grid principal de la app autenticada.
 * Sidebar | HeaderContainer + <Outlet />
 *
 * El grid-template-columns refleja exactamente el .app-shell del Draft.
 */
export function Layout() {
  const { collapsed, toggle } = useSidebar();

  return (
    <div
      className="min-h-screen transition-[grid-template-columns] duration-[250ms] ease-in-out"
      style={{
        display: "grid",
        gridTemplateColumns: collapsed ? "112px minmax(0,1fr)" : "280px minmax(0,1fr)",
        isolation: "isolate",
      }}
    >
      {/* Columna izquierda */}
      <Sidebar collapsed={collapsed} onToggle={toggle} />

      {/* Columna derecha */}
      <div className="flex min-w-0 flex-col">
        <HeaderContainer />
        <main className="flex-1 overflow-y-auto bg-[var(--bg-app)] p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}