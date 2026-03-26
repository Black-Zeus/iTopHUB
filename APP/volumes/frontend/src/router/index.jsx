import { createBrowserRouter, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "@/App";

import { Layout } from "@layout/Layout";
import { LoginPage } from "@pages/login/LoginPage";
import { DashboardPage } from "@pages/dashboard/DashboardPage";
import { HandoverPage } from "@pages/handover/HandoverPage";
import { ReceptionPage } from "@pages/reception/ReceptionPage";
import { ReassignmentPage } from "@pages/reassignment/ReassignmentPage";
import { LabPage } from "@pages/lab/LabPage";
import { DevicesPage } from "@pages/devices/DevicesPage";
import { AssetsPage } from "@pages/assets/AssetsPage";
import { PeoplePage } from "@pages/people/PeoplePage";
import { ChecklistsPage } from "@pages/checklists/ChecklistsPage";
import { UsersPage } from "@pages/users/UsersPage";
import { ReportsPage } from "@pages/reports/ReportsPage";
import { SettingsPage } from "@pages/settings/SettingsPage";

/* ── Guard de ruta autenticada ── */
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useContext(AuthContext);

  // Mientras se lee localStorage no tomamos ninguna decisión de navegación.
  // Evita el loop: loading=true → no redirect → loading=false → evalúa auth.
  if (loading) return null;

  if (!isAuthenticated) return <Navigate to="/login" replace />;
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
        { index: true,        element: <Navigate to="/dashboard" replace /> },
        { path: "dashboard",  element: <DashboardPage /> },
        { path: "handover",   element: <HandoverPage /> },
        { path: "reception",  element: <ReceptionPage /> },
        { path: "reassignment", element: <ReassignmentPage /> },
        { path: "lab",        element: <LabPage /> },
        { path: "devices",    element: <DevicesPage /> },
        { path: "assets",     element: <AssetsPage /> },
        { path: "people",     element: <PeoplePage /> },
        { path: "checklists", element: <ChecklistsPage /> },
        { path: "users",      element: <UsersPage /> },
        { path: "reports",    element: <ReportsPage /> },
        { path: "settings",   element: <SettingsPage /> },
        { path: "*",          element: <Navigate to="/dashboard" replace /> },
      ],
    },
  ],
  { basename }
);
