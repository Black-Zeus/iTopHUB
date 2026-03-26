import { useLocation } from "react-router-dom";

const ROUTE_MAP = {
  "/dashboard": { breadcrumb: "Inicio / Dashboard", title: "Dashboard" },
  "/handover": { breadcrumb: "Operacion / Actas de Entrega", title: "Actas de Entrega" },
  "/reception": { breadcrumb: "Operacion / Actas de Recepcion", title: "Actas de Recepcion" },
  "/reassignment": { breadcrumb: "Operacion / Acta de Reasignacion", title: "Acta de Reasignacion" },
  "/lab": { breadcrumb: "Laboratorio / Actas", title: "Actas de Laboratorio" },
  "/devices": { breadcrumb: "Laboratorio / Dispositivos", title: "Dispositivos" },
  "/assets": { breadcrumb: "CMDB / Activos", title: "Activos CMDB" },
  "/people": { breadcrumb: "Consultas / Personas", title: "Personas" },
  "/checklists": { breadcrumb: "Administracion / Checklists", title: "Checklists" },
  "/users": { breadcrumb: "Administracion / Usuarios", title: "Usuarios del Sistema" },
  "/reports": { breadcrumb: "Analitica / Informes", title: "Informes" },
  "/settings": { breadcrumb: "Sistema / Configuracion", title: "Configuracion" },
};

export function HeaderBreadcrumb() {
  const { pathname } = useLocation();

  const match =
    ROUTE_MAP[pathname] ??
    Object.entries(ROUTE_MAP).find(([key]) => pathname.startsWith(`${key}/`))?.[1] ??
    { breadcrumb: "iTop Hub", title: "" };

  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs text-[var(--text-muted)]">{match.breadcrumb}</p>
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{match.title}</h2>
    </div>
  );
}
