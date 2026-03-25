import { useLocation } from "react-router-dom";

const ROUTE_MAP = {
  "/dashboard": { breadcrumb: "Inicio / Dashboard", title: "Dashboard" },
  "/handover": { breadcrumb: "Operación / Actas de Entrega", title: "Actas de Entrega" },
  "/reception": { breadcrumb: "Operación / Actas de Recepción", title: "Actas de Recepción" },
  "/lab": { breadcrumb: "Laboratorio / Registro", title: "Laboratorio" },
  "/assets": { breadcrumb: "CMDB / Activos", title: "Activos CMDB" },
  "/people": { breadcrumb: "Consultas / Personas", title: "Personas" },
  "/users": { breadcrumb: "Administración / Usuarios", title: "Usuarios del Sistema" },
  "/reports": { breadcrumb: "Analítica / Informes", title: "Informes" },
  "/settings": { breadcrumb: "Sistema / Configuración", title: "Configuración" },
};

export function HeaderBreadcrumb() {
  const { pathname } = useLocation();

  const match =
    ROUTE_MAP[pathname] ??
    Object.entries(ROUTE_MAP).find(([key]) => pathname.startsWith(`${key}/`))?.[1] ??
    { breadcrumb: "iTop Hub", title: "" };

  return (
    <div className="breadcrumb-copy">
      <p className="breadcrumb-text">{match.breadcrumb}</p>
      <h2 className="module-title">{match.title}</h2>
    </div>
  );
}
