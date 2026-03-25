import { useNavigate, useLocation } from "react-router-dom";
import { SidebarMenuGroup } from "./SidebarMenuGroup";
import { SidebarMenuItem } from "./SidebarMenuItem";

const Icon = ({ d, d2 }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
    {d2 ? <path d={d2} /> : null}
  </svg>
);

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { path: "/dashboard", label: "Dashboard", icon: <Icon d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" /> },
    ],
  },
  {
    label: "Operacion",
    items: [
      { path: "/handover", label: "Actas de Entrega", icon: <Icon d="M5 12h10M11 6l6 6-6 6M4 5h5v14H4z" /> },
      { path: "/reception", label: "Actas de Recepcion", icon: <Icon d="M19 12H9M13 6l-6 6 6 6M15 5h5v14h-5z" /> },
      { path: "/reassignment", label: "Acta de Reasignacion", icon: <Icon d="M7 7h10v4M17 17H7v-4M14 4l3 3-3 3M10 20l-3-3 3-3" /> },
    ],
  },
  {
    label: "Laboratorio",
    items: [
      { path: "/lab", label: "Laboratorio", icon: <Icon d="M9 3h6M10 3v5l-5 8a4 4 0 0 0 3.4 6h7.2A4 4 0 0 0 19 16l-5-8V3" /> },
      { path: "/devices", label: "Dispositivos", icon: <Icon d="M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 15h.01M10 6h4" /> },
    ],
  },
  {
    label: "CMDB",
    items: [
      { path: "/assets", label: "Activos", icon: <Icon d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" d2="M12 3v18" /> },
      { path: "/people", label: "Personas", icon: <Icon d="M16 19a4 4 0 0 0-8 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7 7a4 4 0 0 0-3-3.87M17 4.13a4 4 0 0 1 0 7.75M5 19a4 4 0 0 1 3-3.87M7 4.13a4 4 0 0 0 0 7.75" /> },
    ],
  },
  {
    label: "Administracion",
    items: [
      { path: "/users", label: "Usuarios", icon: <Icon d="M12 3l7 4v6c0 4.5-3 7-7 8-4-1-7-3.5-7-8V7l7-4zm0 6v4m0 4h.01" /> },
      { path: "/reports", label: "Informes", icon: <Icon d="M5 19V9m7 10V5m7 14v-8M3 19h18" /> },
      { path: "/settings", label: "Configuracion", icon: <Icon d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5zm8 3.5-.9-.5a7.9 7.9 0 0 0-.5-1.3l.5-.9-1.8-1.8-.9.5c-.4-.2-.9-.4-1.3-.5L14 4h-4l-.5.9c-.4.1-.9.3-1.3.5l-.9-.5-1.8 1.8.5.9c-.2.4-.4.9-.5 1.3L4 12l.9.5c.1.4.3.9.5 1.3l-.5.9 1.8 1.8.9-.5c.4.2.9.4 1.3.5L10 20h4l.5-.9c.4-.1.9-.3 1.3-.5l.9.5 1.8-1.8-.5-.9c.2-.4.4-.9.5-1.3z" /> },
    ],
  },
];

export function SidebarNav({ collapsed }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className={`flex flex-1 flex-col ${collapsed ? "gap-1" : "gap-3"}`} aria-label="Navegacion principal">
      {NAV_GROUPS.map((group) => (
        <SidebarMenuGroup key={group.label ?? "root"} label={group.label} collapsed={collapsed}>
          {group.items.map((item) => (
            <SidebarMenuItem
              key={item.path}
              label={item.label}
              icon={item.icon}
              active={pathname === item.path || pathname.startsWith(`${item.path}/`)}
              collapsed={collapsed}
              onClick={() => navigate(item.path)}
            />
          ))}
        </SidebarMenuGroup>
      ))}
    </nav>
  );
}
