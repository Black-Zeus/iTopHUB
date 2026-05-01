import { Outlet } from "react-router-dom";
import { useContext, useEffect } from "react";
import { Sidebar } from "./sidebar/Sidebar";
import { HeaderContainer } from "./header/HeaderContainer";
import { useSidebar } from "../hooks/useSidebar";
import { AuthContext } from "@/App";
import { Icon } from "@/components/ui/icon/Icon";
import { setPdqModuleEnabled } from "../services/module-visibility-service";
import { getSettings } from "../services/settings-service";
import { canViewModule } from "../services/authz-service";

/**
 * Layout (AppShell) - grid principal de la app autenticada.
 * Sidebar | HeaderContainer + <Outlet />
 */
export function Layout() {
  const { user } = useContext(AuthContext);
  const { collapsed, toggle } = useSidebar();

  useEffect(() => {
    let cancelled = false;

    const loadModuleVisibility = async () => {
      if (!user) {
        return;
      }

      if (!canViewModule(user, "settings")) {
        setPdqModuleEnabled(true);
        return;
      }

      try {
        const payload = await getSettings();
        if (!cancelled) {
          setPdqModuleEnabled(payload?.panels?.pdq?.moduleEnabled !== false);
        }
      } catch {
        if (!cancelled) {
          setPdqModuleEnabled(true);
        }
      }
    };

    loadModuleVisibility();

    return () => {
      cancelled = true;
    };
  }, [user]);

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
          <div className="border-b border-[rgba(214,162,61,0.35)] bg-[rgba(214,162,61,0.14)] px-8 py-4 max-[1024px]:px-6 max-[768px]:px-4">
            <div className="mx-auto flex max-w-4xl items-center justify-center gap-3 text-center text-sm text-[var(--text-primary)]">
              <Icon
                name="warning"
                size={18}
                className="h-[18px] w-[18px] shrink-0 text-[rgba(166,107,18,0.95)]"
                aria-hidden="true"
              />
              <span>{user.notice}</span>
            </div>
          </div>
        ) : null}
        <main className="flex-1 overflow-y-auto bg-[var(--bg-app)] p-8 max-[1024px]:p-6 max-[768px]:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
