const MODULE_ROUTE_MAP = {
  dashboard: "/dashboard",
  handover: "/handover",
  reassignment: "/reassignment",
  lab: "/lab",
  devices: "/devices",
  pdq: "/pdq",
  assets: "/assets",
  people: "/people",
  checklists: "/checklists",
  users: "/users",
  reports: "/reports",
  settings: "/settings",
};

const DEFAULT_ROUTE_PRIORITY = [
  "dashboard",
  "handover",
  "reassignment",
  "lab",
  "devices",
  "pdq",
  "assets",
  "people",
  "checklists",
  "users",
  "reports",
  "settings",
];

export function canViewModule(user, moduleCode) {
  return !!user?.permissions?.viewModules?.includes(moduleCode);
}

export function getAllowedRoutes(user) {
  const modules = user?.permissions?.viewModules ?? [];
  return modules
    .map((moduleCode) => MODULE_ROUTE_MAP[moduleCode])
    .filter(Boolean);
}

export function getDefaultRoute(user) {
  const modules = user?.permissions?.viewModules ?? [];
  const allowedRoutes = DEFAULT_ROUTE_PRIORITY
    .filter((moduleCode) => modules.includes(moduleCode))
    .map((moduleCode) => MODULE_ROUTE_MAP[moduleCode])
    .filter(Boolean);

  return allowedRoutes[0] || "/login";
}
