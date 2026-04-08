import { Outlet } from "react-router-dom";
import { useContext } from "react";
import { Sidebar } from "./sidebar/Sidebar";
import { HeaderContainer } from "./header/HeaderContainer";
import { useSidebar } from "../hooks/useSidebar";
import { AuthContext } from "@/App";

/**
 * Layout (AppShell) - grid principal de la app autenticada.
 * Sidebar | HeaderContainer + <Outlet />
 */
export function Layout() {
  const { user } = useContext(AuthContext);
  const { collapsed, toggle } = useSidebar();

  return (
    <div
      className={`grid min-h-screen isolate transition-[grid-template-columns] duration-[250ms] ease-in-out ${
        collapsed ? "[grid-template-columns:112px_minmax(0,1fr)]" : "[grid-template-columns:280px_minmax(0,1fr)]"
      } max-[1024px]:[grid-template-columns:112px_minmax(0,1fr)] max-[768px]:grid-cols-1`}
    >
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-col max-[768px]:min-h-screen">
        <HeaderContainer />
        {user?.notice ? (
          <div className="border-b border-[rgba(214,162,61,0.35)] bg-[rgba(214,162,61,0.14)] px-8 py-3 text-sm text-[var(--text-primary)] max-[1024px]:px-6 max-[768px]:px-4">
            {user.notice}
          </div>
        ) : null}
        <main className="flex-1 overflow-y-auto bg-[var(--bg-app)] p-8 max-[1024px]:p-6 max-[768px]:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
