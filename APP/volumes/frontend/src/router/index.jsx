import { createBrowserRouter, Navigate } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import { AuthContext } from "@/App";
import { canViewModule, getDefaultRoute } from "@services/authz-service";

import { Layout } from "@layout/Layout";
import { LoginPage } from "@pages/login/LoginPage";
import { DashboardPage } from "@pages/dashboard/DashboardPage";
import { HandoverPage } from "@pages/handover/HandoverPage";
import { HandoverDocumentPage } from "@pages/handover/HandoverDocumentPage";
import { ReturnHandoverPage } from "@pages/handover/ReturnHandoverPage";
import { ReturnHandoverDocumentPage } from "@pages/handover/ReturnHandoverDocumentPage";
import { NormalizationMockPage } from "@pages/handover/NormalizationMockPage";
import { ReceptionPage } from "@pages/reception/ReceptionPage";
import { ReassignmentPage } from "@pages/reassignment/ReassignmentPage";
import { LabPage } from "@pages/lab/LabPage";
import { DevicesPage } from "@pages/devices/DevicesPage";
import { PDQPage } from "@pages/pdq/PDQPage";
import { AssetsPage } from "@pages/assets/AssetsPage";
import { PeoplePage } from "@pages/people/PeoplePage";
import { ChecklistsPage } from "@pages/checklists/ChecklistsPage";
import { UsersPage } from "@pages/users/UsersPage";
import { ReportsPage } from "@pages/reports/ReportsPage";
import { SettingsPage } from "@pages/settings/SettingsPage";
import { isPdqModuleEnabled, subscribeToModuleVisibility } from "../services/module-visibility-service";

/* ── Guard de ruta autenticada ── */
function RouterLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] p-8">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Cargando
        </p>
        <p className="mt-2 text-base text-[var(--text-primary)]">
          Recuperando sesion del Hub...
        </p>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated, loading, user } = useContext(AuthContext);

  // Mientras se consulta la sesion server-side no tomamos ninguna decision de navegacion.
  // Evita el loop: loading=true -> no redirect -> loading=false -> evalua auth.
  if (loading) return <RouterLoadingScreen />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireModuleAccess({ moduleCode, children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <RouterLoadingScreen />;

  if (!user) return <Navigate to="/login" replace />;
  if (!canViewModule(user, moduleCode)) {
    return <Navigate to={getDefaultRoute(user)} replace />;
  }

  return children;
}

function DefaultHomeRedirect() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <RouterLoadingScreen />;
  return <Navigate to={getDefaultRoute(user)} replace />;
}

function RequirePdqEnabled({ children }) {
  const { user } = useContext(AuthContext);
  const [enabled, setEnabled] = useState(() => isPdqModuleEnabled());

  useEffect(() => {
    return subscribeToModuleVisibility(() => {
      setEnabled(isPdqModuleEnabled());
    });
  }, []);

  if (!enabled) {
    return <Navigate to={getDefaultRoute(user)} replace />;
  }

  return children;
}

const basename = import.meta.env.BASE_URL;

export const router = createBrowserRouter(
  [
    { path: "/login", element: <LoginPage /> },
    {
      path: "/",
      element: (
        <RequireAuth>
          <Layout />
        </RequireAuth>
      ),
      children: [
        { index: true,        element: <DefaultHomeRedirect /> },
        { path: "dashboard",  element: <RequireModuleAccess moduleCode="dashboard"><DashboardPage /></RequireModuleAccess> },
        { path: "handover",   element: <RequireModuleAccess moduleCode="handover"><HandoverPage /></RequireModuleAccess> },
        { path: "handover/:slug", element: <RequireModuleAccess moduleCode="handover"><HandoverDocumentPage /></RequireModuleAccess> },
        { path: "returns", element: <RequireModuleAccess moduleCode="handover"><ReturnHandoverPage /></RequireModuleAccess> },
        { path: "returns/:slug", element: <RequireModuleAccess moduleCode="handover"><ReturnHandoverDocumentPage /></RequireModuleAccess> },
        { path: "normalization", element: <RequireModuleAccess moduleCode="handover"><NormalizationMockPage /></RequireModuleAccess> },
        { path: "reception",  element: <RequireModuleAccess moduleCode="reception"><ReceptionPage /></RequireModuleAccess> },
        { path: "reassignment", element: <RequireModuleAccess moduleCode="reassignment"><ReassignmentPage /></RequireModuleAccess> },
        { path: "lab",        element: <RequireModuleAccess moduleCode="lab"><LabPage /></RequireModuleAccess> },
        { path: "devices",    element: <RequireModuleAccess moduleCode="devices"><DevicesPage /></RequireModuleAccess> },
        {
          path: "pdq",
          element: (
            <RequireModuleAccess moduleCode="pdq">
              <RequirePdqEnabled>
                <PDQPage />
              </RequirePdqEnabled>
            </RequireModuleAccess>
          ),
        },
        { path: "assets",     element: <RequireModuleAccess moduleCode="assets"><AssetsPage /></RequireModuleAccess> },
        { path: "people",     element: <RequireModuleAccess moduleCode="people"><PeoplePage /></RequireModuleAccess> },
        { path: "checklists", element: <RequireModuleAccess moduleCode="checklists"><ChecklistsPage /></RequireModuleAccess> },
        { path: "users",      element: <RequireModuleAccess moduleCode="users"><UsersPage /></RequireModuleAccess> },
        { path: "reports",    element: <RequireModuleAccess moduleCode="reports"><ReportsPage /></RequireModuleAccess> },
        { path: "settings",   element: <RequireModuleAccess moduleCode="settings"><SettingsPage /></RequireModuleAccess> },
        { path: "*",          element: <DefaultHomeRedirect /> },
      ],
    },
  ],
  { basename }
);
