function getStatusClass(value) {
  const normalized = value.toLowerCase();

  if (normalized.includes("inactivo") || normalized.includes("bloqueado")) {
    return "status-no-operativo";
  }

  if (normalized.includes("operativo") || normalized.includes("asignado") || normalized.includes("activo")) {
    return "status-operativo";
  }

  if (normalized.includes("alta") || normalized.includes("diagnóstico") || normalized.includes("diagnostico") || normalized.includes("en diagnóstico")) {
    return "status-laboratorio";
  }

  if (normalized.includes("listo") || normalized.includes("devolución") || normalized.includes("devolucion")) {
    return "status-operativo";
  }

  if (normalized.includes("laboratorio") || normalized.includes("pendiente") || normalized.includes("análisis") || normalized.includes("revision") || normalized.includes("revisión")) {
    return "status-laboratorio";
  }

  if (normalized.includes("no operativo") || normalized.includes("baja")) {
    return "status-no-operativo";
  }

  if (normalized.includes("disponible") || normalized.includes("stock")) {
    return "status-disponible";
  }

  return "status-stock";
}

function createStatusBadge(value) {
  return `<span class="status-text">${escapeHtml(value)}</span>`;
}

const SYSTEM_USER_ROLES = ["Administrador", "Soporte General", "Soporte Terreno", "Soporte Laboratorio", "Visualizador"];
const ROLE_PROFILES = {
  Administrador: {
    viewModules: ["dashboard", "global-search", "handover", "reassignment", "reception", "lab", "assets", "devices", "people", "users", "reports", "checklists", "settings"],
    writeModules: ["handover", "reassignment", "reception", "lab", "assets", "devices", "users", "checklists", "settings"]
  },
  "Soporte General": {
    viewModules: ["dashboard", "global-search", "handover", "reassignment", "reception", "lab", "assets", "devices", "people", "reports"],
    writeModules: ["handover", "reassignment", "reception", "lab", "assets", "devices"]
  },
  "Soporte Terreno": {
    viewModules: ["dashboard", "global-search", "handover", "reassignment", "reception", "assets", "devices", "people", "reports"],
    writeModules: ["handover", "reassignment", "reception", "assets", "devices"]
  },
  "Soporte Laboratorio": {
    viewModules: ["dashboard", "global-search", "lab", "reports"],
    writeModules: ["lab"]
  },
  Visualizador: {
    viewModules: ["dashboard", "global-search", "handover", "reassignment", "reception", "lab", "assets", "devices", "people", "reports"],
    writeModules: []
  }
};
const ASSET_BRAND_MODELS = {
  laptop: {
    Dell: ["Latitude 5440", "Latitude 7450"],
    HP: ["EliteBook 840 G10", "ProBook 440 G10"],
    Lenovo: ["ThinkPad E14 Gen 5", "ThinkPad T14 Gen 5"]
  },
  pc: {
    Dell: ["OptiPlex 7010", "PowerEdge R650"],
    HP: ["ProDesk 400 G9", "EliteDesk 800 G9"],
    Lenovo: ["ThinkCentre M70q Gen 4", "ThinkCentre Neo 50t"]
  },
  tablet: {
    Samsung: ["Galaxy Tab Active4 Pro", "Galaxy Tab S9 FE"],
    Apple: ["iPad 10th Gen", "iPad Air 11"]
  },
  mobilephone: {
    Samsung: ["Galaxy A35", "Galaxy S24"],
    Apple: ["iPhone 13", "iPhone 15"]
  },
  printer: {
    HP: ["LaserJet Pro 4003dn", "Color LaserJet Pro MFP 4303fdw"],
    Brother: ["DCP-L5650DN", "MFC-L6900DW"],
    Xerox: ["VersaLink C415", "B235"]
  },
  peripheral: {
    Dell: ["P2423D", "WD19S"],
    Logitech: ["MK270", "M185"],
    HP: ["E24 G5 Dock", "USB-C Dock G5"]
  }
};
const ASSET_LOCATIONS = ["Oficina Central", "Mesa de ayuda", "Finanzas", "Datacenter San Juan", "Oficina Norte", "Laboratorio"];
const SORTABLE_MONTHS = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11
};
let mobileDevices = [
  {
    id: "device-1",
    name: "Tablet Android 01",
    code: "TAB-001",
    registrationCode: "481205",
    registeredAt: "11 mar 2026 · 10:15",
    lastSyncAt: "15 mar 2026 · 17:40",
    platform: "Android"
  },
  {
    id: "device-2",
    name: "Tablet Android 02",
    code: "TAB-002",
    registrationCode: "582316",
    registeredAt: "12 mar 2026 · 09:05",
    lastSyncAt: "16 mar 2026 · 08:20",
    platform: "Android"
  },
  {
    id: "device-3",
    name: "Tablet Android 03",
    code: "TAB-003",
    registrationCode: "693427",
    registeredAt: "14 mar 2026 · 14:25",
    lastSyncAt: "Pendiente",
    platform: "Android"
  }
];

function formatDeviceTimestamp(date) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date).replace(",", " ·");
}

function getNextDeviceSequence() {
  return mobileDevices.reduce(function (maxValue, item) {
    const currentValue = Number(String(item.code).split("-").pop());
    return Number.isNaN(currentValue) ? maxValue : Math.max(maxValue, currentValue);
  }, 0) + 1;
}

function createDeviceFromRegistrationCode(registrationCode, deviceName) {
  const nextSequence = getNextDeviceSequence();
  const syncTimestamp = formatDeviceTimestamp(new Date());
  return {
    id: `device-${Date.now()}`,
    name: deviceName,
    code: `TAB-${String(nextSequence).padStart(3, "0")}`,
    registrationCode,
    registeredAt: formatDeviceTimestamp(new Date()),
    lastSyncAt: syncTimestamp,
    platform: "Android"
  };
}

function renderDetailGrid(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = items.map(function (item) {
    return `<div class="detail-item"><strong>${item.label}</strong><span>${item.value}</span></div>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getLoggedInUserName() {
  const userName = document.getElementById("active-user-name");
  return userName ? userName.textContent.trim() : "Usuario actual";
}

let currentActiveSystemUserId = null;
let refreshCurrentUserSelector = function () {};
let currentViewName = "dashboard";

function getCurrentActiveSystemUser() {
  return mockData.systemUsers.find(function (item) { return item.id === currentActiveSystemUserId; }) || mockData.systemUsers[0] || null;
}

function getCurrentRoleProfile() {
  const activeUser = getCurrentActiveSystemUser();
  return ROLE_PROFILES[activeUser ? activeUser.role : "Visualizador"] || ROLE_PROFILES.Visualizador;
}

function canViewAppModule(viewName) {
  return getCurrentRoleProfile().viewModules.includes(viewName);
}

function canWriteAppModule(moduleName) {
  return getCurrentRoleProfile().writeModules.includes(moduleName);
}

function getModuleActionLabel(moduleName) {
  return canWriteAppModule(moduleName) ? "Editar" : "Ver";
}

function getInitials(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(function (part) { return part.charAt(0).toUpperCase(); })
    .join("") || "US";
}

function syncCurrentUserDependentFields() {
  const handoverOwner = document.getElementById("handover-record-owner");
  const receptionOwner = document.getElementById("reception-record-owner");
  const labOwner = document.getElementById("lab-record-owner");

  if (handoverOwner && currentHandoverWorkspaceMode === "create") {
    handoverOwner.value = getLoggedInUserName();
  }

  if (receptionOwner && currentReceptionWorkspaceMode === "create") {
    receptionOwner.value = getLoggedInUserName();
  }

  if (labOwner && currentLabWorkspaceMode === "create") {
    labOwner.value = getLoggedInUserName();
  }
}

function syncWorkspacePermissionState(workspaceSelector, writable, extraSelectors) {
  const workspace = document.querySelector(workspaceSelector);

  if (!workspace) {
    return;
  }

  workspace.querySelectorAll("input, select, textarea").forEach(function (field) {
    field.disabled = !writable;
  });

  if (extraSelectors) {
    workspace.querySelectorAll(extraSelectors).forEach(function (field) {
      field.disabled = !writable;
    });
  }
}

function applyCurrentRoleProfile() {
  document.querySelectorAll(".nav-link").forEach(function (button) {
    button.classList.toggle("is-hidden", !canViewAppModule(button.dataset.view));
  });

  [
    ["handover-create-button", canWriteAppModule("handover")],
    ["reassignment-create-button", canWriteAppModule("reassignment")],
    ["reassignment-save-button", canWriteAppModule("reassignment")],
    ["handover-save-button", canWriteAppModule("handover")],
    ["reception-create-button", canWriteAppModule("reception")],
    ["reception-save-button", canWriteAppModule("reception")],
    ["lab-create-button", canWriteAppModule("lab")],
    ["lab-save-button", canWriteAppModule("lab")],
    ["asset-create-button", canWriteAppModule("assets")],
    ["assets-save-button", canWriteAppModule("assets")],
    ["system-user-create-button", canWriteAppModule("users")],
    ["system-users-save-button", canWriteAppModule("users")]
  ].forEach(function (entry) {
    const element = document.getElementById(entry[0]);

    if (!element) {
      return;
    }

    element.classList.toggle("is-hidden", !entry[1]);
    element.disabled = !entry[1];
  });

  syncWorkspacePermissionState("#handover-workspace", canWriteAppModule("handover"), ".js-handover-asset-remove, .js-handover-checklist-remove, .js-handover-asset-checklist-add, #handover-asset-add");
  syncWorkspacePermissionState("#reassignment-workspace", canWriteAppModule("reassignment"), ".js-reassignment-asset-remove, .js-reassignment-checklist-remove, .js-reassignment-asset-checklist-add, #reassignment-asset-add");
  syncWorkspacePermissionState("#reception-workspace", canWriteAppModule("reception"), ".js-reception-asset-remove, .js-reception-checklist-remove, .js-reception-asset-checklist-add, #reception-asset-add");
  syncWorkspacePermissionState("#lab-workspace", canWriteAppModule("lab"), ".js-lab-asset-remove, .js-lab-checklist-remove, .js-lab-asset-checklist-add, .js-lab-evidence-remove, [data-lab-evidence-dropzone='true'], #lab-asset-add, #lab-evidence-add");
  syncWorkspacePermissionState("#assets-workspace", canWriteAppModule("assets"));
  syncWorkspacePermissionState("#system-users-workspace", canWriteAppModule("users"));

  renderHandover();
  filterHandovers();
  renderReception();
  filterReceptions();
  renderLabQueue();
  filterLabQueue();
  renderAssetsOverview();
  renderAssetFilters();
  filterAssets();
  renderDevices();
  renderSystemUsers();
  filterSystemUsers();

  if (!canViewAppModule(currentViewName)) {
    activateView("dashboard");
  }
}

function setupCurrentUserSelector() {
  const toggle = document.getElementById("user-chip-toggle");
  const menu = document.getElementById("user-chip-menu");
  const avatar = document.getElementById("active-user-avatar");
  const name = document.getElementById("active-user-name");
  const role = document.getElementById("active-user-role");
  currentActiveSystemUserId = mockData.systemUsers[0] ? mockData.systemUsers[0].id : null;

  if (!toggle || !menu || !avatar || !name || !role) {
    return;
  }

  function getActiveUser() {
    return mockData.systemUsers.find(function (item) { return item.id === currentActiveSystemUserId; }) || mockData.systemUsers[0] || null;
  }

  function closeMenu() {
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
  }

  function renderActiveUser() {
    const activeUser = getActiveUser();

    if (!activeUser) {
      return;
    }

    avatar.textContent = getInitials(activeUser.name);
    name.textContent = activeUser.name;
    role.textContent = activeUser.role;
    syncCurrentUserDependentFields();
  }

  function renderMenu() {
    menu.innerHTML = mockData.systemUsers.map(function (item) {
      return `
        <button class="user-chip-option ${item.id === currentActiveSystemUserId ? "is-active" : ""}" type="button" role="menuitemradio" aria-checked="${item.id === currentActiveSystemUserId ? "true" : "false"}" data-user-id="${item.id}">
          <div class="avatar">${getInitials(item.name)}</div>
          <div class="user-chip-option-copy">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.role)}</span>
          </div>
        </button>
      `;
    }).join("");
  }

  renderActiveUser();
  renderMenu();
  refreshCurrentUserSelector = function () {
    if (!mockData.systemUsers.some(function (item) { return item.id === currentActiveSystemUserId; })) {
      currentActiveSystemUserId = mockData.systemUsers[0] ? mockData.systemUsers[0].id : null;
    }
    renderActiveUser();
    renderMenu();
    applyCurrentRoleProfile();
  };
  applyCurrentRoleProfile();

  toggle.addEventListener("click", function () {
    if (menu.classList.contains("is-open")) {
      closeMenu();
      return;
    }

    openMenu();
  });

  menu.addEventListener("click", function (event) {
    const option = event.target.closest(".user-chip-option");

    if (!option) {
      return;
    }

    currentActiveSystemUserId = option.dataset.userId;
    renderActiveUser();
    renderMenu();
    applyCurrentRoleProfile();
    closeMenu();
  });

  document.addEventListener("click", function (event) {
    if (!toggle.contains(event.target) && !menu.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseSortableDate(value) {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const esMatch = value.match(/^(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóú]{3,})\s+(\d{4})(?:\s+·\s+(\d{2}):(\d{2}))?$/);

  if (!esMatch) {
    return null;
  }

  const monthKey = normalizeSearchText(esMatch[2]).slice(0, 3);
  const month = SORTABLE_MONTHS[monthKey];

  if (month === undefined) {
    return null;
  }

  return Date.UTC(
    Number(esMatch[3]),
    month,
    Number(esMatch[1]),
    Number(esMatch[4] || 0),
    Number(esMatch[5] || 0)
  );
}

function getSortableCellText(row, columnIndex) {
  const cell = row.children[columnIndex];
  return cell ? cell.textContent.replace(/\s+/g, " ").trim() : "";
}

function compareSortableValues(leftValue, rightValue) {
  const leftDate = parseSortableDate(leftValue);
  const rightDate = parseSortableDate(rightValue);

  if (leftDate !== null && rightDate !== null) {
    return leftDate - rightDate;
  }

  const leftNumericText = leftValue.replace(/[^0-9.-]+/g, "");
  const rightNumericText = rightValue.replace(/[^0-9.-]+/g, "");
  const leftNumber = Number(leftNumericText);
  const rightNumber = Number(rightNumericText);
  const leftLooksNumeric = leftNumericText !== "" && !Number.isNaN(leftNumber);
  const rightLooksNumeric = rightNumericText !== "" && !Number.isNaN(rightNumber);

  if (leftLooksNumeric && rightLooksNumeric) {
    return leftNumber - rightNumber;
  }

  return leftValue.localeCompare(rightValue, "es", { numeric: true, sensitivity: "base" });
}

function updateSortableTableHeaders(table) {
  const activeColumn = table.dataset.sortColumn;
  const activeDirection = table.dataset.sortDirection;

  table.querySelectorAll("thead th").forEach(function (header, index) {
    const button = header.querySelector(".table-sort-button");
    const icon = header.querySelector(".table-sort-icon");

    if (!button || !icon) {
      return;
    }

    const isActive = String(index) === activeColumn;
    button.classList.toggle("is-active", isActive);
    icon.textContent = isActive ? (activeDirection === "desc" ? "\u2193" : "\u2191") : "";
  });
}

function sortTableRows(table, columnIndex, direction) {
  const tbody = table.tBodies[0];

  if (!tbody) {
    return;
  }

  const rows = Array.from(tbody.rows);

  if (rows.length <= 1) {
    table.dataset.sortColumn = String(columnIndex);
    table.dataset.sortDirection = direction;
    updateSortableTableHeaders(table);
    return;
  }

  table.dataset.sorting = "true";

  rows.sort(function (leftRow, rightRow) {
    const leftValue = getSortableCellText(leftRow, columnIndex);
    const rightValue = getSortableCellText(rightRow, columnIndex);
    const comparison = compareSortableValues(leftValue, rightValue);
    return direction === "desc" ? -comparison : comparison;
  });

  rows.forEach(function (row) {
    tbody.appendChild(row);
  });

  table.dataset.sorting = "false";
  table.dataset.sortColumn = String(columnIndex);
  table.dataset.sortDirection = direction;
  updateSortableTableHeaders(table);
}

function setupSortableTables() {
  document.querySelectorAll(".data-table").forEach(function (table) {
    if (table.dataset.sortableReady === "true") {
      return;
    }

    const headers = table.querySelectorAll("thead th");
    const tbody = table.tBodies[0];

    if (!headers.length || !tbody) {
      return;
    }

    headers.forEach(function (header, index) {
      const label = header.textContent.replace(/\s+/g, " ").trim();

      if (/^acci[oó]n(?:es)?$/i.test(label)) {
        return;
      }

      header.classList.add("is-sortable");
      header.innerHTML = `<button class="table-sort-button" type="button" data-sort-column="${index}"><span class="table-sort-label">${escapeHtml(label)}</span><span class="table-sort-icon" aria-hidden="true"></span></button>`;
    });

    table.addEventListener("click", function (event) {
      const button = event.target.closest(".table-sort-button");

      if (!button || !table.contains(button)) {
        return;
      }

      const columnIndex = Number(button.dataset.sortColumn);
      const nextDirection = table.dataset.sortColumn === String(columnIndex) && table.dataset.sortDirection === "asc"
        ? "desc"
        : "asc";

      sortTableRows(table, columnIndex, nextDirection);
    });
    table.dataset.sortableReady = "true";
    table.dataset.sortColumn = "";
    table.dataset.sortDirection = "asc";
    updateSortableTableHeaders(table);
  });
}

function getAssetDisplayName(asset) {
  if (!asset) {
    return "";
  }

  if (!asset.name || asset.name === asset.code) {
    return asset.code || "";
  }

  return `${asset.code} · ${asset.name}`;
}

function getCmdbAssetClasses() {
  return (mockData.checklistDefinitionsByModule.lab || []).map(function (item) {
    return { classKey: item.classKey, cmdbClass: item.cmdbClass, status: item.status };
  }).filter(function (item, index, collection) {
    return item.classKey && collection.findIndex(function (entry) { return entry.classKey === item.classKey; }) === index;
  });
}

function getCmdbClassLabel(classKey) {
  const match = getCmdbAssetClasses().find(function (item) {
    return item.classKey === classKey;
  });

  return match ? match.cmdbClass : classKey || "";
}

function getAssetTypeFromClass(classKey) {
  return getCmdbClassLabel(classKey);
}

function getBrandsByAssetClass(classKey) {
  const configuredBrands = Object.keys(ASSET_BRAND_MODELS[classKey] || {});
  const dataBrands = mockData.assets.filter(function (asset) {
    return asset.classKey === classKey;
  }).map(function (asset) {
    return asset.brand;
  });

  return [...new Set(configuredBrands.concat(dataBrands))].filter(Boolean);
}

function getModelsByAssetClassAndBrand(classKey, brand) {
  const configuredModels = ((ASSET_BRAND_MODELS[classKey] || {})[brand] || []);
  const dataModels = mockData.assets.filter(function (asset) {
    return asset.classKey === classKey && asset.brand === brand;
  }).map(function (asset) {
    return asset.model;
  });

  return [...new Set(configuredModels.concat(dataModels))].filter(Boolean);
}

function activateView(viewName, meta) {
  if (!canViewAppModule(viewName)) {
    viewName = "dashboard";
  }

  const navLinks = document.querySelectorAll(".nav-link");
  const views = document.querySelectorAll(".view");
  const title = document.getElementById("module-title");
  const breadcrumb = document.getElementById("breadcrumb");
  const targetButton = document.querySelector(`.nav-link[data-view="${viewName}"]`);
  const targetView = document.getElementById(`view-${viewName}`);

  if (!targetView) {
    return;
  }

  currentViewName = viewName;

  navLinks.forEach(function (item) { item.classList.remove("is-active"); });
  views.forEach(function (view) { view.classList.remove("is-active"); });
  targetView.classList.add("is-active");

  if (targetButton) {
    targetButton.classList.add("is-active");
  }

  if (title && targetButton) {
    title.textContent = targetButton.dataset.title;
  }

  if (breadcrumb && targetButton) {
    breadcrumb.textContent = targetButton.dataset.breadcrumb;
  }

  if (meta && title) {
    title.textContent = meta.title;
  }

  if (meta && breadcrumb) {
    breadcrumb.textContent = meta.breadcrumb;
  }
}

function openPeopleWorkspaceById(userId) {
  const workspace = document.getElementById("people-workspace");
  const listPanel = document.getElementById("people-list-panel");
  const filtersPanel = document.getElementById("people-filters-panel");
  const stats = document.getElementById("people-kpi-grid");

  activateView("people");
  renderPeopleDetail(userId);
  workspace.classList.add("is-active");
  listPanel.classList.add("is-hidden");
  filtersPanel.classList.add("is-hidden");
  stats.classList.add("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openSystemUserWorkspaceById(userId) {
  if (!canViewAppModule("users")) {
    activateView("dashboard");
    return;
  }

  const workspace = document.getElementById("system-users-workspace");
  const listPanel = document.getElementById("system-users-list-panel");
  const filtersPanel = document.getElementById("system-users-filters-panel");
  const stats = document.getElementById("system-users-kpi-grid");
  const formArticle = document.getElementById("system-users-form-article");
  const saveButton = document.getElementById("system-users-save-button");

  activateView("users");
  renderSystemUserDetail(userId);
  workspace.classList.add("is-active");
  listPanel.classList.add("is-hidden");
  filtersPanel.classList.add("is-hidden");
  stats.classList.add("is-hidden");
  if (formArticle) {
    formArticle.classList.remove("is-hidden");
  }
  if (saveButton) {
    saveButton.textContent = "Guardar cambios";
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openHandoverWorkspaceById(handoverId) {
  if (!canViewAppModule("handover")) {
    activateView("dashboard");
    return;
  }

  const workspace = document.getElementById("handover-workspace");
  const listPanel = document.getElementById("handover-list-panel");
  const filtersPanel = document.getElementById("handover-filters-panel");
  const stats = document.getElementById("handover-kpi-grid");

  activateView("handover");
  renderHandoverDetail(handoverId, "edit");
  workspace.classList.add("is-active");
  listPanel.classList.add("is-hidden");
  filtersPanel.classList.add("is-hidden");
  stats.classList.add("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openReassignmentWorkspaceById(reassignmentId) {
  if (!canViewAppModule("reassignment")) {
    activateView("dashboard");
    return;
  }

  const workspace = document.getElementById("reassignment-workspace");
  const listPanel = document.getElementById("reassignment-list-panel");
  const filtersPanel = document.getElementById("reassignment-filters-panel");
  const stats = document.getElementById("reassignment-kpi-grid");

  activateView("reassignment");
  renderReassignmentDetail(reassignmentId, "edit");
  workspace.classList.add("is-active");
  listPanel.classList.add("is-hidden");
  filtersPanel.classList.add("is-hidden");
  stats.classList.add("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openReceptionWorkspaceById(receptionId) {
  if (!canViewAppModule("reception")) {
    activateView("dashboard");
    return;
  }

  const workspace = document.getElementById("reception-workspace");
  const listPanel = document.getElementById("reception-list-panel");
  const filtersPanel = document.getElementById("reception-filters-panel");
  const stats = document.getElementById("reception-kpi-grid");

  activateView("reception");
  renderReceptionDetail(receptionId, "edit");
  workspace.classList.add("is-active");
  listPanel.classList.add("is-hidden");
  filtersPanel.classList.add("is-hidden");
  stats.classList.add("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openLabWorkspaceById(labId) {
  if (!canViewAppModule("lab")) {
    activateView("dashboard");
    return;
  }

  const workspace = document.getElementById("lab-workspace");
  const listPanel = document.getElementById("lab-list-panel");
  const filtersPanel = document.getElementById("lab-filters-panel");
  const stats = document.getElementById("lab-kpi-grid");

  activateView("lab");
  renderLabDetail(labId, "edit");
  workspace.classList.add("is-active");
  listPanel.classList.add("is-hidden");
  filtersPanel.classList.add("is-hidden");
  stats.classList.add("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openAssetWorkspaceById(assetId) {
  if (!canViewAppModule("assets")) {
    activateView("dashboard");
    return;
  }

  const workspace = document.getElementById("assets-workspace");
  const listPanel = document.getElementById("assets-list-panel");
  const filtersPanel = document.getElementById("assets-filters-panel");
  const stats = document.getElementById("assets-kpi-grid");

  activateView("assets");
  renderAssetWorkspace(assetId, "edit");
  workspace.classList.add("is-active");
  listPanel.classList.add("is-hidden");
  filtersPanel.classList.add("is-hidden");
  stats.classList.add("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getGlobalSearchItems() {
  return []
    .concat(canViewAppModule("assets") ? mockData.assets.map(function (item) {
      return {
        kind: "asset",
        group: "Activos",
        id: item.id,
        icon: "CM",
        badge: item.status,
        title: getAssetDisplayName(item),
        subtitle: `${item.type} · ${item.model} · ${item.currentUser || item.location}`,
        haystack: normalizeSearchText([
          item.code, item.name, item.type, item.model, item.brand, item.serial,
          item.currentUser, item.location, item.inventoryCode, item.status, item.cmdbStatus, item.state
        ].join(" "))
      };
    }) : [])
    .concat(mockData.users.map(function (item) {
      return {
        kind: "person",
        group: "Personas",
        id: item.id,
        icon: "PE",
        badge: item.area,
        title: item.name,
        subtitle: `${item.identifier} · ${item.role} · ${item.location}`,
        haystack: normalizeSearchText([
          item.name, item.identifier, item.email, item.area, item.role, item.manager, item.location, item.status
        ].join(" "))
      };
    }))
    .concat(canViewAppModule("users") ? mockData.systemUsers.map(function (item) {
      return {
        kind: "system-user",
        group: "Usuarios",
        id: item.id,
        icon: "US",
        badge: item.role,
        title: item.name,
        subtitle: `${item.username} · ${item.email} · ${item.status}`,
        haystack: normalizeSearchText([
          item.name, item.username, item.email, item.role, item.status, item.apiCode
        ].join(" "))
      };
    }) : [])
    .concat(canViewAppModule("handover") ? mockData.handovers.map(function (item) {
      return {
        kind: "handover",
        group: "Entregas",
        id: item.id,
        icon: "EN",
        badge: item.status,
        title: item.document,
        subtitle: `${item.assetCode} · ${item.user} · ${item.type}`,
        haystack: normalizeSearchText([
          item.document, item.assetCode, item.assetName, item.user, item.userIdentifier, item.owner, item.type, item.status, item.notes
        ].join(" "))
      };
    }) : [])
    .concat(canViewAppModule("reassignment") ? mockData.reassignments.map(function (item) {
      return {
        kind: "reassignment",
        group: "Reasignaciones",
        id: item.id,
        icon: "RA",
        badge: item.status,
        title: item.document,
        subtitle: `${item.assetCode} · ${item.originUser} -> ${item.destinationUser}`,
        haystack: normalizeSearchText([
          item.document, item.assetCode, item.assetName, item.originUser, item.originUserIdentifier,
          item.destinationUser, item.destinationUserIdentifier, item.owner, item.reason, item.status, item.notes
        ].join(" "))
      };
    }) : [])    .concat(canViewAppModule("reception") ? mockData.receptions.map(function (item) {
      return {
        kind: "reception",
        group: "Recepciones",
        id: item.id,
        icon: "RC",
        badge: item.receivedState,
        title: item.document,
        subtitle: `${item.assetCode} · ${item.deliverer} · ${item.reason}`,
        haystack: normalizeSearchText([
          item.document, item.assetCode, item.assetName, item.origin, item.deliverer, item.receiver,
          item.reason, item.receivedState, item.owner, item.diagnosis, item.technicalNotes
        ].join(" "))
      };
    }) : [])
    .concat(canViewAppModule("lab") ? mockData.labQueue.map(function (item) {
      return {
        kind: "lab",
        group: "Laboratorio",
        id: item.id,
        icon: "LB",
        badge: item.status,
        title: item.reportNumber,
        subtitle: `${item.assetCode} · ${item.technician} · ${item.result}`,
        haystack: normalizeSearchText([
          item.reportNumber, item.receptionDocument, item.assetCode, item.assetName,
          item.type, item.reason, item.priority, item.status, item.technician, item.result, item.description,
          item.entryAt, item.closedAt
        ].join(" "))
      };
    }) : []);
}

function getRankedGlobalSearchResults(query) {
  const normalizedQuery = normalizeSearchText(query);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  if (!tokens.length) {
    return [];
  }

  return getGlobalSearchItems()
    .filter(function (item) {
      return tokens.every(function (token) {
        return item.haystack.includes(token);
      });
    })
    .map(function (item) {
      const startsWithTitle = normalizeSearchText(item.title).startsWith(normalizedQuery) ? 3 : 0;
      const startsWithSubtitle = normalizeSearchText(item.subtitle).startsWith(normalizedQuery) ? 1 : 0;
      const exactCodeHit = item.haystack.includes(normalizedQuery) ? 1 : 0;
      return Object.assign({ score: startsWithTitle + startsWithSubtitle + exactCodeHit }, item);
    })
    .sort(function (left, right) {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.title.localeCompare(right.title, "es");
    })
    .slice(0, 10);
}

const GLOBAL_SEARCH_GROUP_ORDER = ["Activos", "Personas", "Usuarios", "Entregas", "Reasignaciones", "Recepciones", "Laboratorio"];

function renderGlobalSearchPage(query) {
  const normalizedQuery = normalizeSearchText(query);
  const items = getRankedGlobalSearchResults(query);
  const title = document.getElementById("global-search-page-title");
  const description = document.getElementById("global-search-page-description");
  const chip = document.getElementById("global-search-query-chip");
  const kpiGrid = document.getElementById("global-search-kpi-grid");
  const groups = document.getElementById("global-search-groups");

  if (!title || !description || !chip || !kpiGrid || !groups) {
    return;
  }

  title.textContent = normalizedQuery ? `Resultados para "${query.trim()}"` : "Resultados agrupados";
  description.textContent = normalizedQuery
    ? "Consulta transversal sobre activos, personas, usuarios, entregas, reasignaciones, recepciones y laboratorio."
    : "Ingresa un término en la barra superior y presiona Enter para consultar información transversal del mockup.";
  chip.textContent = normalizedQuery ? query.trim() : "Sin consulta";

  const countsByGroup = GLOBAL_SEARCH_GROUP_ORDER.map(function (group) {
    return {
      label: group,
      value: items.filter(function (item) { return item.group === group; }).length
    };
  });
  const total = items.length;

  kpiGrid.innerHTML = [
    { label: "Coincidencias", value: total, helper: normalizedQuery ? "Resultados visibles" : "Sin consulta activa", tone: "info" },
    { label: "Módulos con match", value: countsByGroup.filter(function (item) { return item.value > 0; }).length, helper: "Agrupación transversal", tone: "success" },
    { label: "Activos y personas", value: countsByGroup[0].value + countsByGroup[1].value, helper: "Cobertura operativa", tone: "warning" },
    { label: "Documentos", value: countsByGroup.filter(function (item) { return ["Entregas", "Reasignaciones", "Recepciones", "Laboratorio"].includes(item.label); }).reduce(function (sum, item) { return sum + item.value; }, 0), helper: "Entrega, reasignacion, recepcion y lab", tone: "info" }
  ].map(function (item) {
    return `<article class="kpi-card"><p class="eyebrow">${item.label}</p><strong>${item.value}</strong><span class="badge badge-${item.tone}">${item.helper}</span></article>`;
  }).join("");

  if (!normalizedQuery) {
    groups.innerHTML = `
      <div class="global-search-empty">
        <strong>Esperando una consulta</strong>
        <span>Ejemplos: NB-24017, Paula Ferreyra, ENT-2026-0317, REC-2026-0142 o Latitude 5440.</span>
      </div>
    `;
    return;
  }

  if (!items.length) {
    groups.innerHTML = `
      <div class="global-search-empty">
        <strong>Sin coincidencias</strong>
        <span>No encontramos resultados agrupados para "${escapeHtml(query.trim())}".</span>
      </div>
    `;
    return;
  }

  groups.innerHTML = GLOBAL_SEARCH_GROUP_ORDER.map(function (groupName) {
    const groupItems = items.filter(function (item) { return item.group === groupName; });

    if (!groupItems.length) {
      return "";
    }

    return `
      <section class="global-search-group">
        <div class="global-search-group-header">
          <div>
            <p class="eyebrow">Grupo</p>
            <h4 class="global-search-group-label">${escapeHtml(groupName)}</h4>
          </div>
          <span class="global-search-group-meta">${groupItems.length} resultado(s)</span>
        </div>
        <div class="global-search-list">
          ${groupItems.map(function (item) {
            return `
              <button class="global-search-item" type="button" data-global-search-kind="${item.kind}" data-global-search-id="${item.id}">
                <span class="global-search-item-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
                <span class="global-search-item-copy">
                  <strong>${escapeHtml(item.title)}</strong>
                  <span>${escapeHtml(item.subtitle)}</span>
                </span>
                <span class="badge">${escapeHtml(item.badge)}</span>
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }).join("");
}

function runGlobalSearchTarget(item) {
  if (!item) {
    return;
  }

  if (item.kind === "asset") {
    openAssetWorkspaceById(item.id);
    return;
  }

  if (item.kind === "person") {
    openPeopleWorkspaceById(item.id);
    return;
  }

  if (item.kind === "system-user") {
    openSystemUserWorkspaceById(item.id);
    return;
  }

  if (item.kind === "handover") {
    openHandoverWorkspaceById(item.id);
    return;
  }

  if (item.kind === "reassignment") {
    openReassignmentWorkspaceById(item.id);
    return;
  }

  if (item.kind === "reception") {
    openReceptionWorkspaceById(item.id);
    return;
  }

  if (item.kind === "lab") {
    openLabWorkspaceById(item.id);
  }
}

function setupGlobalSearch() {
  const input = document.getElementById("global-search-input");

  if (!input) {
    return;
  }

  input.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") {
      return;
    }

    const query = input.value.trim();

    if (!query) {
      return;
    }

    event.preventDefault();
    activateView("global-search", {
      title: "Búsqueda global",
      breadcrumb: "Consultas / Búsqueda global"
    });
    renderGlobalSearchPage(query);
  });

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-global-search-kind][data-global-search-id]");

    if (!button) {
      return;
    }

    const item = getGlobalSearchItems().find(function (entry) {
      return entry.kind === button.dataset.globalSearchKind && entry.id === button.dataset.globalSearchId;
    });
    runGlobalSearchTarget(item);
  });
}

function renderDashboard() {
  const kpiGrid = document.getElementById("kpi-grid");
  const summary = document.getElementById("document-summary");
  const recentHandovers = document.getElementById("recent-handovers");
  const recentReceptions = document.getElementById("recent-receptions");
  const alertsList = document.getElementById("alerts-list");

  kpiGrid.innerHTML = mockData.kpis.map(function (item) {
    return `
      <article class="kpi-card">
        <p class="eyebrow">${item.label}</p>
        <strong>${item.value}</strong>
        <span class="badge badge-${item.tone}">${item.helper}</span>
      </article>
    `;
  }).join("");

  summary.innerHTML = mockData.documentSummary.map(function (item) {
    return `<div class="stat-item"><span>${item.label}</span><strong>${item.value}</strong></div>`;
  }).join("");

  recentHandovers.innerHTML = mockData.handovers.map(function (item) {
    const assetLabel = item.assetCode || item.assetName || "";
    return `<tr><td>${assetLabel}</td><td>${item.user}</td><td>${item.date}</td><td>${item.document}</td></tr>`;
  }).join("");

  recentReceptions.innerHTML = mockData.receptions.map(function (item) {
    const assetLabel = item.assetCode || item.assetName || "";
    return `<tr><td>${assetLabel}</td><td>${item.origin}</td><td>${createStatusBadge(item.receivedState)}</td><td>${item.date}</td></tr>`;
  }).join("");

  alertsList.innerHTML = mockData.alerts.map(function (alert) {
    return `<div class="alert-card"><strong>${alert.title}</strong><p>${alert.text}</p></div>`;
  }).join("");
}

let currentHandoverWorkspaceId = null;
let currentHandoverWorkspaceMode = "create";
let currentHandoverDocument = "";
let currentHandoverAssetState = { items: [] };

function renderHandover() {
  const kpiGrid = document.getElementById("handover-kpi-grid");
  const emitted = mockData.handovers.length;
  const confirmed = mockData.handovers.filter(function (item) { return item.status === "Confirmada"; }).length;
  const initial = mockData.handovers.filter(function (item) { return item.type === "Asignación inicial"; }).length;
  const reassigned = mockData.handovers.filter(function (item) { return item.type === "Reasignación"; }).length;

  kpiGrid.innerHTML = [
    { label: "Actas emitidas", value: emitted, helper: "Periodo actual", tone: "info" },
    { label: "Actas confirmadas", value: confirmed, helper: "Con recepción validada", tone: "success" },
    { label: "Asignaciones iniciales", value: initial, helper: "Entregas nuevas", tone: "info" },
    { label: "Reasignaciones", value: reassigned, helper: "Movimientos internos", tone: "warning" }
  ].map(function (item) {
    return `
      <article class="kpi-card">
        <p class="eyebrow">${item.label}</p>
        <strong>${item.value}</strong>
        <span class="badge badge-${item.tone}">${item.helper}</span>
      </article>
    `;
  }).join("");

  renderHandoverFilters();
  renderHandoverTable(mockData.handovers);
}

function renderHandoverFilters() {
  const typeSelect = document.getElementById("handover-filter-type");
  const currentValue = typeSelect.value;
  const types = [...new Set(mockData.handovers.map(function (item) { return item.type; }))];

  typeSelect.innerHTML = `<option value="">Todos</option>${types.map(function (type) {
    return `<option value="${type}">${type}</option>`;
  }).join("")}`;

  if (types.includes(currentValue) || currentValue === "") {
    typeSelect.value = currentValue;
  }
}

function renderHandoverTable(items) {
  const body = document.getElementById("handover-table-body");
  const actionLabel = getModuleActionLabel("handover");
  body.innerHTML = items.map(function (item) {
    const selectedAssets = normalizeSelectedHandoverAssets(item);
    const assetLabel = selectedAssets.length > 1
      ? `${selectedAssets[0].assetCode} · ${selectedAssets[0].assetName} +${selectedAssets.length - 1}`
      : `${item.assetCode} · ${item.assetName}`;
    return `
      <tr>
        <td>${item.document}</td>
        <td>${item.date}</td>
        <td>${item.type}</td>
        <td>${assetLabel}</td>
        <td>${item.user}</td>
        <td>${item.owner}</td>
        <td>${createStatusBadge(item.status)}</td>
        <td><button class="btn btn-secondary js-handover-detail" type="button" data-handover-id="${item.id}">${actionLabel}</button></td>
      </tr>
    `;
  }).join("");
}

function getNextHandoverDocument() {
  const currentYear = String(new Date().getFullYear());
  const sequences = mockData.handovers.map(function (item) {
    const match = item.document.match(/^ENT-(\d{4})-(\d+)$/);
    if (!match || match[1] !== currentYear) {
      return 0;
    }
    return Number(match[2]);
  });
  const nextSequence = Math.max(0, ...sequences) + 1;
  return `ENT-${currentYear}-${String(nextSequence).padStart(4, "0")}`;
}

function getDefaultHandoverDraft() {
  const defaultUser = mockData.users[0] || {};
  const now = new Date();

  return {
    document: getNextHandoverDocument(),
    date: new Date().toISOString().slice(0, 10),
    generatedAt: now.toISOString().slice(0, 16),
    type: "Asignación inicial",
    reason: "",
    user: defaultUser.name || "",
    userIdentifier: defaultUser.identifier || "",
    owner: getLoggedInUserName(),
    status: "Borrador",
    notes: "",
    assetCode: "",
    assetName: "",
    selectedAssets: []
  };
}

function getHandoverChecklistDefinitions() {
  return (mockData.checklistDefinitionsByModule.handover || []).slice();
}

function getActiveHandoverChecklistDefinitions() {
  return getHandoverChecklistDefinitions().filter(function (item) {
    return item.status === "Activo";
  });
}

function getHandoverChecklistDefinition(checklistId) {
  return getHandoverChecklistDefinitions().find(function (item) {
    return item.id === checklistId;
  }) || null;
}

function normalizeHandoverChecklistSections(sections) {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections.map(function (section) {
    return {
      id: section.id,
      collapsed: section.collapsed !== undefined ? section.collapsed : false,
      answers: Object.assign({}, section.answers || {})
    };
  }).filter(function (section) {
    return !!getHandoverChecklistDefinition(section.id);
  });
}

function normalizeSelectedHandoverAssets(record) {
  if (record && Array.isArray(record.selectedAssets) && record.selectedAssets.length) {
    return record.selectedAssets.map(function (item) {
      const asset = mockData.assets.find(function (entry) { return entry.code === item.assetCode; }) || {};
      return {
        assetCode: item.assetCode,
        assetName: item.assetName || asset.name || "",
        collapsed: item.collapsed !== undefined ? item.collapsed : false,
        checklistSections: normalizeHandoverChecklistSections(item.checklistSections || [])
      };
    });
  }

  if (record && record.assetCode) {
    return [{
      assetCode: record.assetCode,
      assetName: record.assetName || "",
      collapsed: false,
      checklistSections: normalizeHandoverChecklistSections(record.checklistSections || [])
    }];
  }

  return [];
}

function setHandoverSectionCollapse(toggleId, contentId, collapsed, expandLabel, collapseLabel) {
  const toggle = document.getElementById(toggleId);
  const content = document.getElementById(contentId);

  if (!toggle || !content) {
    return;
  }

  content.classList.toggle("is-collapsed", collapsed);
  toggle.classList.toggle("is-collapsed", collapsed);
  toggle.title = collapsed ? expandLabel : collapseLabel;
  toggle.setAttribute("aria-label", collapsed ? expandLabel : collapseLabel);
}

function renderHandoverAssetSelector() {
  const selector = document.getElementById("handover-record-asset");
  const addButton = document.getElementById("handover-asset-add");
  const selectedCodes = currentHandoverAssetState.items.map(function (item) {
    return item.assetCode;
  });
  const available = mockData.assets.filter(function (asset) {
    return !selectedCodes.includes(asset.code);
  });

  if (!selector) {
    return;
  }

  selector.innerHTML = available.length
    ? `<option value="">Selecciona un activo</option>${available.map(function (item) {
      return `<option value="${item.code}">${getAssetDisplayName(item)}</option>`;
    }).join("")}`
    : `<option value="">No hay activos disponibles</option>`;

  selector.disabled = !available.length;
  selector.value = "";
  if (addButton) {
    addButton.disabled = true;
  }
}

function populateHandoverUserAutocomplete(selectedUserName) {
  const input = document.getElementById("handover-record-user");
  const list = document.getElementById("handover-user-list");

  if (!input || !list) {
    return;
  }

  list.innerHTML = mockData.users.map(function (user) {
    return `<option value="${user.name}">${user.identifier} · ${user.email}</option>`;
  }).join("");
  input.value = selectedUserName || "";
}

function getSelectedHandoverUser() {
  const input = document.getElementById("handover-record-user");
  const value = input ? input.value.trim().toLowerCase() : "";

  if (!value) {
    return null;
  }

  return mockData.users.find(function (item) {
    return item.name.toLowerCase() === value
      || item.identifier.toLowerCase() === value
      || item.email.toLowerCase() === value;
  }) || null;
}

function renderUserDestinationSummary() {
  const user = getSelectedHandoverUser();
  const container = document.getElementById("handover-user-summary");

  if (!container) {
    return;
  }

  container.innerHTML = user ? `
    <p class="eyebrow">Persona seleccionada</p>
    <h4>${user.name}</h4>
    <p>${user.identifier} · ${user.area}</p>
    <p>${user.email}</p>
  ` : `
    <p class="eyebrow">Persona seleccionada</p>
    <h4>Sin usuario destino</h4>
    <p>Selecciona la persona que recibirá el o los activos.</p>
  `;
}

function renderAssetChecklistSelector(assetItem) {
  const selectedIds = assetItem.checklistSections.map(function (section) {
    return section.id;
  });
  const available = getActiveHandoverChecklistDefinitions().filter(function (item) {
    return !selectedIds.includes(item.id);
  });

  return available.length
    ? `<option value="">Selecciona un checklist</option>${available.map(function (item) {
      return `<option value="${item.id}">${item.name}</option>`;
    }).join("")}`
    : `<option value="">No hay checklists disponibles</option>`;
}

function renderSelectedHandoverAssets() {
  const container = document.getElementById("handover-selected-assets");

  if (!container) {
    return;
  }

  if (!currentHandoverAssetState.items.length) {
    container.innerHTML = `<div class="handover-checklist-empty">Aun no hay activos cargados en el acta. Agrega al menos un activo para completar la entrega.</div>`;
    renderHandoverAssetSelector();
    return;
  }

  container.innerHTML = currentHandoverAssetState.items.map(function (assetItem, index) {
    const asset = mockData.assets.find(function (entry) { return entry.code === assetItem.assetCode; }) || null;
    const checklistMarkup = assetItem.checklistSections.length ? assetItem.checklistSections.map(function (section, sectionIndex) {
      const definition = getHandoverChecklistDefinition(section.id);

      if (!definition) {
        return "";
      }

      const checksMarkup = definition.checks.map(function (check, checkIndex) {
        const answer = section.answers[check.id] || "";
        let controlMarkup = "";

        if (check.type === "Check") {
          controlMarkup = `
            <label class="handover-check-boolean">
              <input type="checkbox" data-handover-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}"${answer === true ? " checked" : ""}>
              <span>Validado</span>
            </label>
          `;
        } else if (check.type === "Input text") {
          controlMarkup = `<input type="text" data-handover-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}" value="${escapeHtml(answer)}" placeholder="Completar campo">`;
        } else if (check.type === "Text area") {
          controlMarkup = `<textarea rows="4" data-handover-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}" placeholder="Completar detalle">${escapeHtml(answer)}</textarea>`;
        } else if (check.type === "Option / Radio") {
          controlMarkup = `
            <div class="handover-check-radio-group">
              <label>
                <input type="radio" name="handover-${assetItem.assetCode}-${section.id}-${checkIndex}" value="${check.optionA}" data-handover-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}"${answer === check.optionA ? " checked" : ""}>
                <span>${check.optionA}</span>
              </label>
              <label>
                <input type="radio" name="handover-${assetItem.assetCode}-${section.id}-${checkIndex}" value="${check.optionB}" data-handover-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}"${answer === check.optionB ? " checked" : ""}>
                <span>${check.optionB}</span>
              </label>
            </div>
          `;
        }

        return `
          <div class="handover-check-item">
            <div class="handover-check-item-header">
              <strong>${check.name}</strong>
              <p>${check.description}</p>
            </div>
            ${controlMarkup}
          </div>
        `;
      }).join("");

      return `
        <article class="handover-checklist-card">
          <div class="handover-checklist-card-header">
            <div class="handover-checklist-card-title">
              <strong>${definition.name}</strong>
              <p>${definition.description}</p>
            </div>
            <div class="handover-checklist-card-actions">
              <button class="report-toggle-button ${section.collapsed ? "is-collapsed" : ""} js-handover-checklist-toggle" type="button" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" title="${section.collapsed ? "Expandir checklist" : "Colapsar checklist"}" aria-label="${section.collapsed ? "Expandir checklist" : "Colapsar checklist"}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 10l5 5 5-5" />
                </svg>
              </button>
              <button class="btn btn-secondary js-handover-checklist-remove" type="button" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}">Quitar</button>
            </div>
          </div>
          <div class="handover-checklist-content ${section.collapsed ? "is-collapsed" : ""}">
            ${checksMarkup}
          </div>
        </article>
      `;
    }).join("") : `<div class="handover-checklist-empty">Este activo aun no tiene checklists asociados.</div>`;

    return `
      <article class="handover-checklist-card">
        <div class="handover-checklist-card-header">
          <div class="handover-checklist-card-title">
            <strong>${asset ? getAssetDisplayName(asset) : assetItem.assetCode}</strong>
            <div class="handover-asset-meta">
              ${asset ? `<span class="badge">${asset.model}</span>` : ""}
              ${asset ? `<span class="badge">${asset.brand}</span>` : ""}
              ${asset ? `<span class="badge">${asset.location}</span>` : ""}
            </div>
          </div>
          <div class="handover-checklist-card-actions">
            <button class="report-toggle-button ${assetItem.collapsed ? "is-collapsed" : ""} js-handover-asset-toggle" type="button" data-asset-code="${assetItem.assetCode}" title="${assetItem.collapsed ? "Expandir activo" : "Colapsar activo"}" aria-label="${assetItem.collapsed ? "Expandir activo" : "Colapsar activo"}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 10l5 5 5-5" />
              </svg>
            </button>
            <button class="btn btn-secondary js-handover-asset-remove" type="button" data-asset-code="${assetItem.assetCode}">Quitar activo</button>
          </div>
        </div>
        <div class="handover-checklist-content ${assetItem.collapsed ? "is-collapsed" : ""}">
          <div class="handover-asset-checklist-toolbar">
            <label class="field">
              <span>Agregar checklist a este activo</span>
              <select data-handover-asset-checklist-selector="${assetItem.assetCode}">
                ${renderAssetChecklistSelector(assetItem)}
              </select>
            </label>
            <button class="btn btn-secondary js-handover-asset-checklist-add" type="button" data-asset-code="${assetItem.assetCode}">Agregar checklist</button>
          </div>
          ${checklistMarkup}
        </div>
      </article>
    `;
  }).join("");

  renderHandoverAssetSelector();
}

function renderHandoverDetail(handoverId, mode) {
  const isCreateMode = mode === "create";
  const record = isCreateMode
    ? getDefaultHandoverDraft()
    : (mockData.handovers.find(function (item) { return item.id === handoverId; }) || mockData.handovers[0]);
  const title = document.getElementById("handover-page-title");
  const description = document.getElementById("handover-page-description");
  const saveButton = document.getElementById("handover-save-button");

  if (!record) {
    return;
  }

  currentHandoverWorkspaceId = isCreateMode ? null : record.id;
  currentHandoverWorkspaceMode = isCreateMode ? "create" : "edit";
  currentHandoverDocument = record.document || "";

  if (title) {
    title.textContent = isCreateMode ? "Nueva acta de entrega" : `Editar ${record.document}`;
  }

  if (description) {
    description.textContent = isCreateMode
      ? "Completa el formulario para emitir una nueva acta de entrega sin salir del módulo."
      : "Ajusta la emisión, valida el contexto y actualiza el checklist desde esta página.";
  }

  if (saveButton) {
    saveButton.textContent = isCreateMode ? "Guardar acta" : "Guardar cambios";
  }

  document.getElementById("handover-record-type").value = record.type;
  document.getElementById("handover-record-reason").value = record.reason || "";
  document.getElementById("handover-record-owner").value = record.owner;
  document.getElementById("handover-record-notes").value = record.notes || "";
  populateHandoverUserAutocomplete(record.user);
  currentHandoverAssetState = {
    items: normalizeSelectedHandoverAssets(record)
  };
  renderHandoverAssetSelector();
  renderSelectedHandoverAssets();
  renderUserDestinationSummary();
  document.getElementById("handover-record-generated-at").value = record.generatedAt || `${record.date}T09:00`;
  document.getElementById("handover-record-status").value = record.status || "Borrador";
  setHandoverSectionCollapse("handover-user-toggle", "handover-user-content", !isCreateMode, "Expandir usuario destino", "Colapsar usuario destino");
  setHandoverSectionCollapse("handover-form-toggle", "handover-form-content", !isCreateMode, "Expandir datos de emisión", "Colapsar datos de emisión");
}

function filterHandovers() {
  const documentValue = document.getElementById("handover-filter-document").value.toLowerCase();
  const userValue = document.getElementById("handover-filter-user").value.toLowerCase();
  const assetValue = document.getElementById("handover-filter-asset").value.toLowerCase();
  const typeValue = document.getElementById("handover-filter-type").value;

  const filtered = mockData.handovers.filter(function (item) {
    const selectedAssets = normalizeSelectedHandoverAssets(item);
    const matchesAsset = !assetValue || selectedAssets.some(function (asset) {
      return asset.assetCode.toLowerCase().includes(assetValue) || asset.assetName.toLowerCase().includes(assetValue);
    }) || item.assetCode.toLowerCase().includes(assetValue) || item.assetName.toLowerCase().includes(assetValue);

    return (!documentValue || item.document.toLowerCase().includes(documentValue))
      && (!userValue || item.user.toLowerCase().includes(userValue) || item.userIdentifier.toLowerCase().includes(userValue))
      && matchesAsset
      && (!typeValue || item.type === typeValue);
  });

  renderHandoverTable(filtered);
}

let currentReassignmentWorkspaceId = null;
let currentReassignmentWorkspaceMode = "create";
let currentReassignmentDocument = "";
let currentReassignmentAssetState = { items: [] };

function getReassignmentRecords() {
  return mockData.reassignments || [];
}

function getNextReassignmentDocument() {
  const currentYear = String(new Date().getFullYear());
  const sequences = getReassignmentRecords().map(function (item) {
    const match = item.document.match(/^REA-(\d{4})-(\d+)$/);
    return match && match[1] === currentYear ? Number(match[2]) : 0;
  });
  return `REA-${currentYear}-${String(Math.max(0, ...sequences) + 1).padStart(4, "0")}`;
}

function getDefaultReassignmentDraft() {
  const now = new Date();
  return {
    document: getNextReassignmentDocument(),
    date: new Date().toISOString().slice(0, 10),
    generatedAt: now.toISOString().slice(0, 16),
    originUser: "",
    originUserIdentifier: "",
    destinationUser: "",
    destinationUserIdentifier: "",
    owner: getLoggedInUserName(),
    status: "Borrador",
    reason: "",
    notes: "",
    assetCode: "",
    assetName: "",
    selectedAssets: []
  };
}

function normalizeSelectedReassignmentAssets(record) {
  if (record && Array.isArray(record.selectedAssets) && record.selectedAssets.length) {
    return record.selectedAssets.map(function (item) {
      const asset = mockData.assets.find(function (entry) { return entry.code === item.assetCode; }) || {};
      return { assetCode: item.assetCode, assetName: item.assetName || asset.name || "", collapsed: item.collapsed !== undefined ? item.collapsed : false, checklistSections: normalizeHandoverChecklistSections(item.checklistSections || []) };
    });
  }
  if (record && record.assetCode) {
    return [{ assetCode: record.assetCode, assetName: record.assetName || "", collapsed: false, checklistSections: normalizeHandoverChecklistSections(record.checklistSections || []) }];
  }
  return [];
}

function populateReassignmentUserAutocomplete(inputId, listId, selectedUserName) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!input || !list) return;
  list.innerHTML = mockData.users.map(function (user) { return `<option value="${user.name}">${user.identifier} · ${user.email}</option>`; }).join("");
  input.value = selectedUserName || "";
}

function getReassignmentUserByInput(inputId) {
  const input = document.getElementById(inputId);
  const value = input ? input.value.trim().toLowerCase() : "";
  if (!value) return null;
  return mockData.users.find(function (item) { return item.name.toLowerCase() === value || item.identifier.toLowerCase() === value || item.email.toLowerCase() === value; }) || null;
}

function renderReassignmentUserSummary(containerId, user, emptyTitle, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = user ? `<p class="eyebrow">Persona seleccionada</p><h4>${user.name}</h4><p>${user.identifier} · ${user.area}</p><p>${user.email}</p>` : `<p class="eyebrow">Persona seleccionada</p><h4>${emptyTitle}</h4><p>${emptyText}</p>`;
}

function renderReassignmentOriginSummary() {
  renderReassignmentUserSummary("reassignment-origin-summary", getReassignmentUserByInput("reassignment-record-origin-user"), "Sin usuario origen", "Selecciona la persona que entrega el o los activos.");
}

function renderReassignmentDestinationSummary() {
  renderReassignmentUserSummary("reassignment-destination-summary", getReassignmentUserByInput("reassignment-record-destination-user"), "Sin usuario destino", "Selecciona la persona que recibira el o los activos.");
}

function renderReassignment() {
  const kpiGrid = document.getElementById("reassignment-kpi-grid");
  const records = getReassignmentRecords();
  const total = records.length;
  const confirmed = records.filter(function (item) { return item.status === "Confirmada"; }).length;
  const draft = records.filter(function (item) { return item.status === "Borrador"; }).length;
  const multiAsset = records.filter(function (item) { return normalizeSelectedReassignmentAssets(item).length > 1; }).length;
  kpiGrid.innerHTML = [
    { label: "Actas emitidas", value: total, helper: "Periodo actual", tone: "info" },
    { label: "Actas confirmadas", value: confirmed, helper: "Con traspaso validado", tone: "success" },
    { label: "Pendientes de cierre", value: draft, helper: "Aun en borrador", tone: "warning" },
    { label: "Actas multi-activo", value: multiAsset, helper: "Transferencias agrupadas", tone: "info" }
  ].map(function (item) { return `<article class="kpi-card"><p class="eyebrow">${item.label}</p><strong>${item.value}</strong><span class="badge badge-${item.tone}">${item.helper}</span></article>`; }).join("");
  renderReassignmentTable(records);
}

function renderReassignmentTable(items) {
  const body = document.getElementById("reassignment-table-body");
  const actionLabel = getModuleActionLabel("reassignment");
  body.innerHTML = items.map(function (item) {
    const selectedAssets = normalizeSelectedReassignmentAssets(item);
    const assetLabel = selectedAssets.length > 1 ? `${selectedAssets[0].assetCode} · ${selectedAssets[0].assetName} +${selectedAssets.length - 1}` : `${item.assetCode} · ${item.assetName}`;
    return `<tr><td>${item.document}</td><td>${item.date}</td><td>${assetLabel}</td><td>${item.originUser}</td><td>${item.destinationUser}</td><td>${item.owner}</td><td>${createStatusBadge(item.status)}</td><td><button class="btn btn-secondary js-reassignment-detail" type="button" data-reassignment-id="${item.id}">${actionLabel}</button></td></tr>`;
  }).join("");
}

function renderReassignmentAssetSelector() {
  const selector = document.getElementById("reassignment-record-asset");
  const addButton = document.getElementById("reassignment-asset-add");
  const selectedCodes = currentReassignmentAssetState.items.map(function (item) { return item.assetCode; });
  const available = mockData.assets.filter(function (asset) { return !selectedCodes.includes(asset.code); });
  if (!selector) return;
  selector.innerHTML = available.length ? `<option value="">Selecciona un activo</option>${available.map(function (item) { return `<option value="${item.code}">${getAssetDisplayName(item)}</option>`; }).join("")}` : `<option value="">No hay activos disponibles</option>`;
  selector.disabled = !available.length;
  selector.value = "";
  if (addButton) addButton.disabled = true;
}

function renderReassignmentAssetChecklistSelector(assetItem) {
  const selectedIds = assetItem.checklistSections.map(function (section) { return section.id; });
  const available = getActiveHandoverChecklistDefinitions().filter(function (item) { return !selectedIds.includes(item.id); });
  return available.length ? `<option value="">Selecciona un checklist</option>${available.map(function (item) { return `<option value="${item.id}">${item.name}</option>`; }).join("")}` : `<option value="">No hay checklists disponibles</option>`;
}

function renderSelectedReassignmentAssets() {
  const container = document.getElementById("reassignment-selected-assets");
  if (!container) return;
  if (!currentReassignmentAssetState.items.length) {
    container.innerHTML = `<div class="handover-checklist-empty">Aun no hay activos cargados en el acta. Agrega al menos un activo para completar la reasignacion.</div>`;
    renderReassignmentAssetSelector();
    return;
  }
  container.innerHTML = currentReassignmentAssetState.items.map(function (assetItem, index) {
    const asset = mockData.assets.find(function (entry) { return entry.code === assetItem.assetCode; }) || null;
    const checklistMarkup = assetItem.checklistSections.length ? assetItem.checklistSections.map(function (section, sectionIndex) {
      const definition = getHandoverChecklistDefinition(section.id);
      if (!definition) return "";
      const checksMarkup = definition.checks.map(function (check, checkIndex) {
        const answer = section.answers[check.id] || "";
        let controlMarkup = "";
        if (check.type === "Check") {
          controlMarkup = `<label class="handover-check-boolean"><input type="checkbox" data-reassignment-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}"${answer === true ? " checked" : ""}><span>Validado</span></label>`;
        } else if (check.type === "Input text") {
          controlMarkup = `<input type="text" data-reassignment-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}" value="${escapeHtml(answer)}" placeholder="Completar campo">`;
        } else if (check.type === "Text area") {
          controlMarkup = `<textarea rows="4" data-reassignment-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}" placeholder="Completar detalle">${escapeHtml(answer)}</textarea>`;
        } else if (check.type === "Option / Radio") {
          controlMarkup = `<div class="handover-check-radio-group"><label><input type="radio" name="reassignment-${assetItem.assetCode}-${section.id}-${checkIndex}" value="${check.optionA}" data-reassignment-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}"${answer === check.optionA ? " checked" : ""}><span>${check.optionA}</span></label><label><input type="radio" name="reassignment-${assetItem.assetCode}-${section.id}-${checkIndex}" value="${check.optionB}" data-reassignment-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}"${answer === check.optionB ? " checked" : ""}><span>${check.optionB}</span></label></div>`;
        }
        return `<div class="handover-check-item"><div class="handover-check-item-header"><strong>${check.name}</strong><p>${check.description}</p></div>${controlMarkup}</div>`;
      }).join("");
      return `<article class="handover-checklist-card"><div class="handover-checklist-card-header"><div class="handover-checklist-card-title"><strong>${definition.name}</strong><p>${definition.description}</p></div><div class="handover-checklist-card-actions"><button class="report-toggle-button ${section.collapsed ? "is-collapsed" : ""} js-reassignment-checklist-toggle" type="button" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" title="${section.collapsed ? "Expandir checklist" : "Colapsar checklist"}" aria-label="${section.collapsed ? "Expandir checklist" : "Colapsar checklist"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg></button><button class="btn btn-secondary js-reassignment-checklist-remove" type="button" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}">Quitar</button></div></div><div class="handover-checklist-content ${section.collapsed ? "is-collapsed" : ""}">${checksMarkup}</div></article>`;
    }).join("") : `<div class="handover-checklist-empty">Este activo aun no tiene checklists asociados.</div>`;
    return `<article class="handover-checklist-card"><div class="handover-checklist-card-header"><div class="handover-checklist-card-title"><strong>${asset ? getAssetDisplayName(asset) : assetItem.assetCode}</strong><div class="handover-asset-meta">${asset ? `<span class="badge">${asset.model}</span>` : ""}${asset ? `<span class="badge">${asset.brand}</span>` : ""}${asset ? `<span class="badge">${asset.location}</span>` : ""}</div></div><div class="handover-checklist-card-actions"><button class="report-toggle-button ${assetItem.collapsed ? "is-collapsed" : ""} js-reassignment-asset-toggle" type="button" data-asset-code="${assetItem.assetCode}" title="${assetItem.collapsed ? "Expandir activo" : "Colapsar activo"}" aria-label="${assetItem.collapsed ? "Expandir activo" : "Colapsar activo"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg></button><button class="btn btn-secondary js-reassignment-asset-remove" type="button" data-asset-code="${assetItem.assetCode}">Quitar activo</button></div></div><div class="handover-checklist-content ${assetItem.collapsed ? "is-collapsed" : ""}"><div class="handover-asset-checklist-toolbar"><label class="field"><span>Agregar checklist a este activo</span><select data-reassignment-asset-checklist-selector="${assetItem.assetCode}">${renderReassignmentAssetChecklistSelector(assetItem)}</select></label><button class="btn btn-secondary js-reassignment-asset-checklist-add" type="button" data-asset-code="${assetItem.assetCode}">Agregar checklist</button></div>${checklistMarkup}</div></article>`;
  }).join("");
  renderReassignmentAssetSelector();
}

function renderReassignmentDetail(reassignmentId, mode) {
  const isCreateMode = mode === "create";
  const record = isCreateMode ? getDefaultReassignmentDraft() : (getReassignmentRecords().find(function (item) { return item.id === reassignmentId; }) || getReassignmentRecords()[0]);
  const title = document.getElementById("reassignment-page-title");
  const description = document.getElementById("reassignment-page-description");
  const saveButton = document.getElementById("reassignment-save-button");
  if (!record) return;
  currentReassignmentWorkspaceId = isCreateMode ? null : record.id;
  currentReassignmentWorkspaceMode = isCreateMode ? "create" : "edit";
  currentReassignmentDocument = record.document || "";
  if (title) title.textContent = isCreateMode ? "Nueva Acta de Reasignacion" : `Editar ${record.document}`;
  if (description) description.textContent = isCreateMode ? "Completa el formulario para emitir una nueva Acta de Reasignacion sin salir del modulo." : "Ajusta el traspaso, valida usuarios y actualiza el checklist desde esta pagina.";
  if (saveButton) saveButton.textContent = isCreateMode ? "Guardar acta" : "Guardar cambios";
  document.getElementById("reassignment-record-generated-at").value = record.generatedAt || `${record.date}T09:00`;
  document.getElementById("reassignment-record-owner").value = record.owner || getLoggedInUserName();
  document.getElementById("reassignment-record-status").value = record.status || "Borrador";
  document.getElementById("reassignment-record-reason").value = record.reason || "";
  document.getElementById("reassignment-record-notes").value = record.notes || "";
  populateReassignmentUserAutocomplete("reassignment-record-origin-user", "reassignment-origin-user-list", record.originUser);
  populateReassignmentUserAutocomplete("reassignment-record-destination-user", "reassignment-destination-user-list", record.destinationUser);
  currentReassignmentAssetState = { items: normalizeSelectedReassignmentAssets(record) };
  renderReassignmentAssetSelector();
  renderSelectedReassignmentAssets();
  renderReassignmentOriginSummary();
  renderReassignmentDestinationSummary();
  setHandoverSectionCollapse("reassignment-origin-toggle", "reassignment-origin-content", !isCreateMode, "Expandir usuario origen", "Colapsar usuario origen");
  setHandoverSectionCollapse("reassignment-destination-toggle", "reassignment-destination-content", !isCreateMode, "Expandir usuario destino", "Colapsar usuario destino");
  setHandoverSectionCollapse("reassignment-form-toggle", "reassignment-form-content", !isCreateMode, "Expandir datos de emision", "Colapsar datos de emision");
}

function filterReassignments() {
  const documentValue = document.getElementById("reassignment-filter-document").value.toLowerCase();
  const originValue = document.getElementById("reassignment-filter-origin-user").value.toLowerCase();
  const destinationValue = document.getElementById("reassignment-filter-destination-user").value.toLowerCase();
  const assetValue = document.getElementById("reassignment-filter-asset").value.toLowerCase();
  const filtered = getReassignmentRecords().filter(function (item) {
    const selectedAssets = normalizeSelectedReassignmentAssets(item);
    const matchesAsset = !assetValue || selectedAssets.some(function (asset) { return asset.assetCode.toLowerCase().includes(assetValue) || asset.assetName.toLowerCase().includes(assetValue); }) || item.assetCode.toLowerCase().includes(assetValue) || item.assetName.toLowerCase().includes(assetValue);
    return (!documentValue || item.document.toLowerCase().includes(documentValue)) && (!originValue || item.originUser.toLowerCase().includes(originValue) || item.originUserIdentifier.toLowerCase().includes(originValue)) && (!destinationValue || item.destinationUser.toLowerCase().includes(destinationValue) || item.destinationUserIdentifier.toLowerCase().includes(destinationValue)) && matchesAsset;
  });
  renderReassignmentTable(filtered);
}

let currentReceptionWorkspaceId = null;
let currentReceptionWorkspaceMode = "create";
let currentReceptionDocument = "";
let currentReceptionAssetState = { items: [] };

function getNextReceptionDocument() {
  const currentYear = String(new Date().getFullYear());
  const sequences = mockData.receptions.map(function (item) {
    const match = item.document.match(/^REC-(\d{4})-(\d+)$/);
    if (!match || match[1] !== currentYear) {
      return 0;
    }
    return Number(match[2]);
  });
  return `REC-${currentYear}-${String(Math.max(0, ...sequences) + 1).padStart(4, "0")}`;
}

function getDefaultReceptionDraft() {
  const defaultUser = mockData.users[0] || {};
  const now = new Date();

  return {
    document: getNextReceptionDocument(),
    generatedAt: now.toISOString().slice(0, 16),
    date: now.toISOString().slice(0, 10),
    deliverer: defaultUser.name || "",
    receiver: getLoggedInUserName(),
    origin: defaultUser.location || "",
    reason: "",
    receivedState: "Borrador",
    owner: getLoggedInUserName(),
    assetCode: "",
    assetName: "",
    selectedAssets: []
  };
}

function getActiveReceptionChecklistDefinitions() {
  return (mockData.checklistDefinitionsByModule.reception || []).filter(function (item) {
    return item.status === "Activo";
  });
}

function getReceptionChecklistDefinition(checklistId) {
  return (mockData.checklistDefinitionsByModule.reception || []).find(function (item) {
    return item.id === checklistId;
  }) || null;
}

function normalizeReceptionChecklistSections(sections) {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections.map(function (section) {
    return {
      id: section.id,
      collapsed: section.collapsed !== undefined ? section.collapsed : false,
      answers: Object.assign({}, section.answers || {})
    };
  }).filter(function (section) {
    return !!getReceptionChecklistDefinition(section.id);
  });
}

function normalizeSelectedReceptionAssets(record) {
  if (record && Array.isArray(record.selectedAssets) && record.selectedAssets.length) {
    return record.selectedAssets.map(function (item) {
      const asset = mockData.assets.find(function (entry) { return entry.code === item.assetCode; }) || {};
      return {
        assetCode: item.assetCode,
        assetName: item.assetName || asset.name || "",
        collapsed: item.collapsed !== undefined ? item.collapsed : false,
        checklistSections: normalizeReceptionChecklistSections(item.checklistSections || [])
      };
    });
  }

  if (record && record.assetCode) {
    return [{
      assetCode: record.assetCode,
      assetName: record.assetName || "",
      collapsed: false,
      checklistSections: normalizeReceptionChecklistSections(record.checklistSections || [])
    }];
  }

  return [];
}

function populateReceptionUserAutocomplete(selectedUserName) {
  const input = document.getElementById("reception-record-deliverer");
  const list = document.getElementById("reception-user-list");
  if (!input || !list) return;
  list.innerHTML = mockData.users.map(function (user) {
    return `<option value="${user.name}">${user.identifier} · ${user.email}</option>`;
  }).join("");
  input.value = selectedUserName || "";
}

function getSelectedReceptionUser() {
  const input = document.getElementById("reception-record-deliverer");
  const value = input ? input.value.trim().toLowerCase() : "";
  if (!value) return null;
  return mockData.users.find(function (item) {
    return item.name.toLowerCase() === value
      || item.identifier.toLowerCase() === value
      || item.email.toLowerCase() === value;
  }) || null;
}

function renderReceptionUserSummary() {
  const user = getSelectedReceptionUser();
  const container = document.getElementById("reception-user-summary");
  if (!container) return;
  if (user) {
    const originField = document.getElementById("reception-record-origin");
    if (originField && !originField.value.trim()) {
      originField.value = user.location || user.area || "";
    }
  }
  container.innerHTML = user ? `
    <p class="eyebrow">Persona seleccionada</p>
    <h4>${user.name}</h4>
    <p>${user.identifier} · ${user.area}</p>
    <p>${user.email}</p>
  ` : `
    <p class="eyebrow">Persona seleccionada</p>
    <h4>Sin usuario origen</h4>
    <p>Selecciona la persona o referencia que entrega el o los activos.</p>
  `;
}

function renderReceptionAssetSelector() {
  const selector = document.getElementById("reception-record-asset");
  const addButton = document.getElementById("reception-asset-add");
  const selectedCodes = currentReceptionAssetState.items.map(function (item) { return item.assetCode; });
  const available = mockData.assets.filter(function (asset) { return !selectedCodes.includes(asset.code); });
  if (!selector) return;
  selector.innerHTML = available.length
    ? `<option value="">Selecciona un activo</option>${available.map(function (item) { return `<option value="${item.code}">${getAssetDisplayName(item)}</option>`; }).join("")}`
    : `<option value="">No hay activos disponibles</option>`;
  selector.disabled = !available.length;
  selector.value = "";
  if (addButton) addButton.disabled = true;
}

function renderReceptionAssetChecklistSelector(assetItem) {
  const selectedIds = assetItem.checklistSections.map(function (section) { return section.id; });
  const available = getActiveReceptionChecklistDefinitions().filter(function (item) { return !selectedIds.includes(item.id); });
  return available.length
    ? `<option value="">Selecciona un checklist</option>${available.map(function (item) { return `<option value="${item.id}">${item.name}</option>`; }).join("")}`
    : `<option value="">No hay checklists disponibles</option>`;
}

function renderSelectedReceptionAssets() {
  const container = document.getElementById("reception-selected-assets");
  if (!container) return;

  if (!currentReceptionAssetState.items.length) {
    container.innerHTML = `<div class="handover-checklist-empty">Aun no hay activos cargados en la recepción.</div>`;
    renderReceptionAssetSelector();
    return;
  }

  container.innerHTML = currentReceptionAssetState.items.map(function (assetItem) {
    const asset = mockData.assets.find(function (entry) { return entry.code === assetItem.assetCode; }) || null;
    const checklistMarkup = assetItem.checklistSections.length ? assetItem.checklistSections.map(function (section) {
      const definition = getReceptionChecklistDefinition(section.id);
      if (!definition) return "";
      const checksMarkup = definition.checks.map(function (check, checkIndex) {
        const answer = section.answers[check.id] || "";
        let controlMarkup = "";
        if (check.type === "Check") {
          controlMarkup = `<label class="handover-check-boolean"><input type="checkbox" data-reception-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}"${answer === true ? " checked" : ""}><span>Validado</span></label>`;
        } else if (check.type === "Input text") {
          controlMarkup = `<input type="text" data-reception-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}" value="${escapeHtml(answer)}" placeholder="Completar campo">`;
        } else if (check.type === "Text area") {
          controlMarkup = `<textarea rows="4" data-reception-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}" placeholder="Completar detalle">${escapeHtml(answer)}</textarea>`;
        } else if (check.type === "Option / Radio") {
          controlMarkup = `<div class="handover-check-radio-group"><label><input type="radio" name="reception-${assetItem.assetCode}-${section.id}-${checkIndex}" value="${check.optionA}" data-reception-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}"${answer === check.optionA ? " checked" : ""}><span>${check.optionA}</span></label><label><input type="radio" name="reception-${assetItem.assetCode}-${section.id}-${checkIndex}" value="${check.optionB}" data-reception-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}"${answer === check.optionB ? " checked" : ""}><span>${check.optionB}</span></label></div>`;
        }
        return `<div class="handover-check-item"><div class="handover-check-item-header"><strong>${check.name}</strong><p>${check.description}</p></div>${controlMarkup}</div>`;
      }).join("");
      return `<article class="handover-checklist-card"><div class="handover-checklist-card-header"><div class="handover-checklist-card-title"><strong>${definition.name}</strong><p>${definition.description}</p></div><div class="handover-checklist-card-actions"><button class="report-toggle-button ${section.collapsed ? "is-collapsed" : ""} js-reception-checklist-toggle" type="button" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" title="${section.collapsed ? "Expandir checklist" : "Colapsar checklist"}" aria-label="${section.collapsed ? "Expandir checklist" : "Colapsar checklist"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg></button><button class="btn btn-secondary js-reception-checklist-remove" type="button" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}">Quitar</button></div></div><div class="handover-checklist-content ${section.collapsed ? "is-collapsed" : ""}">${checksMarkup}</div></article>`;
    }).join("") : `<div class="handover-checklist-empty">Este activo aun no tiene checklists asociados.</div>`;

    return `<article class="handover-checklist-card"><div class="handover-checklist-card-header"><div class="handover-checklist-card-title"><strong>${asset ? getAssetDisplayName(asset) : assetItem.assetCode}</strong><div class="handover-asset-meta">${asset ? `<span class="badge">${asset.model}</span>` : ""}${asset ? `<span class="badge">${asset.brand}</span>` : ""}${asset ? `<span class="badge">${asset.location}</span>` : ""}</div></div><div class="handover-checklist-card-actions"><button class="report-toggle-button ${assetItem.collapsed ? "is-collapsed" : ""} js-reception-asset-toggle" type="button" data-asset-code="${assetItem.assetCode}" title="${assetItem.collapsed ? "Expandir activo" : "Colapsar activo"}" aria-label="${assetItem.collapsed ? "Expandir activo" : "Colapsar activo"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg></button><button class="btn btn-secondary js-reception-asset-remove" type="button" data-asset-code="${assetItem.assetCode}">Quitar activo</button></div></div><div class="handover-checklist-content ${assetItem.collapsed ? "is-collapsed" : ""}"><div class="handover-asset-checklist-toolbar"><label class="field"><span>Agregar checklist a este activo</span><select data-reception-asset-checklist-selector="${assetItem.assetCode}">${renderReceptionAssetChecklistSelector(assetItem)}</select></label><button class="btn btn-secondary js-reception-asset-checklist-add" type="button" data-asset-code="${assetItem.assetCode}">Agregar checklist</button></div>${checklistMarkup}</div></article>`;
  }).join("");

  renderReceptionAssetSelector();
}

function renderReception() {
  const kpiGrid = document.getElementById("reception-kpi-grid");
  const total = mockData.receptions.length;
  const inAnalysis = mockData.receptions.filter(function (item) { return item.receivedState === "En análisis"; }).length;
  const pending = mockData.receptions.filter(function (item) { return item.receivedState === "Pendiente de diagnóstico"; }).length;
  const inLab = mockData.receptions.filter(function (item) { return item.receivedState === "Ingresado a laboratorio"; }).length;
  kpiGrid.innerHTML = [
    { label: "Recepciones emitidas", value: total, helper: "Periodo actual", tone: "info" },
    { label: "En análisis", value: inAnalysis, helper: "Con evaluación inicial", tone: "warning" },
    { label: "Pendiente diagnóstico", value: pending, helper: "Por clasificar", tone: "warning" },
    { label: "Ingresadas a laboratorio", value: inLab, helper: "En tratamiento técnico", tone: "success" }
  ].map(function (item) {
    return `<article class="kpi-card"><p class="eyebrow">${item.label}</p><strong>${item.value}</strong><span class="badge badge-${item.tone}">${item.helper}</span></article>`;
  }).join("");
  renderReceptionFilters();
  renderReceptionTable(mockData.receptions);
}

function renderReceptionFilters() {
  const statusSelect = document.getElementById("reception-filter-status");
  const statuses = [...new Set(mockData.receptions.map(function (item) { return item.receivedState; }))];
  statusSelect.innerHTML = `<option value="">Todos</option>${statuses.map(function (status) { return `<option value="${status}">${status}</option>`; }).join("")}`;
}

function renderReceptionTable(items) {
  const body = document.getElementById("reception-table-body");
  const actionLabel = getModuleActionLabel("reception");
  body.innerHTML = items.map(function (item) {
    const selectedAssets = normalizeSelectedReceptionAssets(item);
    const assetLabel = selectedAssets.length > 1 ? `${selectedAssets[0].assetCode} · ${selectedAssets[0].assetName} +${selectedAssets.length - 1}` : `${item.assetCode} · ${item.assetName}`;
    return `<tr><td>${item.document}</td><td>${item.date}</td><td>${assetLabel}</td><td>${item.origin}</td><td>${item.reason}</td><td>${item.owner}</td><td>${createStatusBadge(item.receivedState)}</td><td><button class="btn btn-secondary js-reception-detail" type="button" data-reception-id="${item.id}">${actionLabel}</button></td></tr>`;
  }).join("");
}

function renderReceptionDetail(receptionId, mode) {
  const isCreateMode = mode === "create";
  const record = isCreateMode ? getDefaultReceptionDraft() : (mockData.receptions.find(function (item) { return item.id === receptionId; }) || mockData.receptions[0]);
  const title = document.getElementById("reception-page-title");
  const description = document.getElementById("reception-page-description");
  if (!record) return;
  currentReceptionWorkspaceId = isCreateMode ? null : record.id;
  currentReceptionWorkspaceMode = isCreateMode ? "create" : "edit";
  currentReceptionDocument = record.document || "";
  title.textContent = isCreateMode ? "Nueva acta de recepción" : `Editar ${record.document}`;
  description.textContent = isCreateMode ? "Completa la metadata, el usuario origen y los activos recibidos sin salir del módulo." : "Ajusta la recepción, valida origen y actualiza los checklists desde esta página.";
  document.getElementById("reception-record-generated-at").value = record.generatedAt || `${record.date}T09:00`;
  document.getElementById("reception-record-owner").value = record.owner || getLoggedInUserName();
  document.getElementById("reception-record-status").value = record.receivedState || "Borrador";
  document.getElementById("reception-record-origin").value = record.origin || "";
  document.getElementById("reception-record-reason").value = record.reason || "";
  document.getElementById("reception-record-notes").value = record.resultNotes || "";
  populateReceptionUserAutocomplete(record.deliverer);
  currentReceptionAssetState = { items: normalizeSelectedReceptionAssets(record) };
  renderReceptionAssetSelector();
  renderSelectedReceptionAssets();
  renderReceptionUserSummary();
  setHandoverSectionCollapse("reception-form-toggle", "reception-form-content", !isCreateMode, "Expandir datos de emisión", "Colapsar datos de emisión");
  setHandoverSectionCollapse("reception-user-toggle", "reception-user-content", !isCreateMode, "Expandir usuario origen", "Colapsar usuario origen");
}

function filterReceptions() {
  const documentValue = document.getElementById("reception-filter-document").value.toLowerCase();
  const assetValue = document.getElementById("reception-filter-asset").value.toLowerCase();
  const originValue = document.getElementById("reception-filter-origin").value.toLowerCase();
  const statusValue = document.getElementById("reception-filter-status").value;
  const filtered = mockData.receptions.filter(function (item) {
    const selectedAssets = normalizeSelectedReceptionAssets(item);
    const matchesAsset = !assetValue || selectedAssets.some(function (asset) {
      return asset.assetCode.toLowerCase().includes(assetValue) || asset.assetName.toLowerCase().includes(assetValue);
    }) || item.assetCode.toLowerCase().includes(assetValue) || item.assetName.toLowerCase().includes(assetValue);
    return (!documentValue || item.document.toLowerCase().includes(documentValue))
      && matchesAsset
      && (!originValue || item.origin.toLowerCase().includes(originValue) || item.deliverer.toLowerCase().includes(originValue))
      && (!statusValue || item.receivedState === statusValue);
  });
  renderReceptionTable(filtered);
}

function renderAssetFilters() {
  const classSelect = document.getElementById("asset-filter-class");
  const brandSelect = document.getElementById("asset-filter-brand");
  const modelSelect = document.getElementById("asset-filter-model");
  const statusSelect = document.getElementById("asset-filter-status");
  const currentClass = classSelect.value;
  const currentBrand = brandSelect.value;
  const currentModel = modelSelect.value;
  const currentValue = statusSelect.value;
  const classes = getCmdbAssetClasses().map(function (item) { return item.cmdbClass; });
  const brands = [...new Set(mockData.assets.map(function (asset) { return asset.brand; }))].filter(Boolean);
  const models = [...new Set(mockData.assets.map(function (asset) { return asset.model; }))].filter(Boolean);
  const statuses = [...new Set(mockData.assets.map(function (asset) { return asset.status; }))];

  classSelect.innerHTML = `<option value="">Todas</option>${classes.map(function (cmdbClass) {
    return `<option value="${cmdbClass}">${cmdbClass}</option>`;
  }).join("")}`;
  brandSelect.innerHTML = `<option value="">Todas</option>${brands.map(function (brand) {
    return `<option value="${brand}">${brand}</option>`;
  }).join("")}`;
  modelSelect.innerHTML = `<option value="">Todos</option>${models.map(function (model) {
    return `<option value="${model}">${model}</option>`;
  }).join("")}`;
  statusSelect.innerHTML = `<option value="">Todos</option>${statuses.map(function (status) {
    return `<option value="${status}">${status}</option>`;
  }).join("")}`;

  if (classes.includes(currentClass) || currentClass === "") {
    classSelect.value = currentClass;
  }

  if (brands.includes(currentBrand) || currentBrand === "") {
    brandSelect.value = currentBrand;
  }

  if (models.includes(currentModel) || currentModel === "") {
    modelSelect.value = currentModel;
  }

  if (statuses.includes(currentValue) || currentValue === "") {
    statusSelect.value = currentValue;
  }
}

let currentAssetWorkspaceId = null;
let currentAssetWorkspaceMode = "create";

function getNextAssetCode() {
  const currentYear = String(new Date().getFullYear()).slice(-2);
  const notebookCodes = mockData.assets.map(function (item) {
    const match = item.code.match(/^NB-(\d+)$/);
    return match ? Number(match[1]) : 0;
  });
  return `NB-${Math.max(Number(`${currentYear}000`), ...notebookCodes) + 1}`;
}

function getDefaultAssetDraft() {
  const now = new Date().toISOString().slice(0, 10);
  return {
    code: getNextAssetCode(),
    name: "",
    classKey: "",
    cmdbClass: "",
    type: "",
    model: "",
    brand: "",
    serial: "",
    currentUser: "",
    status: "Pendiente",
    location: "",
    cmdbStatus: "En revisión",
    onboardingDate: now,
    observations: "",
    state: "Operativo"
  };
}

function syncAssetModelSelect(selectedBrand, selectedModel) {
  const classSelect = document.getElementById("asset-record-class");
  const modelSelect = document.getElementById("asset-record-model");

  if (!classSelect || !modelSelect) {
    return;
  }

  const classKey = classSelect.value;
  const models = getModelsByAssetClassAndBrand(classKey, selectedBrand);
  const effectiveModel = models.includes(selectedModel) ? selectedModel : (selectedModel && !models.length ? selectedModel : "");

  modelSelect.innerHTML = [`<option value="">Selecciona un modelo</option>`].concat(models.map(function (item) {
    return `<option value="${item}">${item}</option>`;
  })).join("");
  modelSelect.disabled = !selectedBrand;
  modelSelect.value = effectiveModel || "";
}

function syncAssetBrandSelect(selectedClassKey, selectedBrand) {
  const brandSelect = document.getElementById("asset-record-brand");

  if (!brandSelect) {
    return;
  }

  const brands = getBrandsByAssetClass(selectedClassKey);
  const effectiveBrand = brands.includes(selectedBrand) ? selectedBrand : "";

  brandSelect.innerHTML = [`<option value="">Selecciona una marca</option>`].concat(brands.map(function (item) {
    return `<option value="${item}">${item}</option>`;
  })).join("");
  brandSelect.disabled = !selectedClassKey;
  brandSelect.value = effectiveBrand;
  syncAssetModelSelect(effectiveBrand, "");
}

function populateAssetRecordSelects(record) {
  const classSelect = document.getElementById("asset-record-class");
  const brandSelect = document.getElementById("asset-record-brand");
  const locationSelect = document.getElementById("asset-record-location");
  const statusSelect = document.getElementById("asset-record-status");
  const cmdbStatusSelect = document.getElementById("asset-record-cmdb-status");
  const stateSelect = document.getElementById("asset-record-state");
  const classes = getCmdbAssetClasses();
  const locations = [...new Set(ASSET_LOCATIONS.concat(mockData.assets.map(function (asset) { return asset.location; })))].filter(Boolean);
  const statuses = [...new Set(mockData.assets.map(function (asset) { return asset.status; }).concat(["Pendiente"]))];
  const cmdbStatuses = [...new Set(mockData.assets.map(function (asset) { return asset.cmdbStatus; }).concat(["En revisión"]))];
  const states = [...new Set(mockData.assets.map(function (asset) { return asset.state; }).concat(["Operativo"]))];

  if (classSelect) {
    classSelect.innerHTML = [`<option value="">Selecciona una clase</option>`].concat(classes.map(function (item) {
      return `<option value="${item.classKey}">${item.cmdbClass}</option>`;
    })).join("");
    classSelect.value = record.classKey || "";
  }

  if (brandSelect) {
    syncAssetBrandSelect(record.classKey || "", record.brand || "");
    brandSelect.value = record.brand || "";
    syncAssetModelSelect(brandSelect.value, record.model || "");
  }

  if (locationSelect) {
    locationSelect.innerHTML = [`<option value="">Selecciona una locación</option>`].concat(locations.map(function (item) {
      return `<option value="${item}">${item}</option>`;
    })).join("");
    locationSelect.value = record.location || "";
  }

  if (statusSelect) {
    statusSelect.innerHTML = statuses.map(function (item) {
      return `<option value="${item}">${item}</option>`;
    }).join("");
    statusSelect.value = record.status || statuses[0] || "";
  }

  if (cmdbStatusSelect) {
    cmdbStatusSelect.innerHTML = cmdbStatuses.map(function (item) {
      return `<option value="${item}">${item}</option>`;
    }).join("");
    cmdbStatusSelect.value = record.cmdbStatus || cmdbStatuses[0] || "";
  }

  if (stateSelect) {
    stateSelect.innerHTML = states.map(function (item) {
      return `<option value="${item}">${item}</option>`;
    }).join("");
    stateSelect.value = record.state || states[0] || "";
  }
}

function renderAssetsTable(items) {
  const body = document.getElementById("assets-table-body");
  const actionLabel = getModuleActionLabel("assets");
  body.innerHTML = items.map(function (asset) {
    return `
      <tr>
        <td>${asset.code}</td>
        <td>${asset.cmdbClass || getCmdbClassLabel(asset.classKey)}</td>
        <td>${asset.brand}</td>
        <td>${asset.model}</td>
        <td>${asset.serial}</td>
        <td>${asset.currentUser}</td>
        <td>${createStatusBadge(asset.status)}</td>
        <td><button class="btn btn-secondary js-asset-detail" type="button" data-asset-id="${asset.id}">${actionLabel}</button></td>
      </tr>
    `;
  }).join("");
}

function renderAssetHistory(assetId, targetId) {
  const asset = mockData.assets.find(function (item) { return item.id === assetId; }) || null;
  const history = asset ? (mockData.assetHistory[asset.id] || []) : [];
  const historyBody = document.getElementById(targetId);
  if (!historyBody) {
    return;
  }
  historyBody.innerHTML = history.length ? history.map(function (item) {
    return `
      <tr>
        <td>${item.date}</td>
        <td>${item.movement}</td>
        <td>${item.from}</td>
        <td>${item.to}</td>
        <td>${item.previous}</td>
        <td>${item.next}</td>
        <td>${item.document}</td>
        <td>${item.operator}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="8"><div class="empty-state">Sin movimientos registrados.</div></td></tr>`;
}

function renderAssetWorkspace(assetId, mode) {
  const isCreateMode = mode === "create";
  const record = isCreateMode
    ? getDefaultAssetDraft()
    : (mockData.assets.find(function (item) { return item.id === assetId; }) || mockData.assets[0]);
  const title = document.getElementById("assets-page-title");
  const description = document.getElementById("assets-page-description");
  const saveButton = document.getElementById("assets-save-button");

  if (!record) {
    return;
  }

  currentAssetWorkspaceId = isCreateMode ? null : record.id;
  currentAssetWorkspaceMode = isCreateMode ? "create" : "edit";

  if (title) {
    title.textContent = isCreateMode ? "Nuevo activo" : `Editar ${record.code}`;
  }

  if (description) {
    description.textContent = isCreateMode
      ? "Carga la ficha principal del activo y registra su contexto inicial sin salir del módulo."
      : "Actualiza la ficha CMDB y revisa su historial operativo desde esta página.";
  }

  if (saveButton) {
    saveButton.textContent = isCreateMode ? "Guardar activo" : "Guardar cambios";
  }

  document.getElementById("asset-record-code").value = record.code || "";
  document.getElementById("asset-record-serial").value = record.serial || "";
  document.getElementById("asset-record-onboarding-date").value = record.onboardingDate || "";
  document.getElementById("asset-record-current-user").value = record.currentUser || "";
  document.getElementById("asset-record-observations").value = record.observations || "";
  populateAssetRecordSelects(record);
  renderAssetHistory(record.id, "asset-workspace-history-body");
}

function renderAssetsOverview() {
  const kpiGrid = document.getElementById("assets-kpi-grid");
  const total = mockData.assets.length;
  const assigned = mockData.assets.filter(function (item) { return item.status === "Asignado"; }).length;
  const inLab = mockData.assets.filter(function (item) { return item.status === "Laboratorio"; }).length;
  const pending = mockData.assets.filter(function (item) { return item.status === "Pendiente"; }).length;

  kpiGrid.innerHTML = [
    { label: "Activos visibles", value: total, helper: "Inventario cargado", tone: "info" },
    { label: "Asignados", value: assigned, helper: "En uso actual", tone: "success" },
    { label: "En laboratorio", value: inLab, helper: "Con revisión técnica", tone: "warning" },
    { label: "Pendientes", value: pending, helper: "Con acción operativa", tone: "danger" }
  ].map(function (item) {
    return `
      <article class="kpi-card">
        <p class="eyebrow">${item.label}</p>
        <strong>${item.value}</strong>
        <span class="badge badge-${item.tone}">${item.helper}</span>
      </article>
    `;
  }).join("");
}

function filterAssets() {
  const hostname = document.getElementById("asset-filter-hostname").value.toLowerCase();
  const cmdbClass = document.getElementById("asset-filter-class").value;
  const brand = document.getElementById("asset-filter-brand").value;
  const model = document.getElementById("asset-filter-model").value;
  const serial = document.getElementById("asset-filter-serial").value.toLowerCase();
  const status = document.getElementById("asset-filter-status").value;

  const filtered = mockData.assets.filter(function (asset) {
    return (!hostname || asset.code.toLowerCase().includes(hostname) || String(asset.name || "").toLowerCase().includes(hostname))
      && (!brand || asset.brand === brand)
      && (!model || asset.model === model)
      && (!serial || asset.serial.toLowerCase().includes(serial))
      && (!cmdbClass || (asset.cmdbClass || getCmdbClassLabel(asset.classKey)) === cmdbClass)
      && (!status || asset.status === status);
  });

  renderAssetsTable(filtered);
}

function renderDevices() {
  const kpiGrid = document.getElementById("devices-kpi-grid");
  const body = document.getElementById("devices-table-body");
  const linkButton = document.getElementById("devices-link-button");

  if (!kpiGrid || !body) {
    return;
  }

  if (linkButton) {
    linkButton.disabled = !canWriteAppModule("devices");
    linkButton.classList.toggle("is-hidden", !canWriteAppModule("devices"));
  }

  const pendingSync = mobileDevices.filter(function (item) {
    return item.lastSyncAt === "Pendiente";
  }).length;
  const lastSyncedDevice = mobileDevices.find(function (item) {
    return item.lastSyncAt !== "Pendiente";
  });

  kpiGrid.innerHTML = [
    { label: "Vinculadas", value: mobileDevices.length, helper: "Tablets activas", tone: "info" },
    { label: "Android", value: mobileDevices.length, helper: "Base definida", tone: "success" },
    { label: "Pendientes", value: pendingSync, helper: "Sin sincronizar", tone: "warning" },
    { label: "Ultima actividad", value: lastSyncedDevice ? lastSyncedDevice.code : "N/A", helper: lastSyncedDevice ? lastSyncedDevice.lastSyncAt : "Sin registros", tone: "info" }
  ].map(function (item) {
    return `
      <article class="kpi-card">
        <p class="eyebrow">${item.label}</p>
        <strong>${item.value}</strong>
        <span class="badge badge-${item.tone}">${item.helper}</span>
      </article>
    `;
  }).join("");

  body.innerHTML = mobileDevices.length ? mobileDevices.map(function (device) {
    const actionDisabled = canWriteAppModule("devices") ? "" : "disabled";
    return `
      <tr>
        <td>${escapeHtml(device.name)}</td>
        <td>${escapeHtml(device.code)}</td>
        <td>${escapeHtml(device.registeredAt)}</td>
        <td>${escapeHtml(device.lastSyncAt)}</td>
        <td><span class="badge badge-info">${escapeHtml(device.platform)}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary js-device-sync" type="button" data-device-id="${device.id}" ${actionDisabled}>Sincronizar</button>
            <button class="btn btn-secondary js-device-remove" type="button" data-device-id="${device.id}" ${actionDisabled}>Remover</button>
          </div>
        </td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="6"><div class="empty-state">No hay tablets vinculadas por ahora.</div></td></tr>`;
}

function setupDevicesModule() {
  const linkButton = document.getElementById("devices-link-button");
  const tableBody = document.getElementById("devices-table-body");
  const modal = document.getElementById("devices-link-modal");
  const closeButton = document.getElementById("devices-link-modal-close");
  const cancelButton = document.getElementById("devices-link-cancel");
  const confirmButton = document.getElementById("devices-link-confirm");
  const feedback = document.getElementById("devices-link-feedback");
  const nameField = document.getElementById("devices-name-field");
  const nameInput = document.getElementById("devices-name-input");
  const codeInputs = Array.from(document.querySelectorAll(".device-code-input"));
  let pendingRegistrationCode = "";
  let syncTimeoutId = null;
  let modalStep = "code";

  if (!linkButton || !tableBody || !modal || !closeButton || !cancelButton || !confirmButton || !feedback || !nameField || !nameInput || !codeInputs.length) {
    return;
  }

  function resetModal() {
    if (syncTimeoutId) {
      window.clearTimeout(syncTimeoutId);
      syncTimeoutId = null;
    }

    modalStep = "code";
    pendingRegistrationCode = "";
    feedback.textContent = "";
    feedback.classList.remove("is-success");
    nameField.classList.add("is-reserved");
    nameInput.value = "";
    codeInputs.forEach(function (input) {
      input.value = "";
      input.readOnly = false;
    });
    cancelButton.disabled = false;
    confirmButton.disabled = false;
    confirmButton.textContent = "Aceptar";
  }

  function openModal() {
    resetModal();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    codeInputs[0].focus();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    resetModal();
  }

  function getRegistrationCode() {
    return codeInputs.map(function (input) {
      return input.value.trim();
    }).join("");
  }

  function getSuggestedDeviceName() {
    return `Tablet Android ${String(getNextDeviceSequence()).padStart(2, "0")}`;
  }

  linkButton.addEventListener("click", function () {
    if (!canWriteAppModule("devices")) {
      return;
    }

    openModal();
  });

  codeInputs.forEach(function (input, index) {
    input.addEventListener("input", function () {
      if (input.readOnly) {
        return;
      }

      const numericValue = input.value.replace(/\D/g, "").slice(0, 1);
      input.value = numericValue;
      feedback.textContent = "";
      feedback.classList.remove("is-success");

      if (numericValue && codeInputs[index + 1]) {
        codeInputs[index + 1].focus();
        codeInputs[index + 1].select();
      }
    });

    input.addEventListener("keydown", function (event) {
      if (input.readOnly && event.key !== "Tab") {
        event.preventDefault();
        return;
      }

      if (event.key === "Backspace" && !input.value && codeInputs[index - 1]) {
        codeInputs[index - 1].focus();
      }

      if (event.key === "ArrowLeft" && codeInputs[index - 1]) {
        codeInputs[index - 1].focus();
      }

      if (event.key === "ArrowRight" && codeInputs[index + 1]) {
        codeInputs[index + 1].focus();
      }
    });

    input.addEventListener("paste", function (event) {
      if (input.readOnly) {
        event.preventDefault();
        return;
      }

      const pastedValue = (event.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6);
      if (!pastedValue) {
        return;
      }

      event.preventDefault();
      codeInputs.forEach(function (field, fieldIndex) {
        field.value = pastedValue[fieldIndex] || "";
      });

      const lastIndex = Math.min(pastedValue.length - 1, codeInputs.length - 1);
      codeInputs[lastIndex].focus();
    });
  });

  confirmButton.addEventListener("click", function () {
    if (modalStep === "name") {
      const deviceName = nameInput.value.trim();

      if (!deviceName) {
        feedback.textContent = "Asigna un nombre a la tablet antes de registrarla.";
        feedback.classList.remove("is-success");
        nameInput.focus();
        return;
      }

      mobileDevices.unshift(createDeviceFromRegistrationCode(pendingRegistrationCode, deviceName));
      renderDevices();
      closeModal();
      return;
    }

    const registrationCode = getRegistrationCode();

    if (!/^\d{6}$/.test(registrationCode)) {
      feedback.textContent = "Ingresa los 6 digitos del codigo para continuar.";
      feedback.classList.remove("is-success");
      return;
    }

    if (mobileDevices.some(function (device) { return device.registrationCode === registrationCode; })) {
      feedback.textContent = "Ese codigo ya fue utilizado por otra tablet vinculada.";
      feedback.classList.remove("is-success");
      return;
    }

    pendingRegistrationCode = registrationCode;
    modalStep = "sync";
    confirmButton.disabled = true;
    cancelButton.disabled = true;
    codeInputs.forEach(function (input) {
      input.readOnly = true;
    });
    feedback.textContent = "Sincronizando con la tablet...";
    feedback.classList.add("is-success");

    syncTimeoutId = window.setTimeout(function () {
      syncTimeoutId = null;
      modalStep = "name";
      nameField.classList.remove("is-reserved");
      nameInput.value = getSuggestedDeviceName();
      feedback.textContent = `Sincronizacion completada para el codigo ${pendingRegistrationCode}.`;
      confirmButton.disabled = false;
      confirmButton.textContent = "Registrar tablet";
      cancelButton.disabled = false;
      nameInput.focus();
      nameInput.select();
    }, 1200);
  });

  closeButton.addEventListener("click", closeModal);
  cancelButton.addEventListener("click", closeModal);
  modal.addEventListener("click", function (event) {
    if (event.target.dataset.closeDevicesLinkModal === "true") {
      closeModal();
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  tableBody.addEventListener("click", function (event) {
    const syncButton = event.target.closest(".js-device-sync");
    const removeButton = event.target.closest(".js-device-remove");

    if (syncButton && canWriteAppModule("devices")) {
      mobileDevices = mobileDevices.map(function (device) {
        if (device.id !== syncButton.dataset.deviceId) {
          return device;
        }

        return Object.assign({}, device, {
          lastSyncAt: formatDeviceTimestamp(new Date())
        });
      });
      renderDevices();
      return;
    }

    if (removeButton && canWriteAppModule("devices")) {
      mobileDevices = mobileDevices.filter(function (device) {
        return device.id !== removeButton.dataset.deviceId;
      });
      renderDevices();
    }
  });
}

function renderPeople() {
  const kpiGrid = document.getElementById("people-kpi-grid");
  const total = mockData.users.length;
  const active = mockData.users.filter(function (item) { return item.status === "Activo"; }).length;
  const withAssets = mockData.users.filter(function (item) { return item.currentAssets.length > 0; }).length;
  const withoutAssets = mockData.users.filter(function (item) { return item.currentAssets.length === 0; }).length;

  kpiGrid.innerHTML = [
    { label: "Personas visibles", value: total, helper: "Base consultable", tone: "info" },
    { label: "Activas", value: active, helper: "Con vínculo vigente", tone: "success" },
    { label: "Con activos", value: withAssets, helper: "Asignación actual", tone: "info" },
    { label: "Sin activos", value: withoutAssets, helper: "Para revisión", tone: "warning" }
  ].map(function (item) {
    return `
      <article class="kpi-card">
        <p class="eyebrow">${item.label}</p>
        <strong>${item.value}</strong>
        <span class="badge badge-${item.tone}">${item.helper}</span>
      </article>
    `;
  }).join("");

  renderPeopleFilters();
  renderUsersTable(mockData.users);
}

function renderPeopleFilters() {
  const areaSelect = document.getElementById("people-filter-area");
  const statusSelect = document.getElementById("people-filter-status");
  const currentArea = areaSelect.value;
  const currentStatus = statusSelect.value;
  const areas = [...new Set(mockData.users.map(function (item) { return item.area; }))];
  const statuses = [...new Set(mockData.users.map(function (item) { return item.status; }))];

  areaSelect.innerHTML = `<option value="">Todas</option>${areas.map(function (item) {
    return `<option value="${item}">${item}</option>`;
  }).join("")}`;

  statusSelect.innerHTML = `<option value="">Todos</option>${statuses.map(function (item) {
    return `<option value="${item}">${item}</option>`;
  }).join("")}`;

  if (areas.includes(currentArea) || currentArea === "") {
    areaSelect.value = currentArea;
  }

  if (statuses.includes(currentStatus) || currentStatus === "") {
    statusSelect.value = currentStatus;
  }
}

function renderUsersTable(items) {
  const body = document.getElementById("users-table-body");
  body.innerHTML = items.map(function (user) {
    return `
      <tr>
        <td>${user.name}</td>
        <td>${user.identifier}</td>
        <td>${user.email}</td>
        <td>${user.area}</td>
        <td>${user.role}</td>
        <td>${user.location}</td>
        <td>${user.currentAssets.length}</td>
        <td><button class="btn btn-secondary js-user-detail" type="button" data-user-id="${user.id}">Ver detalle</button></td>
      </tr>
    `;
  }).join("");
}

function filterPeople() {
  const name = document.getElementById("people-filter-name").value.toLowerCase();
  const email = document.getElementById("people-filter-email").value.toLowerCase();
  const area = document.getElementById("people-filter-area").value;
  const status = document.getElementById("people-filter-status").value;

  const filtered = mockData.users.filter(function (item) {
    return (!name || item.name.toLowerCase().includes(name) || item.identifier.toLowerCase().includes(name))
      && (!email || item.email.toLowerCase().includes(email))
      && (!area || item.area === area)
      && (!status || item.status === status);
  });

  renderUsersTable(filtered);
}

function renderPeopleDetail(userId) {
  const user = mockData.users.find(function (item) { return item.id === userId; }) || mockData.users[0];
  const title = document.getElementById("people-page-title");
  const description = document.getElementById("people-page-description");

  if (title) {
    title.textContent = user.name;
  }

  if (description) {
    description.textContent = user.currentAssets.length
      ? `${user.area} · ${user.role} · ${user.currentAssets.length} activo(s) asignado(s) actualmente.`
      : `${user.area} · ${user.role} · Sin activos asignados actualmente.`;
  }

  renderDetailGrid("people-detail-panel", [
    { label: "Nombre", value: user.name },
    { label: "Identificador", value: user.identifier },
    { label: "Área", value: user.area },
    { label: "Cargo", value: user.role },
    { label: "Jefatura", value: user.manager },
    { label: "Ubicación", value: user.location },
    { label: "Correo", value: user.email },
    { label: "Estado / ingreso", value: `${user.status} · ${user.hireDate}` }
  ]);

  const currentAssetsBody = document.getElementById("people-current-assets-body");
  currentAssetsBody.innerHTML = user.currentAssets.length ? user.currentAssets.map(function (asset) {
    return `
      <tr>
        <td>${asset.code}</td>
        <td>${asset.name}</td>
        <td>${asset.type}</td>
        <td>${asset.model}</td>
        <td>${asset.assignedDate}</td>
        <td>${createStatusBadge(asset.status)}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="6"><div class="empty-state">La persona no posee equipos asignados actualmente.</div></td></tr>`;

  const historyBody = document.getElementById("people-history-body");
  historyBody.innerHTML = user.history.map(function (item) {
    return `
      <tr>
        <td>${item.asset}</td>
        <td>${item.type}</td>
        <td>${item.assignedDate}</td>
        <td>${item.removedDate}</td>
        <td>${item.reason}</td>
        <td>${item.movementStatus}</td>
        <td>${item.reference}</td>
      </tr>
    `;
  }).join("");
}

function renderSystemUsers() {
  const kpiGrid = document.getElementById("system-users-kpi-grid");
  const total = mockData.systemUsers.length;
  const active = mockData.systemUsers.filter(function (item) { return item.status === "Activo"; }).length;
  const blocked = mockData.systemUsers.filter(function (item) { return item.status === "Bloqueado"; }).length;
  const roles = new Set(mockData.systemUsers.map(function (item) { return item.role; })).size;

  kpiGrid.innerHTML = [
    { label: "Cuentas del sistema", value: total, helper: "Usuarios registrados", tone: "info" },
    { label: "Activas", value: active, helper: "Con acceso vigente", tone: "success" },
    { label: "Bloqueadas", value: blocked, helper: "Requieren revisión", tone: "warning" },
    { label: "Roles activos", value: roles, helper: "Perfiles configurados", tone: "info" }
  ].map(function (item) {
    return `
      <article class="kpi-card">
        <p class="eyebrow">${item.label}</p>
        <strong>${item.value}</strong>
        <span class="badge badge-${item.tone}">${item.helper}</span>
      </article>
    `;
  }).join("");

  renderSystemUserFilters();
  renderSystemUsersTable(mockData.systemUsers);
}

function renderSystemUserFilters() {
  const roleSelect = document.getElementById("system-user-filter-role");
  const statusSelect = document.getElementById("system-user-filter-status");
  const statuses = [...new Set(mockData.systemUsers.map(function (item) { return item.status; }))];

  roleSelect.innerHTML = `<option value="">Todos</option>${SYSTEM_USER_ROLES.map(function (item) {
    return `<option value="${item}">${item}</option>`;
  }).join("")}`;

  statusSelect.innerHTML = `<option value="">Todos</option>${statuses.map(function (item) {
    return `<option value="${item}">${item}</option>`;
  }).join("")}`;
}

function renderSystemUsersTable(items) {
  const body = document.getElementById("system-users-table-body");
  const actionLabel = getModuleActionLabel("users");
  body.innerHTML = items.map(function (item) {
    return `
      <tr>
        <td>${item.name}</td>
        <td>${item.email}</td>
        <td>${item.role}</td>
        <td>${createStatusBadge(item.status)}</td>
        <td><button class="btn btn-secondary js-system-user-detail" type="button" data-system-user-id="${item.id}">${actionLabel}</button></td>
      </tr>
    `;
  }).join("");
}

function renderSystemUserDetail(userId) {
  const user = mockData.systemUsers.find(function (item) { return item.id === userId; }) || mockData.systemUsers[0];
  const title = document.getElementById("system-users-page-title");
  const description = document.getElementById("system-users-page-description");
  const formTitle = document.getElementById("system-users-form-title");

  if (title) {
    title.textContent = "Editar usuario";
  }

  if (description) {
    description.textContent = `${user.role} · Estado ${user.status.toLowerCase()}.`;
  }

  if (formTitle) {
    formTitle.textContent = `Edición de ${user.username}`;
  }

  populateSystemUserFormSelects();
  populateSystemUserForm(user);
}

function populateSystemUserFormSelects() {
  const roleSelect = document.getElementById("system-user-record-role");
  const statusSelect = document.getElementById("system-user-record-status");
  const statuses = [...new Set(mockData.systemUsers.map(function (item) { return item.status; }))];

  if (roleSelect) {
    roleSelect.innerHTML = SYSTEM_USER_ROLES.map(function (item) {
      return `<option value="${item}">${item}</option>`;
    }).join("");
  }

  if (statusSelect) {
    statusSelect.innerHTML = statuses.map(function (item) {
      return `<option value="${item}">${item}</option>`;
    }).join("");
  }
}

function populateSystemUserForm(record) {
  document.getElementById("system-user-record-username").value = record.username || "";
  document.getElementById("system-user-record-api-code").value = record.apiCode || "";
  document.getElementById("system-user-record-name").value = record.name || "";
  document.getElementById("system-user-record-email").value = record.email || "";
  document.getElementById("system-user-record-role").value = record.role || SYSTEM_USER_ROLES[0];
  document.getElementById("system-user-record-status").value = record.status || "Activo";
}

function getDefaultSystemUserDraft() {
  return {
    username: "",
    apiCode: "",
    name: "",
    email: "",
    role: "Soporte General",
    status: "Activo"
  };
}

function filterSystemUsers() {
  const name = document.getElementById("system-user-filter-name").value.toLowerCase();
  const email = document.getElementById("system-user-filter-email").value.toLowerCase();
  const role = document.getElementById("system-user-filter-role").value;
  const status = document.getElementById("system-user-filter-status").value;

  const filtered = mockData.systemUsers.filter(function (item) {
    return (!name || item.username.toLowerCase().includes(name) || item.name.toLowerCase().includes(name))
      && (!email || item.email.toLowerCase().includes(email))
      && (!role || item.role === role)
      && (!status || item.status === status);
  });

  renderSystemUsersTable(filtered);
}

function setupSystemUsersWorkspace() {
  const workspace = document.getElementById("system-users-workspace");
  const listPanel = document.getElementById("system-users-list-panel");
  const filtersPanel = document.getElementById("system-users-filters-panel");
  const stats = document.getElementById("system-users-kpi-grid");
  const backButton = document.getElementById("system-users-back-button");
  const createButton = document.getElementById("system-user-create-button");
  const saveButton = document.getElementById("system-users-save-button");
  const formArticle = document.getElementById("system-users-form-article");
  const formTitle = document.getElementById("system-users-form-title");
  let currentSystemUserWorkspaceId = null;
  let currentSystemUserWorkspaceMode = "create";

  function showDetailMode(userId) {
    currentSystemUserWorkspaceId = userId;
    currentSystemUserWorkspaceMode = "edit";
    renderSystemUserDetail(userId);
    formArticle.classList.remove("is-hidden");
    saveButton.textContent = "Guardar cambios";
  }

  function showCreateMode() {
    const title = document.getElementById("system-users-page-title");
    const description = document.getElementById("system-users-page-description");
    currentSystemUserWorkspaceId = null;
    currentSystemUserWorkspaceMode = "create";
    if (title) {
      title.textContent = "Nuevo usuario";
    }
    if (description) {
      description.textContent = "Crea una nueva cuenta de acceso para operación y administración.";
    }
    if (formTitle) {
      formTitle.textContent = "Nuevo usuario del sistema";
    }
    populateSystemUserFormSelects();
    populateSystemUserForm(getDefaultSystemUserDraft());
    formArticle.classList.remove("is-hidden");
    saveButton.textContent = "Guardar usuario";
  }

  function openWorkspace() {
    workspace.classList.add("is-active");
    listPanel.classList.add("is-hidden");
    filtersPanel.classList.add("is-hidden");
    stats.classList.add("is-hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeWorkspace() {
    workspace.classList.remove("is-active");
    listPanel.classList.remove("is-hidden");
    filtersPanel.classList.remove("is-hidden");
    stats.classList.remove("is-hidden");
  }

  document.addEventListener("click", function (event) {
    const detailButton = event.target.closest(".js-system-user-detail");

    if (detailButton) {
      if (!canViewAppModule("users")) {
        activateView("dashboard");
        return;
      }
      showDetailMode(detailButton.dataset.systemUserId);
      openWorkspace();
    }
  });

  if (backButton) {
    backButton.addEventListener("click", closeWorkspace);
  }

  if (createButton) {
    createButton.addEventListener("click", function () {
      if (!canWriteAppModule("users")) {
        return;
      }
      showCreateMode();
      openWorkspace();
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", function () {
      if (!canWriteAppModule("users")) {
        return;
      }

      const payload = {
        username: document.getElementById("system-user-record-username").value.trim(),
        apiCode: document.getElementById("system-user-record-api-code").value.trim(),
        name: document.getElementById("system-user-record-name").value.trim(),
        email: document.getElementById("system-user-record-email").value.trim(),
        role: document.getElementById("system-user-record-role").value.trim(),
        status: document.getElementById("system-user-record-status").value
      };

      if (!payload.username || !payload.name || !payload.email) {
        return;
      }

      if (currentSystemUserWorkspaceMode === "edit" && currentSystemUserWorkspaceId) {
        const existing = mockData.systemUsers.find(function (item) { return item.id === currentSystemUserWorkspaceId; });
        if (!existing) {
          return;
        }

        Object.assign(existing, payload);
      } else {
        mockData.systemUsers.unshift(Object.assign({ id: "sys-" + Date.now() }, payload));
      }

      renderSystemUsers();
      refreshCurrentUserSelector();
      filterSystemUsers();
      closeWorkspace();
    });
  }
}

function renderReports() {
  const kpiGrid = document.getElementById("reports-kpi-grid");
  const total = mockData.reports.length;
  const scheduled = mockData.reports.filter(function (item) { return item.frequency !== "Bajo demanda"; }).length;
  const exportable = mockData.reports.length;
  const categories = new Set(mockData.reports.map(function (item) { return item.category; })).size;

  kpiGrid.innerHTML = [
    { label: "Informes disponibles", value: total, helper: "Catálogo operativo", tone: "info" },
    { label: "Programables", value: scheduled, helper: "Con frecuencia definida", tone: "success" },
    { label: "Exportables", value: exportable, helper: "Listado exportable", tone: "warning" },
    { label: "Categorías", value: categories, helper: "Cobertura analítica", tone: "info" }
  ].map(function (item) {
    return `
      <article class="kpi-card">
        <p class="eyebrow">${item.label}</p>
        <strong>${item.value}</strong>
        <span class="badge badge-${item.tone}">${item.helper}</span>
      </article>
    `;
  }).join("");

  renderReportsGrid(mockData.reports);
  renderReportDetail(mockData.reports[0].id);
}

function renderReportsGrid(items) {
  const grid = document.getElementById("reports-grid");
  const categoryOrder = ["Inventario", "Asignación", "Movimientos", "Laboratorio", "Documental", "Renovación", "Calidad CMDB"];
  const grouped = items.reduce(function (acc, item) {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  grid.innerHTML = categoryOrder.filter(function (category) {
    return grouped[category] && grouped[category].length;
  }).map(function (category, index) {
    const isCollapsed = index !== 0;
    const cards = grouped[category].map(function (item) {
      return `
        <article class="report-card">
          <div class="report-card-header">
            <div>
              <h4>${item.name}</h4>
            </div>
          </div>
          <p>${item.description}</p>
          <div class="report-actions">
            <button class="btn btn-primary js-report-open" type="button" data-report-id="${item.id}">Ver informe</button>
          </div>
        </article>
      `;
    }).join("");

    return `
      <section class="report-category">
        <div class="report-category-header">
          <div>
            <p class="eyebrow">Categoría</p>
            <h3>${category}</h3>
          </div>
          <button class="report-toggle-button js-report-category-toggle ${isCollapsed ? "is-collapsed" : ""}" type="button" data-category="${category}" title="${isCollapsed ? "Expandir categoria" : "Colapsar categoria"}" aria-label="${isCollapsed ? "Expandir categoria" : "Colapsar categoria"}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 10l5 5 5-5" />
            </svg>
          </button>
        </div>
        <div class="report-category-grid ${isCollapsed ? "is-collapsed" : ""}" data-category-grid="${category}">
          ${cards}
        </div>
      </section>
    `;
  }).join("");
}

function renderReportDetail(reportId) {
  const report = mockData.reports.find(function (item) { return item.id === reportId; }) || mockData.reports[0];
  const exportButton = document.getElementById("report-export-button");
  const resultContent = document.getElementById("report-result-content");
  const resultToggle = document.getElementById("report-result-toggle");
  document.getElementById("report-page-title").textContent = report.name;
  document.getElementById("report-page-description").textContent = report.description;

  const form = document.getElementById("report-parameters-form");
  const parameterCount = report.parameters.length;
  const useThreeColumns = parameterCount === 3;
  const useTwoColumns = !useThreeColumns && parameterCount % 2 === 0;

  form.className = "form-grid";
  if (useThreeColumns) {
    form.classList.add("three-columns");
  } else if (useTwoColumns) {
    form.classList.add("two-columns");
  }

  form.innerHTML = report.parameters.map(function (param) {
    if (param.type === "select") {
      return `
        <label class="field">
          <span>${param.label}</span>
          <select data-report-param="${param.key}">
            ${param.options.map(function (option) { return `<option>${option}</option>`; }).join("")}
          </select>
        </label>
      `;
    }

    if (param.type === "date") {
      return `
        <label class="field">
          <span>${param.label}</span>
          <input data-report-param="${param.key}" type="date">
        </label>
      `;
    }

    return `
      <label class="field">
        <span>${param.label}</span>
        <input data-report-param="${param.key}" type="search" placeholder="${param.placeholder || ""}">
      </label>
    `;
  }).join("");

  document.getElementById("report-result-empty").classList.remove("is-hidden");
  document.getElementById("report-result-table-wrap").classList.remove("is-active");
  document.getElementById("report-result-head").innerHTML = "";
  document.getElementById("report-result-body").innerHTML = "";
  exportButton.disabled = true;
  document.getElementById("report-params-content").classList.add("is-collapsed");
  document.getElementById("report-params-toggle").classList.add("is-collapsed");
  document.getElementById("report-params-toggle").title = "Expandir parametros";
  document.getElementById("report-params-toggle").setAttribute("aria-label", "Expandir parametros");
  resultContent.classList.add("is-collapsed");
  resultToggle.classList.add("is-collapsed");
  resultToggle.title = "Expandir resultados";
  resultToggle.setAttribute("aria-label", "Expandir resultados");
}

function renderReportRows(reportId) {
  const report = mockData.reports.find(function (item) { return item.id === reportId; }) || mockData.reports[0];
  const exportButton = document.getElementById("report-export-button");

  document.getElementById("report-result-head").innerHTML = report.columns.map(function (column) {
    return `<th>${column}</th>`;
  }).join("");

  document.getElementById("report-result-body").innerHTML = report.rows.map(function (row) {
    return `<tr>${row.map(function (cell) { return `<td>${cell}</td>`; }).join("")}</tr>`;
  }).join("");

  document.getElementById("report-result-empty").classList.add("is-hidden");
  document.getElementById("report-result-table-wrap").classList.add("is-active");
  exportButton.disabled = false;
  document.getElementById("report-result-content").classList.remove("is-collapsed");
  document.getElementById("report-result-toggle").classList.remove("is-collapsed");
  document.getElementById("report-result-toggle").title = "Colapsar resultados";
  document.getElementById("report-result-toggle").setAttribute("aria-label", "Colapsar resultados");
}

let currentLabWorkspaceId = null;
let currentLabWorkspaceMode = "create";
let currentLabReportNumber = "";
let currentLabAssetState = { items: [] };
let currentLabEvidenceState = { items: [] };
let currentLabEvidencePreview = null;
const LAB_ENTRY_REASONS = [
  "Falla reportada",
  "Mantenimiento",
  "Baja técnica",
  "Devolución de usuario",
  "Reasignación",
  "Garantía / proveedor",
  "Preparacion equipo Base",
  "Preparacion equipo Spare"
];
const LAB_TECHNICAL_STATUSES = [
  "Recepcionado",
  "En diagnóstico",
  "Pendiente de revisión",
  "Pendiente de repuesto",
  "En reparación",
  "Reparado",
  "Observado",
  "Marcado para cambio",
  "Listo para devolución",
  "Cerrado"
];

function getNextLabDocument() {
  const currentYear = String(new Date().getFullYear());
  const sequences = mockData.labQueue.map(function (item) {
    const match = item.reportNumber.match(/^LAB-(\d{4})-(\d+)$/);
    if (!match || match[1] !== currentYear) return 0;
    return Number(match[2]);
  });
  return `LAB-${currentYear}-${String(Math.max(0, ...sequences) + 1).padStart(4, "0")}`;
}

function getDefaultLabDraft() {
  const now = new Date();
  return {
    reportNumber: getNextLabDocument(),
    entryAt: now.toISOString().slice(0, 10),
    closedAt: "",
    technician: getLoggedInUserName(),
    status: "Recepcionado",
    receptionDocument: "",
    reason: "",
    result: "Diagnóstico emitido",
    priority: "Alta",
    description: "",
    evidence: [],
    assetCode: "",
    assetName: "",
    selectedAssets: []
  };
}

function getActiveLabChecklistDefinitions() {
  return (mockData.checklistDefinitionsByModule.lab || []).filter(function (item) { return item.status === "Activo"; });
}

function getLabChecklistDefinition(checklistId) {
  return (mockData.checklistDefinitionsByModule.lab || []).find(function (item) { return item.id === checklistId; }) || null;
}

function normalizeLabChecklistSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map(function (section) {
    return { id: section.id, collapsed: section.collapsed !== undefined ? section.collapsed : false, answers: Object.assign({}, section.answers || {}) };
  }).filter(function (section) { return !!getLabChecklistDefinition(section.id); });
}

function normalizeSelectedLabAssets(record) {
  if (record && Array.isArray(record.selectedAssets) && record.selectedAssets.length) {
    return record.selectedAssets.slice(0, 1).map(function (item) {
      const asset = mockData.assets.find(function (entry) { return entry.code === item.assetCode; }) || {};
      return { assetCode: item.assetCode, assetName: item.assetName || asset.name || "", collapsed: item.collapsed !== undefined ? item.collapsed : false, checklistSections: normalizeLabChecklistSections(item.checklistSections || []) };
    });
  }
  if (record && record.assetCode) {
    return [{ assetCode: record.assetCode, assetName: record.assetName || "", collapsed: false, checklistSections: normalizeLabChecklistSections(record.checklistSections || []) }];
  }
  return [];
}

function getLabEvidenceItemId() {
  return `lab-evidence-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getLabEvidenceKind(fileName, mimeType) {
  const normalizedName = String(fileName || "").toLowerCase();
  const normalizedMime = String(mimeType || "").toLowerCase();
  if (normalizedMime.startsWith("image/")) return "image";
  if (normalizedMime === "application/pdf" || normalizedName.endsWith(".pdf")) return "pdf";
  if (normalizedMime.includes("word") || normalizedMime.includes("officedocument.wordprocessingml") || normalizedName.endsWith(".doc") || normalizedName.endsWith(".docx")) return "word";
  return "file";
}

function getLabEvidenceIcon(kind) {
  if (kind === "pdf") return "PDF";
  if (kind === "word") return "DOC";
  return "FILE";
}

function normalizeLabEvidence(record) {
  if (!record || !Array.isArray(record.evidence)) return [];
  return record.evidence.map(function (item, index) {
    const mimeType = item.mimeType || "";
    const imageName = item.imageName || item.title || "";
    const fileData = item.fileData || item.imageData || item.imageUrl || "";
    return {
      id: item.id || `lab-evidence-${index + 1}`,
      description: item.description || item.note || "",
      fileData: fileData,
      imageData: fileData,
      imageName: imageName,
      mimeType: mimeType,
      kind: item.kind || getLabEvidenceKind(imageName, mimeType)
    };
  });
}

function processLabEvidenceFile(evidenceItem, file) {
  if (!evidenceItem || !file) return;
  const reader = new FileReader();
  reader.onload = function (loadEvent) {
    const result = typeof loadEvent.target.result === "string" ? loadEvent.target.result : "";
    evidenceItem.fileData = result;
    evidenceItem.imageData = result;
    evidenceItem.imageName = file.name;
    evidenceItem.mimeType = file.type || "";
    evidenceItem.kind = getLabEvidenceKind(file.name, file.type || "");
    renderLabEvidenceList();
  };
  reader.readAsDataURL(file);
}

function renderLabEvidenceList() {
  const container = document.getElementById("lab-evidence-list");
  if (!container) return;
  if (!currentLabEvidenceState.items.length) {
    container.innerHTML = `<div class="handover-checklist-empty">Aun no hay evidencias cargadas en este registro.</div>`;
    return;
  }
  container.innerHTML = currentLabEvidenceState.items.map(function (item, index) {
    const hasFile = !!item.fileData;
    const previewMarkup = !hasFile
      ? `<div class="lab-evidence-thumb lab-evidence-thumb-empty">Sin archivo</div>`
      : (item.kind === "image"
        ? `<button class="lab-evidence-thumb-button" type="button" data-lab-evidence-preview="true" data-evidence-id="${item.id}" aria-label="Ver preview de evidencia ${index + 1}"><img src="${item.fileData}" alt="Miniatura evidencia ${index + 1}" class="lab-evidence-thumb-image"></button>`
        : `<button class="lab-evidence-thumb-button" type="button" data-lab-evidence-preview="true" data-evidence-id="${item.id}" aria-label="Ver preview de evidencia ${index + 1}"><div class="lab-evidence-thumb lab-evidence-thumb-file"><strong>${getLabEvidenceIcon(item.kind)}</strong><span>${item.kind === "pdf" ? "Documento PDF" : item.kind === "word" ? "Documento Word" : "Archivo adjunto"}</span></div></button>`);
    const fileLabel = item.imageName ? `<p>${escapeHtml(item.imageName)}</p>` : `<p>Arrastra una imagen, PDF o Word aqui, o haz clic para seleccionarlo.</p>`;
    const previewButton = hasFile ? `<button class="btn btn-secondary js-lab-evidence-preview" type="button" data-evidence-id="${item.id}">Preview</button>` : "";
    return `<article class="handover-checklist-card"><div class="handover-checklist-card-header"><div class="handover-checklist-card-title"><strong>Evidencia ${index + 1}</strong><p>Adjunta una foto o archivo y describe el hallazgo o respaldo asociado.</p></div><div class="handover-checklist-card-actions"><button class="btn btn-secondary js-lab-evidence-remove" type="button" data-evidence-id="${item.id}">Quitar</button></div></div><div class="handover-checklist-content"><div class="form-grid two-columns"><div class="field"><span>Adjunto</span><input class="field-hidden" type="file" accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" data-lab-evidence-file="true" data-evidence-id="${item.id}"><button class="lab-evidence-dropzone" type="button" data-lab-evidence-dropzone="true" data-evidence-id="${item.id}"><strong>Adjuntar evidencia</strong>${fileLabel}</button></div><div class="field"><span>Vista previa</span><div class="lab-evidence-preview-stack">${previewMarkup}${previewButton}</div></div><label class="field field-full"><span>Descripción</span><textarea rows="3" data-lab-evidence-description="true" data-evidence-id="${item.id}" placeholder="Describe la evidencia cargada">${escapeHtml(item.description)}</textarea></label></div></div></article>`;
  }).join("");
}

function openLabEvidencePreview(evidenceId) {
  const modal = document.getElementById("lab-evidence-preview-modal");
  const title = document.getElementById("lab-evidence-preview-title");
  const lead = document.getElementById("lab-evidence-preview-lead");
  const body = document.getElementById("lab-evidence-preview-body");
  const evidenceItem = currentLabEvidenceState.items.find(function (item) { return item.id === evidenceId; });
  if (!modal || !title || !lead || !body || !evidenceItem || !evidenceItem.fileData) return;
  currentLabEvidencePreview = evidenceItem;
  title.textContent = evidenceItem.imageName || "Preview";
  lead.textContent = evidenceItem.description || "Vista previa del archivo adjunto a la evidencia.";
  if (evidenceItem.kind === "image") {
    body.innerHTML = `<img src="${evidenceItem.fileData}" alt="${escapeHtml(evidenceItem.imageName || "Evidencia")}" class="lab-evidence-modal-image">`;
  } else if (evidenceItem.kind === "pdf") {
    body.innerHTML = `<iframe src="${evidenceItem.fileData}" title="${escapeHtml(evidenceItem.imageName || "PDF")}" class="lab-evidence-modal-frame"></iframe>`;
  } else {
    body.innerHTML = `<div class="lab-evidence-modal-file"><div class="lab-evidence-thumb lab-evidence-thumb-file"><strong>${getLabEvidenceIcon(evidenceItem.kind)}</strong><span>${evidenceItem.kind === "word" ? "Documento Word" : "Archivo adjunto"}</span></div><p>Este tipo de archivo no tiene preview embebido en el mock, pero queda registrado como evidencia.</p></div>`;
  }
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function syncLabAssetCount() {
  return currentLabAssetState.items.length;
}

function renderLabAssetSelector() {
  const selector = document.getElementById("lab-record-asset");
  const addButton = document.getElementById("lab-asset-add");
  const selectedCodes = currentLabAssetState.items.map(function (item) { return item.assetCode; });
  const hasSelectedAsset = currentLabAssetState.items.length >= 1;
  const available = mockData.assets.filter(function (asset) { return !selectedCodes.includes(asset.code); });
  if (!selector) return;
  selector.innerHTML = hasSelectedAsset
    ? `<option value="">Ya hay un equipo seleccionado</option>`
    : (available.length
    ? `<option value="">Selecciona un equipo</option>${available.map(function (item) { return `<option value="${item.code}">${getAssetDisplayName(item)}</option>`; }).join("")}`
      : `<option value="">No hay equipos disponibles</option>`);
  selector.disabled = hasSelectedAsset || !available.length;
  selector.value = "";
  if (addButton) addButton.disabled = true;
}

function renderLabAssetChecklistSelector(assetItem) {
  const selectedIds = assetItem.checklistSections.map(function (section) { return section.id; });
  const available = getActiveLabChecklistDefinitions().filter(function (item) { return !selectedIds.includes(item.id); });
  return available.length
    ? `<option value="">Selecciona un checklist</option>${available.map(function (item) { return `<option value="${item.id}">${item.name}</option>`; }).join("")}`
    : `<option value="">No hay checklists disponibles</option>`;
}

function renderSelectedLabAssets() {
  const container = document.getElementById("lab-selected-assets");
  if (!container) return;
  if (!currentLabAssetState.items.length) {
    container.innerHTML = `<div class="handover-checklist-empty">Aun no hay un equipo cargado en el registro técnico.</div>`;
    renderLabAssetSelector();
    syncLabAssetCount();
    return;
  }
  container.innerHTML = currentLabAssetState.items.map(function (assetItem) {
    const asset = mockData.assets.find(function (entry) { return entry.code === assetItem.assetCode; }) || null;
    const checklistMarkup = assetItem.checklistSections.length ? assetItem.checklistSections.map(function (section) {
      const definition = getLabChecklistDefinition(section.id);
      if (!definition) return "";
      const checksMarkup = definition.checks.map(function (check, checkIndex) {
        const answer = section.answers[check.id] || "";
        let controlMarkup = "";
        if (check.type === "Check") {
          controlMarkup = `<label class="handover-check-boolean"><input type="checkbox" data-lab-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}"${answer === true ? " checked" : ""}><span>Validado</span></label>`;
        } else if (check.type === "Input text") {
          controlMarkup = `<input type="text" data-lab-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}" value="${escapeHtml(answer)}" placeholder="Completar campo">`;
        } else if (check.type === "Text area") {
          controlMarkup = `<textarea rows="4" data-lab-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}" placeholder="Completar detalle">${escapeHtml(answer)}</textarea>`;
        } else if (check.type === "Option / Radio") {
          controlMarkup = `<div class="handover-check-radio-group"><label><input type="radio" name="lab-${assetItem.assetCode}-${section.id}-${checkIndex}" value="${check.optionA}" data-lab-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}"${answer === check.optionA ? " checked" : ""}><span>${check.optionA}</span></label><label><input type="radio" name="lab-${assetItem.assetCode}-${section.id}-${checkIndex}" value="${check.optionB}" data-lab-check-input="true" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" data-check-id="${check.id}"${answer === check.optionB ? " checked" : ""}><span>${check.optionB}</span></label></div>`;
        }
        return `<div class="handover-check-item"><div class="handover-check-item-header"><strong>${check.name}</strong><p>${check.description}</p></div>${controlMarkup}</div>`;
      }).join("");
      return `<article class="handover-checklist-card"><div class="handover-checklist-card-header"><div class="handover-checklist-card-title"><strong>${definition.name}</strong><p>${definition.description}</p></div><div class="handover-checklist-card-actions"><button class="report-toggle-button ${section.collapsed ? "is-collapsed" : ""} js-lab-checklist-toggle" type="button" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}" title="${section.collapsed ? "Expandir checklist" : "Colapsar checklist"}" aria-label="${section.collapsed ? "Expandir checklist" : "Colapsar checklist"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg></button><button class="btn btn-secondary js-lab-checklist-remove" type="button" data-asset-code="${assetItem.assetCode}" data-checklist-id="${section.id}">Quitar</button></div></div><div class="handover-checklist-content ${section.collapsed ? "is-collapsed" : ""}">${checksMarkup}</div></article>`;
    }).join("") : `<div class="handover-checklist-empty">Este activo aun no tiene checklists asociados.</div>`;

    return `<article class="handover-checklist-card"><div class="handover-checklist-card-header"><div class="handover-checklist-card-title"><strong>${asset ? getAssetDisplayName(asset) : assetItem.assetCode}</strong><div class="handover-asset-meta">${asset ? `<span class="badge">${asset.model}</span>` : ""}${asset ? `<span class="badge">${asset.brand}</span>` : ""}${asset ? `<span class="badge">${asset.location}</span>` : ""}</div></div><div class="handover-checklist-card-actions"><button class="report-toggle-button ${assetItem.collapsed ? "is-collapsed" : ""} js-lab-asset-toggle" type="button" data-asset-code="${assetItem.assetCode}" title="${assetItem.collapsed ? "Expandir equipo" : "Colapsar equipo"}" aria-label="${assetItem.collapsed ? "Expandir equipo" : "Colapsar equipo"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg></button><button class="btn btn-secondary js-lab-asset-remove" type="button" data-asset-code="${assetItem.assetCode}">Quitar equipo</button></div></div><div class="handover-checklist-content ${assetItem.collapsed ? "is-collapsed" : ""}"><div class="handover-asset-checklist-toolbar"><label class="field"><span>Agregar checklist a este equipo</span><select data-lab-asset-checklist-selector="${assetItem.assetCode}">${renderLabAssetChecklistSelector(assetItem)}</select></label><button class="btn btn-secondary js-lab-asset-checklist-add" type="button" data-asset-code="${assetItem.assetCode}">Agregar checklist</button></div>${checklistMarkup}</div></article>`;
  }).join("");
  renderLabAssetSelector();
  syncLabAssetCount();
}

function renderLabQueue() {
  const kpiGrid = document.getElementById("lab-kpi-grid");
  const total = mockData.labQueue.length;
  const diagnostic = mockData.labQueue.filter(function (item) { return item.result === "Diagnóstico emitido"; }).length;
  const repair = mockData.labQueue.filter(function (item) { return item.result === "Reparación requerida"; }).length;
  const ready = mockData.labQueue.filter(function (item) { return item.result === "Listo para devolución"; }).length;
  kpiGrid.innerHTML = [
    { label: "Equipos en cola", value: total, helper: "Recepcionados", tone: "info" },
    { label: "Diagnóstico emitido", value: diagnostic, helper: "Con informe inicial", tone: "warning" },
    { label: "Reparación requerida", value: repair, helper: "Pendiente de intervención", tone: "danger" },
    { label: "Listos para devolución", value: ready, helper: "Cierre técnico", tone: "success" }
  ].map(function (item) { return `<article class="kpi-card"><p class="eyebrow">${item.label}</p><strong>${item.value}</strong><span class="badge badge-${item.tone}">${item.helper}</span></article>`; }).join("");
  renderLabFilters();
  renderLabTable(mockData.labQueue);
}

function renderLabFilters() {
  const prioritySelect = document.getElementById("lab-filter-priority");
  const statusSelect = document.getElementById("lab-filter-status");
  const priorities = [...new Set(mockData.labQueue.map(function (item) { return item.priority; }))];
  prioritySelect.innerHTML = `<option value="">Todas</option>${priorities.map(function (item) { return `<option value="${item}">${item}</option>`; }).join("")}`;
  statusSelect.innerHTML = `<option value="">Todos</option>${LAB_TECHNICAL_STATUSES.map(function (item) { return `<option value="${item}">${item}</option>`; }).join("")}`;
}

function renderLabTable(items) {
  const body = document.getElementById("lab-queue-body");
  const actionLabel = getModuleActionLabel("lab");
  body.innerHTML = items.map(function (item) {
    const selectedAssets = normalizeSelectedLabAssets(item);
    const primaryAsset = selectedAssets[0];
    const assetLabel = primaryAsset ? `${primaryAsset.assetCode} · ${primaryAsset.assetName}` : `${item.assetCode} · ${item.assetName}`;
    return `<tr><td>${item.reportNumber}</td><td>${assetLabel}</td><td>${item.reason}</td><td>${item.result}</td><td>${createStatusBadge(item.status)}</td><td>${item.technician}</td><td><button class="btn btn-secondary js-lab-detail" type="button" data-lab-id="${item.id}">${actionLabel}</button></td></tr>`;
  }).join("");
}

function renderLabDetail(labId, mode) {
  const isCreateMode = mode === "create";
  const item = isCreateMode ? getDefaultLabDraft() : (mockData.labQueue.find(function (entry) { return entry.id === labId; }) || mockData.labQueue[0]);
  const title = document.getElementById("lab-page-title");
  const description = document.getElementById("lab-page-description");
  if (!item) return;
  currentLabWorkspaceId = isCreateMode ? null : item.id;
  currentLabWorkspaceMode = isCreateMode ? "create" : "edit";
  currentLabReportNumber = item.reportNumber || "";
  title.textContent = isCreateMode ? "Nuevo registro técnico" : `Editar ${item.reportNumber}`;
  description.textContent = isCreateMode ? "Completa la metadata y el equipo del registro técnico sin salir del módulo." : "Ajusta el registro, el equipo y los checklists técnicos desde esta página.";
  document.getElementById("lab-record-entry-at").value = item.entryAt || "";
  document.getElementById("lab-record-closed-at").value = item.closedAt || "";
  document.getElementById("lab-record-owner").value = item.technician || getLoggedInUserName();
  document.getElementById("lab-record-status").value = item.status || "Recepcionado";
  document.getElementById("lab-record-reason").value = item.reason || "";
  document.getElementById("lab-record-result").value = item.result || "Diagnóstico emitido";
  document.getElementById("lab-record-description").value = item.description || "";
  currentLabAssetState = { items: normalizeSelectedLabAssets(item) };
  currentLabEvidenceState = { items: normalizeLabEvidence(item) };
  renderLabAssetSelector();
  renderSelectedLabAssets();
  renderLabEvidenceList();
  setHandoverSectionCollapse("lab-asset-section-toggle", "lab-asset-section-content", false, "Expandir equipo incluido en el registro", "Colapsar equipo incluido en el registro");
  setHandoverSectionCollapse("lab-form-toggle", "lab-form-content", !isCreateMode, "Expandir datos del registro", "Colapsar datos del registro");
}

function filterLabQueue() {
  const documentValue = document.getElementById("lab-filter-document").value.toLowerCase();
  const assetValue = document.getElementById("lab-filter-asset").value.toLowerCase();
  const priorityValue = document.getElementById("lab-filter-priority").value;
  const statusValue = document.getElementById("lab-filter-status").value;
  const filtered = mockData.labQueue.filter(function (item) {
    const selectedAssets = normalizeSelectedLabAssets(item);
    const matchesAsset = !assetValue || selectedAssets.some(function (asset) {
      return asset.assetCode.toLowerCase().includes(assetValue) || asset.assetName.toLowerCase().includes(assetValue);
    }) || item.assetCode.toLowerCase().includes(assetValue) || item.assetName.toLowerCase().includes(assetValue);
    return (!documentValue || item.receptionDocument.toLowerCase().includes(documentValue))
      && matchesAsset
      && (!priorityValue || item.priority === priorityValue)
      && (!statusValue || item.status === statusValue);
  });
  renderLabTable(filtered);
}

function renderUserDetail(userId) {
  const user = mockData.users.find(function (item) { return item.id === userId; }) || mockData.users[0];
  const title = document.getElementById("user-modal-title");

  if (title) {
    title.textContent = user.name;
  }

  renderDetailGrid("user-detail-panel", [
    { label: "Nombre", value: user.name },
    { label: "Identificador", value: user.identifier },
    { label: "Área", value: user.area },
    { label: "Cargo", value: user.role },
    { label: "Jefatura", value: user.manager },
    { label: "Ubicación", value: user.location },
    { label: "Correo", value: user.email },
    { label: "Estado / ingreso", value: `${user.status} · ${user.hireDate}` }
  ]);

  const currentAssetsBody = document.getElementById("user-current-assets-body");
  currentAssetsBody.innerHTML = user.currentAssets.length ? user.currentAssets.map(function (asset) {
    return `
      <tr>
        <td>${asset.code}</td>
        <td>${asset.name}</td>
        <td>${asset.type}</td>
        <td>${asset.model}</td>
        <td>${asset.assignedDate}</td>
        <td>${createStatusBadge(asset.status)}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="6"><div class="empty-state">El usuario no posee equipos asignados actualmente.</div></td></tr>`;

  const historyBody = document.getElementById("user-history-body");
  historyBody.innerHTML = user.history.map(function (item) {
    return `
      <tr>
        <td>${item.asset}</td>
        <td>${item.type}</td>
        <td>${item.assignedDate}</td>
        <td>${item.removedDate}</td>
        <td>${item.reason}</td>
        <td>${item.movementStatus}</td>
        <td>${item.reference}</td>
      </tr>
    `;
  }).join("");
}

function setupNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach(function (button) {
    button.addEventListener("click", function () {
      if (!canViewAppModule(button.dataset.view)) {
        activateView("dashboard");
        return;
      }
      activateView(button.dataset.view);
    });
  });
}

function setupTabs() {
  document.querySelectorAll(".tab-button").forEach(function (button) {
    button.addEventListener("click", function () {
      const target = button.dataset.tabTarget;
      const container = button.closest(".panel, .modal-dialog");

      container.querySelectorAll(".tab-button").forEach(function (item) {
        item.classList.remove("is-active");
      });

      container.querySelectorAll(".tab-panel").forEach(function (panel) {
        panel.classList.remove("is-active");
      });

      button.classList.add("is-active");
      document.getElementById(target).classList.add("is-active");
    });
  });
}

function setupSidebar() {
  const appShell = document.querySelector(".app-shell");
  const button = document.getElementById("sidebar-toggle");
  const storedState = localStorage.getItem("itophub-sidebar");

  if (storedState === "collapsed") {
    appShell.classList.add("sidebar-collapsed");
  }

  button.addEventListener("click", function () {
    appShell.classList.toggle("sidebar-collapsed");
    localStorage.setItem(
      "itophub-sidebar",
      appShell.classList.contains("sidebar-collapsed") ? "collapsed" : "expanded"
    );
  });
}

function setupBackToTop() {
  const button = document.getElementById("back-to-top");

  function toggleVisibility() {
    if (window.scrollY > 320) {
      button.classList.add("is-visible");
    } else {
      button.classList.remove("is-visible");
    }
  }

  window.addEventListener("scroll", toggleVisibility);
  toggleVisibility();

  button.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function setupBrandModal() {
  const trigger = document.getElementById("brand-trigger");
  const modal = document.getElementById("brand-modal");
  const closeButton = document.getElementById("brand-modal-close");

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  trigger.addEventListener("click", function (event) {
    if (event.target.closest("#sidebar-toggle")) {
      return;
    }
    openModal();
  });

  closeButton.addEventListener("click", closeModal);

  modal.addEventListener("click", function (event) {
    if (event.target.dataset.closeModal === "true") {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });
}

function setupUserModal() {
  const modal = document.getElementById("user-modal");
  const closeButton = document.getElementById("user-modal-close");

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  document.addEventListener("click", function (event) {
    const userButton = event.target.closest(".js-user-detail");

    if (userButton) {
      renderUserDetail(userButton.dataset.userId);
      openModal();
    }
  });

  closeButton.addEventListener("click", closeModal);

  modal.addEventListener("click", function (event) {
    if (event.target.dataset.closeUserModal === "true") {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });
}

function setupPeopleWorkspace() {
  const workspace = document.getElementById("people-workspace");
  const listPanel = document.getElementById("people-list-panel");
  const filtersPanel = document.getElementById("people-filters-panel");
  const stats = document.getElementById("people-kpi-grid");
  const backButton = document.getElementById("people-back-button");

  function openWorkspace(userId) {
    renderPeopleDetail(userId);
    workspace.classList.add("is-active");
    listPanel.classList.add("is-hidden");
    filtersPanel.classList.add("is-hidden");
    stats.classList.add("is-hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeWorkspace() {
    workspace.classList.remove("is-active");
    listPanel.classList.remove("is-hidden");
    filtersPanel.classList.remove("is-hidden");
    stats.classList.remove("is-hidden");
  }

  document.addEventListener("click", function (event) {
    const detailButton = event.target.closest(".js-user-detail");

    if (detailButton) {
      openWorkspace(detailButton.dataset.userId);
    }
  });

  if (backButton) {
    backButton.addEventListener("click", closeWorkspace);
  }
}

function setupSystemUserModal() {
  const modal = document.getElementById("system-user-modal");
  const closeButton = document.getElementById("system-user-modal-close");

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  document.addEventListener("click", function (event) {
    const button = event.target.closest(".js-system-user-detail");

    if (button) {
      renderSystemUserDetail(button.dataset.systemUserId);
      openModal();
    }
  });

  closeButton.addEventListener("click", closeModal);

  modal.addEventListener("click", function (event) {
    if (event.target.dataset.closeSystemUserModal === "true") {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });
}

function setupMailTestModal() {
  const modal = document.getElementById("mail-test-modal");
  const openButton = document.getElementById("mail-test-button");
  const closeButton = document.getElementById("mail-test-modal-close");
  const cancelButton = document.getElementById("mail-test-cancel");
  const sendButton = document.getElementById("mail-test-send");

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  openButton.addEventListener("click", openModal);
  closeButton.addEventListener("click", closeModal);
  cancelButton.addEventListener("click", closeModal);

  sendButton.addEventListener("click", function () {
    sendButton.textContent = "Enviado";
    window.setTimeout(function () {
      sendButton.textContent = "Enviar";
      closeModal();
    }, 900);
  });

  modal.addEventListener("click", function (event) {
    if (event.target.dataset.closeMailTestModal === "true") {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });
}

const CHECKLIST_MODULE_META = {
  lab: { title: "Checklist Laboratorio", usesCmdbClass: true, hasStatusToggle: false },
  handover: { title: "Checklist Entrega", usesCmdbClass: false, hasStatusToggle: true },
  reception: { title: "Checklist Recepción", usesCmdbClass: false, hasStatusToggle: true }
};

const currentChecklistDefinitionIds = {
  lab: null,
  handover: null,
  reception: null
};

let currentChecklistModalContext = "lab";

function getChecklistDefinitions(context) {
  return mockData.checklistDefinitionsByModule[context] || [];
}

function getChecklistContainer(context) {
  return document.querySelector(`[data-checklist-context="${context}"]`);
}

function getChecklistDefinition(context, checklistId) {
  return getChecklistDefinitions(context).find(function (item) {
    return item.id === checklistId;
  }) || null;
}

function syncChecklistAvailabilityFromScope() {
  const scopeToggles = document.querySelectorAll(".js-cmdb-scope-toggle");

  if (!scopeToggles.length) {
    return;
  }

  scopeToggles.forEach(function (toggle) {
    Object.keys(mockData.checklistDefinitionsByModule).forEach(function (context) {
      const definition = getChecklistDefinitions(context).find(function (item) {
        return item.classKey === toggle.dataset.classKey;
      });

      if (definition) {
        definition.status = toggle.checked ? "Activo" : "Inactivo";
      }
    });
  });
}

function setupCmdbSettings() {
  const ageToggle = document.getElementById("cmdb-age-toggle");
  const agePanel = document.getElementById("cmdb-age-panel");
  const statusToggle = document.getElementById("cmdb-status-toggle");
  const statusPanel = document.getElementById("cmdb-status-panel");
  const recurrentFailuresToggle = document.getElementById("cmdb-recurrent-failures-toggle");
  const recurrentFailuresPanel = document.getElementById("cmdb-recurrent-failures-panel");
  const scopeToggles = document.querySelectorAll(".js-cmdb-scope-toggle");

  if (!ageToggle || !agePanel || !statusToggle || !statusPanel || !recurrentFailuresToggle || !recurrentFailuresPanel) {
    return;
  }

  function syncPanels() {
    agePanel.classList.toggle("is-hidden", !ageToggle.checked);
    statusPanel.classList.toggle("is-hidden", !statusToggle.checked);
    recurrentFailuresPanel.classList.toggle("is-hidden", !recurrentFailuresToggle.checked);
  }

  ageToggle.addEventListener("change", syncPanels);
  statusToggle.addEventListener("change", syncPanels);
  recurrentFailuresToggle.addEventListener("change", syncPanels);

  scopeToggles.forEach(function (toggle) {
    toggle.addEventListener("change", function () {
      syncChecklistAvailabilityFromScope();
      renderAllChecklistSettings();
    });
  });

  syncPanels();
  syncChecklistAvailabilityFromScope();
}

function renderChecklistSettings(context) {
  const container = getChecklistContainer(context);

  if (!container) {
    return;
  }

  const listView = container.querySelector('[data-role="checklist-list-view"]');
  const editView = container.querySelector('[data-role="checklist-edit-view"]');
  const title = container.querySelector('[data-role="checklist-title"]');
  const moduleTitle = container.querySelector('[data-role="checklist-module-title"]');
  const classInput = container.querySelector('[data-role="checklist-class"]');
  const descriptionInput = container.querySelector('[data-role="checklist-description"]');
  const statusField = container.querySelector('[data-role="checklist-status-field"]');
  const statusToggle = container.querySelector('[data-role="checklist-status-toggle"]');
  const itemsBody = container.querySelector('[data-role="checklist-items-body"]');
  const checklistListBody = container.querySelector('[data-role="checklist-list-body"]');

  if (!listView || !editView || !title || !moduleTitle || !classInput || !descriptionInput || !itemsBody || !checklistListBody) {
    return;
  }

  moduleTitle.textContent = CHECKLIST_MODULE_META[context].title;

  checklistListBody.innerHTML = getChecklistDefinitions(context).map(function (item) {
    if (CHECKLIST_MODULE_META[context].usesCmdbClass) {
      return `
        <tr>
          <td>${item.name}</td>
          <td>${item.cmdbClass}</td>
          <td>${item.description}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-secondary js-checklist-select" type="button" data-context="${context}" data-checklist-id="${item.id}">Editar</button>
              <button class="btn btn-secondary js-checklist-preview" type="button" data-context="${context}" data-checklist-id="${item.id}">Preview</button>
            </div>
          </td>
        </tr>
      `;
    }

    return `
      <tr>
        <td>${item.name}</td>
        <td>${item.description}</td>
        <td>${createStatusBadge(item.status)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary js-checklist-select" type="button" data-context="${context}" data-checklist-id="${item.id}">Editar</button>
            <button class="btn btn-secondary js-checklist-preview" type="button" data-context="${context}" data-checklist-id="${item.id}">Preview</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  const selectedChecklist = getChecklistDefinition(context, currentChecklistDefinitionIds[context]);

  if (!selectedChecklist) {
    itemsBody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Selecciona un checklist para editar su contenido.</div></td></tr>`;
    title.textContent = "Editar checklist";
    classInput.textContent = "";
    descriptionInput.value = "";
    listView.classList.remove("is-hidden");
    editView.classList.add("is-hidden");
    return;
  }

  title.textContent = selectedChecklist.name;
  classInput.textContent = CHECKLIST_MODULE_META[context].usesCmdbClass
    ? selectedChecklist.cmdbClass
    : `Plantilla ${selectedChecklist.status.toLowerCase()} seleccionable por el técnico al emitir el acta.`;
  descriptionInput.value = selectedChecklist.description;
  if (statusField && statusToggle) {
    statusField.classList.toggle("is-hidden", !CHECKLIST_MODULE_META[context].hasStatusToggle);
    statusToggle.checked = selectedChecklist.status === "Activo";
  }

  itemsBody.innerHTML = selectedChecklist.checks.length ? selectedChecklist.checks.map(function (item) {
    return `
      <tr>
        <td>${item.name}</td>
        <td>${item.description}</td>
        <td>${item.type}</td>
        <td>
          <button
            class="btn btn-secondary js-checklist-edit-item"
            type="button"
            data-context="${context}"
            data-checklist-id="${selectedChecklist.id}"
            data-check-id="${item.id}">
            Editar
          </button>
        </td>
        <td>
          <button
            class="btn btn-secondary js-checklist-remove-item"
            type="button"
            data-context="${context}"
            data-checklist-id="${selectedChecklist.id}"
            data-check-id="${item.id}">
            Eliminar
          </button>
        </td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="5"><div class="empty-state">No hay checks cargados en esta lista.</div></td></tr>`;

  listView.classList.add("is-hidden");
  editView.classList.remove("is-hidden");
}

function renderAllChecklistSettings() {
  Object.keys(CHECKLIST_MODULE_META).forEach(function (context) {
    renderChecklistSettings(context);
  });
}

function setupChecklistSettings() {
  const itemModal = document.getElementById("checklist-item-modal");
  const itemModalTitle = document.getElementById("checklist-item-modal-title");
  const itemModalName = document.getElementById("checklist-item-name");
  const itemModalType = document.getElementById("checklist-item-type");
  const itemModalOptionAField = document.getElementById("checklist-item-option-a-field");
  const itemModalOptionBField = document.getElementById("checklist-item-option-b-field");
  const itemModalOptionA = document.getElementById("checklist-item-option-a");
  const itemModalOptionB = document.getElementById("checklist-item-option-b");
  const itemModalDescription = document.getElementById("checklist-item-description");
  const itemModalClose = document.getElementById("checklist-item-modal-close");
  const itemModalCancel = document.getElementById("checklist-item-modal-cancel");
  const itemModalSave = document.getElementById("checklist-item-modal-save");
  const deleteModal = document.getElementById("checklist-delete-modal");
  const deleteModalText = document.getElementById("checklist-delete-modal-text");
  const deleteModalClose = document.getElementById("checklist-delete-modal-close");
  const deleteModalCancel = document.getElementById("checklist-delete-modal-cancel");
  const deleteModalConfirm = document.getElementById("checklist-delete-modal-confirm");
  const previewModal = document.getElementById("checklist-preview-modal");
  const previewModalTitle = document.getElementById("checklist-preview-modal-title");
  const previewModalClass = document.getElementById("checklist-preview-modal-class");
  const previewModalBody = document.getElementById("checklist-preview-modal-body");
  const previewModalClose = document.getElementById("checklist-preview-modal-close");
  let pendingChecklistAction = null;
  let editingCheckItemId = null;

  if (!itemModal || !itemModalTitle || !itemModalName || !itemModalType || !itemModalOptionAField || !itemModalOptionBField || !itemModalOptionA || !itemModalOptionB || !itemModalDescription || !itemModalClose || !itemModalCancel || !itemModalSave || !deleteModal || !deleteModalText || !deleteModalClose || !deleteModalCancel || !deleteModalConfirm || !previewModal || !previewModalTitle || !previewModalClass || !previewModalBody || !previewModalClose) {
    return;
  }

  function getSelectedChecklist(context) {
    return getChecklistDefinition(context, currentChecklistDefinitionIds[context]);
  }

  function openItemModal() {
    itemModal.classList.add("is-open");
    itemModal.setAttribute("aria-hidden", "false");
  }

  function closeItemModal() {
    itemModal.classList.remove("is-open");
    itemModal.setAttribute("aria-hidden", "true");
    editingCheckItemId = null;
    itemModalName.value = "";
    itemModalType.selectedIndex = 0;
    itemModalOptionA.value = "";
    itemModalOptionB.value = "";
    itemModalDescription.value = "";
    syncChecklistItemTypeFields();
  }

  function openDeleteModal() {
    deleteModal.classList.add("is-open");
    deleteModal.setAttribute("aria-hidden", "false");
  }

  function closeDeleteModal() {
    deleteModal.classList.remove("is-open");
    deleteModal.setAttribute("aria-hidden", "true");
    pendingChecklistAction = null;
  }

  function syncSummaryState(context, isCollapsed) {
    const container = getChecklistContainer(context);

    if (!container) {
      return;
    }

    const summaryContent = container.querySelector('[data-role="checklist-summary-content"]');
    const summaryToggle = container.querySelector(".js-checklist-summary-toggle");

    if (!summaryContent || !summaryToggle) {
      return;
    }

    summaryContent.classList.toggle("is-hidden", isCollapsed);
    summaryToggle.classList.toggle("is-collapsed", isCollapsed);
    summaryToggle.title = isCollapsed ? "Expandir resumen" : "Colapsar resumen";
    summaryToggle.setAttribute("aria-label", isCollapsed ? "Expandir resumen" : "Colapsar resumen");
  }

  function openPreviewModal(context, checklist) {
    previewModalTitle.textContent = checklist.name;
    previewModalClass.textContent = CHECKLIST_MODULE_META[context].usesCmdbClass
      ? checklist.cmdbClass
      : `Plantilla ${checklist.status.toLowerCase()} disponible para selección en actas de ${context === "handover" ? "entrega" : "recepción"}.`;
    previewModalBody.innerHTML = checklist.checks.map(function (item, index) {
      let controlMarkup = '<label class="settings-check-card"><input type="checkbox"><span>Validado</span></label>';

      if (item.type === "Input text") {
        controlMarkup = '<input type="text" value="" placeholder="Completar campo">';
      } else if (item.type === "Text area") {
        controlMarkup = '<textarea rows="5" placeholder="Completar detalle"></textarea>';
      } else if (item.type === "Option / Radio") {
        const optionA = item.optionA || "Opción A";
        const optionB = item.optionB || "Opción B";
        controlMarkup = `
          <div class="checklist-preview-radio-group">
            <label><input type="radio" name="preview-${checklist.id}-${index}"> <span>${optionA}</span></label>
            <label><input type="radio" name="preview-${checklist.id}-${index}"> <span>${optionB}</span></label>
          </div>
        `;
      }

      return `
        <tr>
          <td class="checklist-preview-index">${index + 1}.</td>
          <td class="checklist-preview-description">
            <strong>${item.name}</strong>
            <div>${item.description}</div>
          </td>
          <td class="checklist-preview-answer">${controlMarkup}</td>
        </tr>
      `;
    }).join("");

    previewModal.dataset.context = context;
    previewModal.classList.add("is-open");
    previewModal.setAttribute("aria-hidden", "false");
  }

  function closePreviewModal() {
    previewModal.classList.remove("is-open");
    previewModal.setAttribute("aria-hidden", "true");
  }

  function syncChecklistItemTypeFields() {
    const isRadio = itemModalType.value === "Option / Radio";
    itemModalOptionAField.classList.toggle("field-hidden", !isRadio);
    itemModalOptionBField.classList.toggle("field-hidden", !isRadio);
  }

  itemModalType.addEventListener("change", syncChecklistItemTypeFields);

  document.addEventListener("click", function (event) {
    const previewButton = event.target.closest(".js-checklist-preview");
    const selectButton = event.target.closest(".js-checklist-select");
    const backButton = event.target.closest(".js-checklist-back");
    const summaryToggle = event.target.closest(".js-checklist-summary-toggle");
    const addButton = event.target.closest(".js-check-item-add");
    const saveButton = event.target.closest(".js-checklist-save-content");

    if (backButton) {
      currentChecklistDefinitionIds[backButton.dataset.context] = null;
      renderChecklistSettings(backButton.dataset.context);
      return;
    }

    if (summaryToggle) {
      const context = summaryToggle.dataset.context;
      const container = getChecklistContainer(context);
      const summaryContent = container ? container.querySelector('[data-role="checklist-summary-content"]') : null;

      if (summaryContent) {
        syncSummaryState(context, !summaryContent.classList.contains("is-hidden"));
      }

      return;
    }

    if (addButton) {
      currentChecklistModalContext = addButton.dataset.context;
      editingCheckItemId = null;
      itemModalTitle.textContent = "Nuevo check";
      openItemModal();
      return;
    }

    if (saveButton) {
      const context = saveButton.dataset.context;
      const container = getChecklistContainer(context);
      const descriptionInput = container ? container.querySelector('[data-role="checklist-description"]') : null;
      const statusToggle = container ? container.querySelector('[data-role="checklist-status-toggle"]') : null;
      const selectedChecklist = getSelectedChecklist(context);

      if (!selectedChecklist || !descriptionInput) {
        return;
      }

      selectedChecklist.description = descriptionInput.value.trim();
      if (CHECKLIST_MODULE_META[context].hasStatusToggle && statusToggle) {
        selectedChecklist.status = statusToggle.checked ? "Activo" : "Inactivo";
      }
      renderChecklistSettings(context);
      return;
    }

    if (previewButton) {
      const context = previewButton.dataset.context;
      const checklist = getChecklistDefinition(context, previewButton.dataset.checklistId);

      if (checklist) {
        openPreviewModal(context, checklist);
      }

      return;
    }

    if (selectButton) {
      currentChecklistDefinitionIds[selectButton.dataset.context] = selectButton.dataset.checklistId;
      renderChecklistSettings(selectButton.dataset.context);
      return;
    }
  });

  document.addEventListener("click", function (event) {
    const editButton = event.target.closest(".js-checklist-edit-item");
    const removeButton = event.target.closest(".js-checklist-remove-item");

    if (editButton) {
      currentChecklistModalContext = editButton.dataset.context;
      const checklist = getChecklistDefinition(currentChecklistModalContext, editButton.dataset.checklistId);

      if (!checklist) {
        return;
      }

      const checkItem = checklist.checks.find(function (item) {
        return item.id === editButton.dataset.checkId;
      });

      if (!checkItem) {
        return;
      }

      editingCheckItemId = checkItem.id;
      itemModalTitle.textContent = "Editar check";
      itemModalName.value = checkItem.name;
      itemModalType.value = checkItem.type;
      itemModalOptionA.value = checkItem.optionA || "";
      itemModalOptionB.value = checkItem.optionB || "";
      itemModalDescription.value = checkItem.description;
      syncChecklistItemTypeFields();
      openItemModal();
      return;
    }

    if (!removeButton) {
      return;
    }

    const context = removeButton.dataset.context;
    const checklist = getChecklistDefinition(context, removeButton.dataset.checklistId);

    if (!checklist) {
      return;
    }

    const checkItem = checklist.checks.find(function (item) {
      return item.id === removeButton.dataset.checkId;
    });

    if (!checkItem) {
      return;
    }

    pendingChecklistAction = {
      context: context,
      checklist: checklist,
      checkItem: checkItem,
      action: "remove"
    };

    deleteModalText.textContent = `Confirma si deseas eliminar "${checkItem.name}" del checklist seleccionado.`;
    openDeleteModal();
  });

  itemModalSave.addEventListener("click", function () {
    const selectedChecklist = getSelectedChecklist(currentChecklistModalContext);
    const checkName = itemModalName.value.trim();
    const checkType = itemModalType.value;
    const checkOptionA = itemModalOptionA.value.trim();
    const checkOptionB = itemModalOptionB.value.trim();
    const checkDescription = itemModalDescription.value.trim();

    if (!selectedChecklist || !checkName || !checkDescription) {
      return;
    }

    if (checkType === "Option / Radio" && (!checkOptionA || !checkOptionB)) {
      return;
    }

    if (editingCheckItemId) {
      const existingItem = selectedChecklist.checks.find(function (item) {
        return item.id === editingCheckItemId;
      });

      if (!existingItem) {
        return;
      }

      existingItem.name = checkName;
      existingItem.type = checkType;
      existingItem.description = checkDescription;
      existingItem.optionA = checkType === "Option / Radio" ? checkOptionA : "";
      existingItem.optionB = checkType === "Option / Radio" ? checkOptionB : "";
    } else {
      selectedChecklist.checks.unshift({
        id: "check-item-" + Date.now(),
        name: checkName,
        description: checkDescription,
        type: checkType,
        optionA: checkType === "Option / Radio" ? checkOptionA : "",
        optionB: checkType === "Option / Radio" ? checkOptionB : ""
      });
    }

    renderChecklistSettings(currentChecklistModalContext);
    closeItemModal();
  });

  deleteModalConfirm.addEventListener("click", function () {
    if (!pendingChecklistAction) {
      return;
    }

    if (pendingChecklistAction.action === "remove") {
      pendingChecklistAction.checklist.checks = pendingChecklistAction.checklist.checks.filter(function (item) {
        return item.id !== pendingChecklistAction.checkItem.id;
      });
    }

    renderChecklistSettings(pendingChecklistAction.context);
    closeDeleteModal();
  });

  itemModalClose.addEventListener("click", closeItemModal);
  itemModalCancel.addEventListener("click", closeItemModal);
  deleteModalClose.addEventListener("click", closeDeleteModal);
  deleteModalCancel.addEventListener("click", closeDeleteModal);
  previewModalClose.addEventListener("click", closePreviewModal);

  itemModal.addEventListener("click", function (event) {
    if (event.target.dataset.closeChecklistItemModal === "true") {
      closeItemModal();
    }
  });

  deleteModal.addEventListener("click", function (event) {
    if (event.target.dataset.closeChecklistDeleteModal === "true") {
      closeDeleteModal();
    }
  });

  previewModal.addEventListener("click", function (event) {
    if (event.target.dataset.closeChecklistPreviewModal === "true") {
      closePreviewModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && itemModal.classList.contains("is-open")) {
      closeItemModal();
    }

    if (event.key === "Escape" && deleteModal.classList.contains("is-open")) {
      closeDeleteModal();
    }

    if (event.key === "Escape" && previewModal.classList.contains("is-open")) {
      closePreviewModal();
    }
  });

  Object.keys(CHECKLIST_MODULE_META).forEach(function (context) {
    syncSummaryState(context, true);
  });
  syncChecklistItemTypeFields();
}

function setupReportsWorkspace() {
  const workspace = document.getElementById("report-workspace");
  const catalog = document.getElementById("reports-catalog-panel");
  const stats = document.getElementById("reports-kpi-grid");
  const backButton = document.getElementById("report-back-button");
  const runButton = document.getElementById("report-run-inline-button");
  const exportButton = document.getElementById("report-export-button");
  const paramsToggle = document.getElementById("report-params-toggle");
  const paramsContent = document.getElementById("report-params-content");
  const resultToggle = document.getElementById("report-result-toggle");
  const resultContent = document.getElementById("report-result-content");
  let currentReportId = null;

  function openWorkspace(reportId) {
    currentReportId = reportId;
    renderReportDetail(reportId);
    workspace.classList.add("is-active");
    catalog.style.display = "none";
    stats.classList.add("is-hidden");
  }

  function closeWorkspace() {
    workspace.classList.remove("is-active");
    catalog.style.display = "";
    stats.classList.remove("is-hidden");
  }

  document.addEventListener("click", function (event) {
    const openButton = event.target.closest(".js-report-open");

    if (openButton) {
      openWorkspace(openButton.dataset.reportId);
    }
  });

  backButton.addEventListener("click", closeWorkspace);

  runButton.addEventListener("click", function () {
    renderReportRows(currentReportId);
  });

  paramsToggle.addEventListener("click", function () {
    paramsContent.classList.toggle("is-collapsed");
    paramsToggle.classList.toggle("is-collapsed");
    const collapsed = paramsContent.classList.contains("is-collapsed");
    paramsToggle.title = collapsed ? "Expandir parametros" : "Colapsar parametros";
    paramsToggle.setAttribute("aria-label", collapsed ? "Expandir parametros" : "Colapsar parametros");
  });

  resultToggle.addEventListener("click", function () {
    resultContent.classList.toggle("is-collapsed");
    resultToggle.classList.toggle("is-collapsed");
    const collapsed = resultContent.classList.contains("is-collapsed");
    resultToggle.title = collapsed ? "Expandir resultados" : "Colapsar resultados";
    resultToggle.setAttribute("aria-label", collapsed ? "Expandir resultados" : "Colapsar resultados");
  });

  exportButton.addEventListener("click", function () {
    if (exportButton.disabled) return;
    exportButton.classList.add("is-active");
    window.setTimeout(function () {
      exportButton.classList.remove("is-active");
    }, 1200);
  });

  document.addEventListener("click", function (event) {
    const toggle = event.target.closest(".js-report-category-toggle");

    if (!toggle) return;

    const category = toggle.dataset.category;
    const grid = document.querySelector(`[data-category-grid="${category}"]`);
    grid.classList.toggle("is-collapsed");
    toggle.classList.toggle("is-collapsed");
    const collapsed = grid.classList.contains("is-collapsed");
    toggle.title = collapsed ? "Expandir categoria" : "Colapsar categoria";
    toggle.setAttribute("aria-label", collapsed ? "Expandir categoria" : "Colapsar categoria");
  });
}

function setupHandoverWorkspace() {
  const workspace = document.getElementById("handover-workspace");
  const listPanel = document.getElementById("handover-list-panel");
  const filtersPanel = document.getElementById("handover-filters-panel");
  const stats = document.getElementById("handover-kpi-grid");
  const backButton = document.getElementById("handover-back-button");
  const saveButton = document.getElementById("handover-save-button");
  const userSelect = document.getElementById("handover-record-user");
  const assetSelect = document.getElementById("handover-record-asset");
  const assetAddButton = document.getElementById("handover-asset-add");
  const userToggle = document.getElementById("handover-user-toggle");
  const formToggle = document.getElementById("handover-form-toggle");

  function openWorkspace(mode, handoverId) {
    renderHandoverDetail(handoverId, mode);
    workspace.classList.add("is-active");
    listPanel.classList.add("is-hidden");
    filtersPanel.classList.add("is-hidden");
    stats.classList.add("is-hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeWorkspace() {
    workspace.classList.remove("is-active");
    listPanel.classList.remove("is-hidden");
    filtersPanel.classList.remove("is-hidden");
    stats.classList.remove("is-hidden");
    currentHandoverWorkspaceId = null;
    currentHandoverWorkspaceMode = "create";
    currentHandoverDocument = "";
  }

  function toggleStaticSection(toggleId, contentId, expandLabel, collapseLabel) {
    const content = document.getElementById(contentId);

    if (!content) {
      return;
    }

    const collapsed = !content.classList.contains("is-collapsed");
    setHandoverSectionCollapse(toggleId, contentId, collapsed, expandLabel, collapseLabel);
  }

  function addAssetToWorkspace(assetCode) {
    if (!assetCode) {
      return;
    }

    const asset = mockData.assets.find(function (item) {
      return item.code === assetCode;
    });
    const alreadyExists = currentHandoverAssetState.items.some(function (item) {
      return item.assetCode === assetCode;
    });

    if (!asset || alreadyExists) {
      return;
    }

    currentHandoverAssetState.items.push({
      assetCode: asset.code,
      assetName: asset.name,
      collapsed: false,
      checklistSections: []
    });
    renderSelectedHandoverAssets();
  }

  function addChecklistToAsset(assetCode, checklistId) {
    const assetItem = currentHandoverAssetState.items.find(function (item) {
      return item.assetCode === assetCode;
    });
    const definition = getHandoverChecklistDefinition(checklistId);

    if (!assetItem || !definition || !checklistId) {
      return;
    }

    if (assetItem.checklistSections.some(function (section) { return section.id === checklistId; })) {
      return;
    }

    assetItem.checklistSections.push({
      id: checklistId,
      collapsed: false,
      answers: {}
    });
    renderSelectedHandoverAssets();
  }

  function collectHandoverWorkspaceValues() {
    const selectedUser = getSelectedHandoverUser();
    const selectedAssets = currentHandoverAssetState.items.map(function (item) {
      return {
        assetCode: item.assetCode,
        assetName: item.assetName,
        collapsed: item.collapsed,
        checklistSections: item.checklistSections.map(function (section) {
          return {
            id: section.id,
            collapsed: section.collapsed,
            answers: Object.assign({}, section.answers)
          };
        })
      };
    });
    const firstAsset = selectedAssets[0] || null;

    return {
      document: currentHandoverDocument || getNextHandoverDocument(),
      generatedAt: document.getElementById("handover-record-generated-at").value,
      date: (document.getElementById("handover-record-generated-at").value || "").split("T")[0],
      type: document.getElementById("handover-record-type").value,
      reason: document.getElementById("handover-record-reason").value.trim(),
      assetCode: firstAsset ? firstAsset.assetCode : "",
      assetName: firstAsset ? firstAsset.assetName : "",
      user: selectedUser ? selectedUser.name : "",
      userIdentifier: selectedUser ? selectedUser.identifier : "",
      owner: document.getElementById("handover-record-owner").value.trim(),
      status: document.getElementById("handover-record-status").value,
      notes: document.getElementById("handover-record-notes").value.trim(),
      selectedAssets: selectedAssets
    };
  }

  document.addEventListener("click", function (event) {
    const createButton = event.target.closest(".js-handover-create");
    const editButton = event.target.closest(".js-handover-detail");

    if (createButton) {
      if (!canWriteAppModule("handover")) {
        return;
      }
      openWorkspace("create");
      return;
    }

    if (editButton) {
      if (!canViewAppModule("handover")) {
        return;
      }
      openWorkspace("edit", editButton.dataset.handoverId);
    }
  });

  backButton.addEventListener("click", closeWorkspace);

  userToggle.addEventListener("click", function () {
    toggleStaticSection("handover-user-toggle", "handover-user-content", "Expandir usuario destino", "Colapsar usuario destino");
  });

  formToggle.addEventListener("click", function () {
    toggleStaticSection("handover-form-toggle", "handover-form-content", "Expandir datos de emisión", "Colapsar datos de emisión");
  });

  userSelect.addEventListener("input", renderUserDestinationSummary);
  userSelect.addEventListener("change", renderUserDestinationSummary);

  assetAddButton.addEventListener("click", function () {
    addAssetToWorkspace(assetSelect.value);
  });

  assetSelect.addEventListener("change", function () {
    assetAddButton.disabled = !assetSelect.value;
  });

  document.addEventListener("click", function (event) {
    const assetToggleButton = event.target.closest(".js-handover-asset-toggle");
    const toggleButton = event.target.closest(".js-handover-checklist-toggle");
    const assetRemoveButton = event.target.closest(".js-handover-asset-remove");
    const removeButton = event.target.closest(".js-handover-checklist-remove");
    const assetChecklistAddButton = event.target.closest(".js-handover-asset-checklist-add");

    if (assetToggleButton) {
      const assetItem = currentHandoverAssetState.items.find(function (item) {
        return item.assetCode === assetToggleButton.dataset.assetCode;
      });

      if (!assetItem) {
        return;
      }

      assetItem.collapsed = !assetItem.collapsed;
      renderSelectedHandoverAssets();
      return;
    }

    if (toggleButton) {
      const assetItem = currentHandoverAssetState.items.find(function (item) {
        return item.assetCode === toggleButton.dataset.assetCode;
      });
      const section = assetItem ? assetItem.checklistSections.find(function (item) {
        return item.id === toggleButton.dataset.checklistId;
      }) : null;

      if (!section) {
        return;
      }

      section.collapsed = !section.collapsed;
      renderSelectedHandoverAssets();
      return;
    }

    if (assetRemoveButton) {
      currentHandoverAssetState.items = currentHandoverAssetState.items.filter(function (item) {
        return item.assetCode !== assetRemoveButton.dataset.assetCode;
      });
      renderSelectedHandoverAssets();
      return;
    }

    if (assetChecklistAddButton) {
      const selector = document.querySelector(`[data-handover-asset-checklist-selector="${assetChecklistAddButton.dataset.assetCode}"]`);
      addChecklistToAsset(assetChecklistAddButton.dataset.assetCode, selector ? selector.value : "");
      return;
    }

    if (!removeButton) {
      return;
    }

    const assetItem = currentHandoverAssetState.items.find(function (item) {
      return item.assetCode === removeButton.dataset.assetCode;
    });

    if (!assetItem) {
      return;
    }

    assetItem.checklistSections = assetItem.checklistSections.filter(function (item) {
      return item.id !== removeButton.dataset.checklistId;
    });
    renderSelectedHandoverAssets();
  });

  document.addEventListener("input", function (event) {
    const input = event.target.closest("[data-handover-check-input='true']");

    if (!input) {
      return;
    }

    const assetItem = currentHandoverAssetState.items.find(function (item) {
      return item.assetCode === input.dataset.assetCode;
    });
    const section = assetItem ? assetItem.checklistSections.find(function (item) {
      return item.id === input.dataset.checklistId;
    }) : null;

    if (!section) {
      return;
    }

    if (input.type === "checkbox") {
      section.answers[input.dataset.checkId] = input.checked;
      return;
    }

    if (input.type === "radio") {
      if (input.checked) {
        section.answers[input.dataset.checkId] = input.value;
      }
      return;
    }

    section.answers[input.dataset.checkId] = input.value;
  });

  document.addEventListener("change", function (event) {
    const input = event.target.closest("[data-handover-check-input='true']");

    if (!input || input.type !== "radio") {
      return;
    }

    const assetItem = currentHandoverAssetState.items.find(function (item) {
      return item.assetCode === input.dataset.assetCode;
    });
    const section = assetItem ? assetItem.checklistSections.find(function (item) {
      return item.id === input.dataset.checklistId;
    }) : null;

    if (section && input.checked) {
      section.answers[input.dataset.checkId] = input.value;
    }
  });

  saveButton.addEventListener("click", function () {
    if (!canWriteAppModule("handover")) {
      return;
    }

    const payload = collectHandoverWorkspaceValues();

    if (!payload.document || !payload.date || !payload.selectedAssets.length || !payload.user || !payload.owner) {
      return;
    }

    if (currentHandoverWorkspaceMode === "edit" && currentHandoverWorkspaceId) {
      const existingRecord = mockData.handovers.find(function (item) {
        return item.id === currentHandoverWorkspaceId;
      });

      if (!existingRecord) {
        return;
      }

      Object.assign(existingRecord, payload);
    } else {
      mockData.handovers.unshift(Object.assign({
        id: "handover-" + Date.now()
      }, payload));
    }

    renderHandover();
    filterHandovers();
    closeWorkspace();
  });
}

function setupReceptionWorkspace() {
  const workspace = document.getElementById("reception-workspace");
  const listPanel = document.getElementById("reception-list-panel");
  const filtersPanel = document.getElementById("reception-filters-panel");
  const stats = document.getElementById("reception-kpi-grid");
  const backButton = document.getElementById("reception-back-button");
  const saveButton = document.getElementById("reception-save-button");
  const userInput = document.getElementById("reception-record-deliverer");
  const assetSelect = document.getElementById("reception-record-asset");
  const assetAddButton = document.getElementById("reception-asset-add");
  const userToggle = document.getElementById("reception-user-toggle");
  const formToggle = document.getElementById("reception-form-toggle");

  function openWorkspace(mode, receptionId) {
    renderReceptionDetail(receptionId, mode);
    workspace.classList.add("is-active");
    listPanel.classList.add("is-hidden");
    filtersPanel.classList.add("is-hidden");
    stats.classList.add("is-hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeWorkspace() {
    workspace.classList.remove("is-active");
    listPanel.classList.remove("is-hidden");
    filtersPanel.classList.remove("is-hidden");
    stats.classList.remove("is-hidden");
    currentReceptionWorkspaceId = null;
    currentReceptionWorkspaceMode = "create";
    currentReceptionDocument = "";
  }

  function addAsset(assetCode) {
    const asset = mockData.assets.find(function (item) { return item.code === assetCode; });
    if (!asset || currentReceptionAssetState.items.some(function (item) { return item.assetCode === assetCode; })) return;
    currentReceptionAssetState.items.push({ assetCode: asset.code, assetName: asset.name, collapsed: false, checklistSections: [] });
    renderSelectedReceptionAssets();
  }

  function addChecklistToAsset(assetCode, checklistId) {
    const assetItem = currentReceptionAssetState.items.find(function (item) { return item.assetCode === assetCode; });
    if (!assetItem || !checklistId || assetItem.checklistSections.some(function (item) { return item.id === checklistId; })) return;
    assetItem.checklistSections.push({ id: checklistId, collapsed: false, answers: {} });
    renderSelectedReceptionAssets();
  }

  function collectValues() {
    const selectedUser = getSelectedReceptionUser();
    const selectedAssets = currentReceptionAssetState.items.map(function (item) {
      return {
        assetCode: item.assetCode,
        assetName: item.assetName,
        collapsed: item.collapsed,
        checklistSections: item.checklistSections.map(function (section) {
          return { id: section.id, collapsed: section.collapsed, answers: Object.assign({}, section.answers) };
        })
      };
    });
    const firstAsset = selectedAssets[0] || null;
    return {
      document: currentReceptionDocument || getNextReceptionDocument(),
      generatedAt: document.getElementById("reception-record-generated-at").value,
      date: (document.getElementById("reception-record-generated-at").value || "").split("T")[0],
      deliverer: selectedUser ? selectedUser.name : "",
      receiver: document.getElementById("reception-record-owner").value.trim(),
      origin: document.getElementById("reception-record-origin").value.trim(),
      reason: document.getElementById("reception-record-reason").value.trim(),
      receivedState: document.getElementById("reception-record-status").value,
      owner: document.getElementById("reception-record-owner").value.trim(),
      resultNotes: document.getElementById("reception-record-notes").value.trim(),
      assetCode: firstAsset ? firstAsset.assetCode : "",
      assetName: firstAsset ? firstAsset.assetName : "",
      selectedAssets: selectedAssets
    };
  }

  document.addEventListener("click", function (event) {
    const createButton = event.target.closest(".js-reception-create");
    const editButton = event.target.closest(".js-reception-detail");
    if (createButton) {
      if (!canWriteAppModule("reception")) {
        return;
      }
      openWorkspace("create");
      return;
    }
    if (editButton) {
      if (!canViewAppModule("reception")) {
        return;
      }
      openWorkspace("edit", editButton.dataset.receptionId);
    }
  });

  backButton.addEventListener("click", closeWorkspace);
  userToggle.addEventListener("click", function () {
    const content = document.getElementById("reception-user-content");
    const collapsed = content && !content.classList.contains("is-collapsed");
    setHandoverSectionCollapse("reception-user-toggle", "reception-user-content", collapsed, "Expandir usuario origen", "Colapsar usuario origen");
  });
  formToggle.addEventListener("click", function () {
    const content = document.getElementById("reception-form-content");
    const collapsed = content && !content.classList.contains("is-collapsed");
    setHandoverSectionCollapse("reception-form-toggle", "reception-form-content", collapsed, "Expandir datos de emisión", "Colapsar datos de emisión");
  });
  userInput.addEventListener("input", renderReceptionUserSummary);
  userInput.addEventListener("change", renderReceptionUserSummary);
  assetAddButton.addEventListener("click", function () { addAsset(assetSelect.value); });
  assetSelect.addEventListener("change", function () { assetAddButton.disabled = !assetSelect.value; });

  document.addEventListener("click", function (event) {
    const assetToggle = event.target.closest(".js-reception-asset-toggle");
    const assetRemove = event.target.closest(".js-reception-asset-remove");
    const checklistToggle = event.target.closest(".js-reception-checklist-toggle");
    const checklistRemove = event.target.closest(".js-reception-checklist-remove");
    const checklistAdd = event.target.closest(".js-reception-asset-checklist-add");

    if (assetToggle) {
      const item = currentReceptionAssetState.items.find(function (entry) { return entry.assetCode === assetToggle.dataset.assetCode; });
      if (item) {
        item.collapsed = !item.collapsed;
        renderSelectedReceptionAssets();
      }
      return;
    }

    if (assetRemove) {
      currentReceptionAssetState.items = currentReceptionAssetState.items.filter(function (entry) { return entry.assetCode !== assetRemove.dataset.assetCode; });
      renderSelectedReceptionAssets();
      return;
    }

    if (checklistToggle) {
      const assetItem = currentReceptionAssetState.items.find(function (entry) { return entry.assetCode === checklistToggle.dataset.assetCode; });
      const section = assetItem ? assetItem.checklistSections.find(function (entry) { return entry.id === checklistToggle.dataset.checklistId; }) : null;
      if (section) {
        section.collapsed = !section.collapsed;
        renderSelectedReceptionAssets();
      }
      return;
    }

    if (checklistRemove) {
      const assetItem = currentReceptionAssetState.items.find(function (entry) { return entry.assetCode === checklistRemove.dataset.assetCode; });
      if (assetItem) {
        assetItem.checklistSections = assetItem.checklistSections.filter(function (entry) { return entry.id !== checklistRemove.dataset.checklistId; });
        renderSelectedReceptionAssets();
      }
      return;
    }

    if (checklistAdd) {
      const selector = document.querySelector(`[data-reception-asset-checklist-selector="${checklistAdd.dataset.assetCode}"]`);
      addChecklistToAsset(checklistAdd.dataset.assetCode, selector ? selector.value : "");
    }
  });

  document.addEventListener("input", function (event) {
    const input = event.target.closest("[data-reception-check-input='true']");
    if (!input) return;
    const assetItem = currentReceptionAssetState.items.find(function (entry) { return entry.assetCode === input.dataset.assetCode; });
    const section = assetItem ? assetItem.checklistSections.find(function (entry) { return entry.id === input.dataset.checklistId; }) : null;
    if (!section) return;
    if (input.type === "checkbox") {
      section.answers[input.dataset.checkId] = input.checked;
    } else if (input.type === "radio") {
      if (input.checked) section.answers[input.dataset.checkId] = input.value;
    } else {
      section.answers[input.dataset.checkId] = input.value;
    }
  });

  document.addEventListener("change", function (event) {
    const input = event.target.closest("[data-reception-check-input='true']");
    if (!input || input.type !== "radio") return;
    const assetItem = currentReceptionAssetState.items.find(function (entry) { return entry.assetCode === input.dataset.assetCode; });
    const section = assetItem ? assetItem.checklistSections.find(function (entry) { return entry.id === input.dataset.checklistId; }) : null;
    if (section && input.checked) section.answers[input.dataset.checkId] = input.value;
  });

  saveButton.addEventListener("click", function () {
    if (!canWriteAppModule("reception")) {
      return;
    }

    const payload = collectValues();
    if (!payload.document || !payload.generatedAt || !payload.deliverer || !payload.selectedAssets.length) return;
    if (currentReceptionWorkspaceMode === "edit" && currentReceptionWorkspaceId) {
      const existing = mockData.receptions.find(function (item) { return item.id === currentReceptionWorkspaceId; });
      if (!existing) return;
      Object.assign(existing, payload);
    } else {
      mockData.receptions.unshift(Object.assign({ id: "reception-" + Date.now() }, payload));
    }
    renderReception();
    filterReceptions();
    closeWorkspace();
  });
}

function setupLabWorkspace() {
  const workspace = document.getElementById("lab-workspace");
  const listPanel = document.getElementById("lab-list-panel");
  const filtersPanel = document.getElementById("lab-filters-panel");
  const stats = document.getElementById("lab-kpi-grid");
  const backButton = document.getElementById("lab-back-button");
  const saveButton = document.getElementById("lab-save-button");
  const assetSelect = document.getElementById("lab-record-asset");
  const assetAddButton = document.getElementById("lab-asset-add");
  const assetSectionToggle = document.getElementById("lab-asset-section-toggle");
  const evidenceAddButton = document.getElementById("lab-evidence-add");
  const formToggle = document.getElementById("lab-form-toggle");

  function openWorkspace(mode, labId) {
    renderLabDetail(labId, mode);
    workspace.classList.add("is-active");
    listPanel.classList.add("is-hidden");
    filtersPanel.classList.add("is-hidden");
    stats.classList.add("is-hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeWorkspace() {
    workspace.classList.remove("is-active");
    listPanel.classList.remove("is-hidden");
    filtersPanel.classList.remove("is-hidden");
    stats.classList.remove("is-hidden");
    currentLabWorkspaceId = null;
    currentLabWorkspaceMode = "create";
    currentLabReportNumber = "";
    currentLabEvidenceState = { items: [] };
  }

  function addAsset(assetCode) {
    const asset = mockData.assets.find(function (item) { return item.code === assetCode; });
    if (!asset || currentLabAssetState.items.length || currentLabAssetState.items.some(function (item) { return item.assetCode === assetCode; })) return;
    currentLabAssetState.items = [{ assetCode: asset.code, assetName: asset.name, collapsed: false, checklistSections: [] }];
    renderSelectedLabAssets();
  }

  function addChecklistToAsset(assetCode, checklistId) {
    const assetItem = currentLabAssetState.items.find(function (item) { return item.assetCode === assetCode; });
    if (!assetItem || !checklistId || assetItem.checklistSections.some(function (item) { return item.id === checklistId; })) return;
    assetItem.checklistSections.push({ id: checklistId, collapsed: false, answers: {} });
    renderSelectedLabAssets();
  }

  function addEvidence() {
    currentLabEvidenceState.items.push({
      id: getLabEvidenceItemId(),
      description: "",
      fileData: "",
      imageData: "",
      imageName: "",
      mimeType: "",
      kind: "image"
    });
    renderLabEvidenceList();
  }

  function collectValues() {
    const selectedAssets = currentLabAssetState.items.slice(0, 1).map(function (item) {
      return {
        assetCode: item.assetCode,
        assetName: item.assetName,
        collapsed: item.collapsed,
        checklistSections: item.checklistSections.map(function (section) {
          return { id: section.id, collapsed: section.collapsed, answers: Object.assign({}, section.answers) };
        })
      };
    });
    const firstAsset = selectedAssets[0] || null;
    const existingRecord = currentLabWorkspaceMode === "edit" && currentLabWorkspaceId
      ? mockData.labQueue.find(function (item) { return item.id === currentLabWorkspaceId; })
      : null;
    return {
      reportNumber: currentLabReportNumber || (existingRecord ? existingRecord.reportNumber : getNextLabDocument()),
      entryAt: document.getElementById("lab-record-entry-at").value,
      closedAt: document.getElementById("lab-record-closed-at").value,
      technician: document.getElementById("lab-record-owner").value.trim(),
      status: document.getElementById("lab-record-status").value,
      receptionDocument: existingRecord ? existingRecord.receptionDocument : "",
      reason: document.getElementById("lab-record-reason").value,
      result: document.getElementById("lab-record-result").value,
      priority: existingRecord ? existingRecord.priority : "Alta",
      description: document.getElementById("lab-record-description").value.trim(),
      evidence: currentLabEvidenceState.items.map(function (item, index) {
        return {
          id: item.id,
          title: item.imageName || `Evidencia ${index + 1}`,
          note: item.description,
          description: item.description,
          fileData: item.fileData,
          imageData: item.fileData,
          imageName: item.imageName,
          mimeType: item.mimeType,
          kind: item.kind
        };
      }),
      type: firstAsset ? ((mockData.assets.find(function (asset) { return asset.code === firstAsset.assetCode; }) || {}).type || "Activo") : "Activo",
      assetCode: firstAsset ? firstAsset.assetCode : "",
      assetName: firstAsset ? firstAsset.assetName : "",
      selectedAssets: selectedAssets
    };
  }

  document.addEventListener("click", function (event) {
    const createButton = event.target.closest(".js-lab-create");
    const editButton = event.target.closest(".js-lab-detail");
    if (createButton) {
      if (!canWriteAppModule("lab")) {
        return;
      }
      openWorkspace("create");
      return;
    }
    if (editButton) {
      if (!canViewAppModule("lab")) {
        return;
      }
      openWorkspace("edit", editButton.dataset.labId);
    }
  });

  backButton.addEventListener("click", closeWorkspace);
  formToggle.addEventListener("click", function () {
    const content = document.getElementById("lab-form-content");
    const collapsed = content && !content.classList.contains("is-collapsed");
    setHandoverSectionCollapse("lab-form-toggle", "lab-form-content", collapsed, "Expandir datos del registro", "Colapsar datos del registro");
  });
  assetSectionToggle.addEventListener("click", function () {
    const content = document.getElementById("lab-asset-section-content");
    const collapsed = content && !content.classList.contains("is-collapsed");
    setHandoverSectionCollapse("lab-asset-section-toggle", "lab-asset-section-content", collapsed, "Expandir equipo incluido en el registro", "Colapsar equipo incluido en el registro");
  });
  assetAddButton.addEventListener("click", function () { addAsset(assetSelect.value); });
  evidenceAddButton.addEventListener("click", addEvidence);
  assetSelect.addEventListener("change", function () { assetAddButton.disabled = !assetSelect.value; });

  document.addEventListener("click", function (event) {
    const assetToggle = event.target.closest(".js-lab-asset-toggle");
    const assetRemove = event.target.closest(".js-lab-asset-remove");
    const checklistToggle = event.target.closest(".js-lab-checklist-toggle");
    const checklistRemove = event.target.closest(".js-lab-checklist-remove");
    const checklistAdd = event.target.closest(".js-lab-asset-checklist-add");
    const evidenceRemove = event.target.closest(".js-lab-evidence-remove");
    const evidenceDropzone = event.target.closest("[data-lab-evidence-dropzone='true']");
    const evidencePreview = event.target.closest("[data-lab-evidence-preview='true'], .js-lab-evidence-preview");

    if (assetToggle) {
      const item = currentLabAssetState.items.find(function (entry) { return entry.assetCode === assetToggle.dataset.assetCode; });
      if (item) {
        item.collapsed = !item.collapsed;
        renderSelectedLabAssets();
      }
      return;
    }
    if (assetRemove) {
      currentLabAssetState.items = currentLabAssetState.items.filter(function (entry) { return entry.assetCode !== assetRemove.dataset.assetCode; });
      renderSelectedLabAssets();
      return;
    }
    if (checklistToggle) {
      const assetItem = currentLabAssetState.items.find(function (entry) { return entry.assetCode === checklistToggle.dataset.assetCode; });
      const section = assetItem ? assetItem.checklistSections.find(function (entry) { return entry.id === checklistToggle.dataset.checklistId; }) : null;
      if (section) {
        section.collapsed = !section.collapsed;
        renderSelectedLabAssets();
      }
      return;
    }
    if (checklistRemove) {
      const assetItem = currentLabAssetState.items.find(function (entry) { return entry.assetCode === checklistRemove.dataset.assetCode; });
      if (assetItem) {
        assetItem.checklistSections = assetItem.checklistSections.filter(function (entry) { return entry.id !== checklistRemove.dataset.checklistId; });
        renderSelectedLabAssets();
      }
      return;
    }
    if (checklistAdd) {
      const selector = document.querySelector(`[data-lab-asset-checklist-selector="${checklistAdd.dataset.assetCode}"]`);
      addChecklistToAsset(checklistAdd.dataset.assetCode, selector ? selector.value : "");
      return;
    }
    if (evidenceRemove) {
      currentLabEvidenceState.items = currentLabEvidenceState.items.filter(function (item) { return item.id !== evidenceRemove.dataset.evidenceId; });
      renderLabEvidenceList();
      return;
    }
    if (evidenceDropzone) {
      const input = document.querySelector(`[data-lab-evidence-file="true"][data-evidence-id="${evidenceDropzone.dataset.evidenceId}"]`);
      if (input) input.click();
      return;
    }
    if (evidencePreview) {
      openLabEvidencePreview(evidencePreview.dataset.evidenceId);
    }
  });

  document.addEventListener("input", function (event) {
    const input = event.target.closest("[data-lab-check-input='true']");
    if (!input) return;
    const assetItem = currentLabAssetState.items.find(function (entry) { return entry.assetCode === input.dataset.assetCode; });
    const section = assetItem ? assetItem.checklistSections.find(function (entry) { return entry.id === input.dataset.checklistId; }) : null;
    if (!section) return;
    if (input.type === "checkbox") {
      section.answers[input.dataset.checkId] = input.checked;
    } else if (input.type === "radio") {
      if (input.checked) section.answers[input.dataset.checkId] = input.value;
    } else {
      section.answers[input.dataset.checkId] = input.value;
    }
  });

  document.addEventListener("change", function (event) {
    const evidenceFile = event.target.closest("[data-lab-evidence-file='true']");
    const input = event.target.closest("[data-lab-check-input='true']");
    if (evidenceFile && evidenceFile.files && evidenceFile.files[0]) {
      const evidenceItem = currentLabEvidenceState.items.find(function (item) { return item.id === evidenceFile.dataset.evidenceId; });
      if (!evidenceItem) return;
      processLabEvidenceFile(evidenceItem, evidenceFile.files[0]);
      return;
    }
    if (!input || input.type !== "radio") return;
    const assetItem = currentLabAssetState.items.find(function (entry) { return entry.assetCode === input.dataset.assetCode; });
    const section = assetItem ? assetItem.checklistSections.find(function (entry) { return entry.id === input.dataset.checklistId; }) : null;
    if (section && input.checked) section.answers[input.dataset.checkId] = input.value;
  });

  document.addEventListener("input", function (event) {
    const descriptionInput = event.target.closest("[data-lab-evidence-description='true']");
    if (!descriptionInput) return;
    const evidenceItem = currentLabEvidenceState.items.find(function (item) { return item.id === descriptionInput.dataset.evidenceId; });
    if (evidenceItem) evidenceItem.description = descriptionInput.value;
  });

  document.addEventListener("dragover", function (event) {
    const dropzone = event.target.closest("[data-lab-evidence-dropzone='true']");
    if (!dropzone) return;
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });

  document.addEventListener("dragleave", function (event) {
    const dropzone = event.target.closest("[data-lab-evidence-dropzone='true']");
    if (!dropzone) return;
    if (dropzone.contains(event.relatedTarget)) return;
    dropzone.classList.remove("is-dragover");
  });

  document.addEventListener("drop", function (event) {
    const dropzone = event.target.closest("[data-lab-evidence-dropzone='true']");
    if (!dropzone) return;
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
    const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
    if (!file) return;
    const evidenceItem = currentLabEvidenceState.items.find(function (item) { return item.id === dropzone.dataset.evidenceId; });
    if (!evidenceItem) return;
    processLabEvidenceFile(evidenceItem, file);
  });

  saveButton.addEventListener("click", function () {
    if (!canWriteAppModule("lab")) {
      return;
    }

    const payload = collectValues();
    if (!payload.reportNumber || !payload.entryAt || !payload.selectedAssets.length) return;
    if (currentLabWorkspaceMode === "edit" && currentLabWorkspaceId) {
      const existing = mockData.labQueue.find(function (item) { return item.id === currentLabWorkspaceId; });
      if (!existing) return;
      Object.assign(existing, payload);
    } else {
      mockData.labQueue.unshift(Object.assign({ id: "lab-" + Date.now(), type: "Activo" }, payload));
    }
    renderLabQueue();
    filterLabQueue();
    closeWorkspace();
  });
}

function setupLabEvidencePreviewModal() {
  const modal = document.getElementById("lab-evidence-preview-modal");
  const closeButton = document.getElementById("lab-evidence-preview-close");
  const title = document.getElementById("lab-evidence-preview-title");
  const lead = document.getElementById("lab-evidence-preview-lead");
  const body = document.getElementById("lab-evidence-preview-body");

  if (!modal || !closeButton || !title || !lead || !body) return;

  function closeModal() {
    currentLabEvidencePreview = null;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    body.innerHTML = "";
  }

  closeButton.addEventListener("click", closeModal);
  modal.addEventListener("click", function (event) {
    if (event.target.dataset.closeLabEvidencePreviewModal === "true") {
      closeModal();
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });
}

function populateLabRecordSelects() {
  const reasonSelect = document.getElementById("lab-record-reason");
  const statusSelect = document.getElementById("lab-record-status");
  if (reasonSelect) {
    reasonSelect.innerHTML = `<option value="">Selecciona un motivo</option>${LAB_ENTRY_REASONS.map(function (item) { return `<option value="${item}">${item}</option>`; }).join("")}`;
  }
  if (statusSelect) {
    statusSelect.innerHTML = LAB_TECHNICAL_STATUSES.map(function (item) { return `<option value="${item}">${item}</option>`; }).join("");
  }
}

function setupAssetsWorkspace() {
  const workspace = document.getElementById("assets-workspace");
  const listPanel = document.getElementById("assets-list-panel");
  const filtersPanel = document.getElementById("assets-filters-panel");
  const stats = document.getElementById("assets-kpi-grid");
  const backButton = document.getElementById("assets-back-button");
  const saveButton = document.getElementById("assets-save-button");
  const createButton = document.getElementById("asset-create-button");

  function openWorkspace(mode, assetId) {
    renderAssetWorkspace(assetId, mode);
    workspace.classList.add("is-active");
    listPanel.classList.add("is-hidden");
    filtersPanel.classList.add("is-hidden");
    stats.classList.add("is-hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeWorkspace() {
    workspace.classList.remove("is-active");
    listPanel.classList.remove("is-hidden");
    filtersPanel.classList.remove("is-hidden");
    stats.classList.remove("is-hidden");
    currentAssetWorkspaceId = null;
    currentAssetWorkspaceMode = "create";
  }

  function collectValues() {
    const code = document.getElementById("asset-record-code").value.trim();
    return {
      code: code,
      name: code,
      classKey: document.getElementById("asset-record-class").value,
      cmdbClass: getCmdbClassLabel(document.getElementById("asset-record-class").value),
      type: getAssetTypeFromClass(document.getElementById("asset-record-class").value),
      brand: document.getElementById("asset-record-brand").value,
      model: document.getElementById("asset-record-model").value,
      serial: document.getElementById("asset-record-serial").value.trim(),
      inventoryCode: code,
      onboardingDate: document.getElementById("asset-record-onboarding-date").value,
      currentUser: document.getElementById("asset-record-current-user").value.trim(),
      location: document.getElementById("asset-record-location").value,
      status: document.getElementById("asset-record-status").value,
      cmdbStatus: document.getElementById("asset-record-cmdb-status").value,
      state: document.getElementById("asset-record-state").value,
      observations: document.getElementById("asset-record-observations").value.trim()
    };
  }

  document.addEventListener("click", function (event) {
    const editButton = event.target.closest(".js-asset-detail");

    if (editButton) {
      if (!canViewAppModule("assets")) {
        return;
      }
      openWorkspace("edit", editButton.dataset.assetId);
    }
  });

  if (createButton) {
    createButton.addEventListener("click", function () {
      if (!canWriteAppModule("assets")) {
        return;
      }
      openWorkspace("create");
    });
  }

  if (backButton) {
    backButton.addEventListener("click", closeWorkspace);
  }

  const classSelect = document.getElementById("asset-record-class");
  const brandSelect = document.getElementById("asset-record-brand");
  if (classSelect) {
    classSelect.addEventListener("change", function (event) {
      syncAssetBrandSelect(event.target.value, "");
    });
  }
  if (brandSelect) {
    brandSelect.addEventListener("change", function (event) {
      syncAssetModelSelect(event.target.value, "");
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", function () {
      if (!canWriteAppModule("assets")) {
        return;
      }

      const payload = collectValues();

      if (!payload.code || !payload.classKey || !payload.brand || !payload.model || !payload.serial || !payload.location) {
        return;
      }

      if (currentAssetWorkspaceMode === "edit" && currentAssetWorkspaceId) {
        const existing = mockData.assets.find(function (item) { return item.id === currentAssetWorkspaceId; });
        if (!existing) {
          return;
        }

        Object.assign(existing, payload);
      } else {
        const newId = "asset-" + Date.now();
        mockData.assets.unshift(Object.assign({ id: newId }, payload));
        mockData.assetHistory[newId] = [];
      }

      renderAssetsOverview();
      renderAssetFilters();
      filterAssets();
      closeWorkspace();
    });
  }
}

function setupInteractiveTables() {
  ["asset-filter-hostname", "asset-filter-class", "asset-filter-brand", "asset-filter-model", "asset-filter-serial", "asset-filter-status"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", filterAssets);
    document.getElementById(id).addEventListener("change", filterAssets);
  });

  ["handover-filter-document", "handover-filter-user", "handover-filter-asset", "handover-filter-type"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", filterHandovers);
    document.getElementById(id).addEventListener("change", filterHandovers);
  });

  ["reassignment-filter-document", "reassignment-filter-origin-user", "reassignment-filter-destination-user", "reassignment-filter-asset"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", filterReassignments);
    document.getElementById(id).addEventListener("change", filterReassignments);
  });

  ["reception-filter-document", "reception-filter-asset", "reception-filter-origin", "reception-filter-status"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", filterReceptions);
    document.getElementById(id).addEventListener("change", filterReceptions);
  });

  ["lab-filter-document", "lab-filter-asset", "lab-filter-priority", "lab-filter-status"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", filterLabQueue);
    document.getElementById(id).addEventListener("change", filterLabQueue);
  });

  ["people-filter-name", "people-filter-email", "people-filter-area", "people-filter-status"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", filterPeople);
    document.getElementById(id).addEventListener("change", filterPeople);
  });

  ["system-user-filter-name", "system-user-filter-email", "system-user-filter-role", "system-user-filter-status"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", filterSystemUsers);
    document.getElementById(id).addEventListener("change", filterSystemUsers);
  });

}

function setupReassignmentWorkspace() {
  const workspace = document.getElementById("reassignment-workspace");
  const listPanel = document.getElementById("reassignment-list-panel");
  const filtersPanel = document.getElementById("reassignment-filters-panel");
  const stats = document.getElementById("reassignment-kpi-grid");
  const backButton = document.getElementById("reassignment-back-button");
  const saveButton = document.getElementById("reassignment-save-button");
  const originInput = document.getElementById("reassignment-record-origin-user");
  const destinationInput = document.getElementById("reassignment-record-destination-user");
  const assetSelect = document.getElementById("reassignment-record-asset");
  const assetAddButton = document.getElementById("reassignment-asset-add");
  const originToggle = document.getElementById("reassignment-origin-toggle");
  const destinationToggle = document.getElementById("reassignment-destination-toggle");
  const formToggle = document.getElementById("reassignment-form-toggle");
  function openWorkspace(mode, reassignmentId) { renderReassignmentDetail(reassignmentId, mode); workspace.classList.add("is-active"); listPanel.classList.add("is-hidden"); filtersPanel.classList.add("is-hidden"); stats.classList.add("is-hidden"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function closeWorkspace() { workspace.classList.remove("is-active"); listPanel.classList.remove("is-hidden"); filtersPanel.classList.remove("is-hidden"); stats.classList.remove("is-hidden"); currentReassignmentWorkspaceId = null; currentReassignmentWorkspaceMode = "create"; currentReassignmentDocument = ""; }
  function toggleStaticSection(toggleId, contentId, expandLabel, collapseLabel) { const content = document.getElementById(contentId); if (!content) return; const collapsed = !content.classList.contains("is-collapsed"); setHandoverSectionCollapse(toggleId, contentId, collapsed, expandLabel, collapseLabel); }
  function addAssetToWorkspace(assetCode) { if (!assetCode) return; const asset = mockData.assets.find(function (item) { return item.code === assetCode; }); if (!asset || currentReassignmentAssetState.items.some(function (item) { return item.assetCode === assetCode; })) return; currentReassignmentAssetState.items.push({ assetCode: asset.code, assetName: asset.name, collapsed: false, checklistSections: [] }); renderSelectedReassignmentAssets(); }
  function addChecklistToAsset(assetCode, checklistId) { const assetItem = currentReassignmentAssetState.items.find(function (item) { return item.assetCode === assetCode; }); const definition = getHandoverChecklistDefinition(checklistId); if (!assetItem || !definition || !checklistId || assetItem.checklistSections.some(function (section) { return section.id === checklistId; })) return; assetItem.checklistSections.push({ id: checklistId, collapsed: false, answers: {} }); renderSelectedReassignmentAssets(); }
  function collectReassignmentWorkspaceValues() { const originUser = getReassignmentUserByInput("reassignment-record-origin-user"); const destinationUser = getReassignmentUserByInput("reassignment-record-destination-user"); const selectedAssets = currentReassignmentAssetState.items.map(function (item) { return { assetCode: item.assetCode, assetName: item.assetName, collapsed: item.collapsed, checklistSections: item.checklistSections.map(function (section) { return { id: section.id, collapsed: section.collapsed, answers: Object.assign({}, section.answers) }; }) }; }); const firstAsset = selectedAssets[0] || null; return { document: currentReassignmentDocument || getNextReassignmentDocument(), generatedAt: document.getElementById("reassignment-record-generated-at").value, date: (document.getElementById("reassignment-record-generated-at").value || "").split("T")[0], reason: document.getElementById("reassignment-record-reason").value.trim(), notes: document.getElementById("reassignment-record-notes").value.trim(), assetCode: firstAsset ? firstAsset.assetCode : "", assetName: firstAsset ? firstAsset.assetName : "", originUser: originUser ? originUser.name : "", originUserIdentifier: originUser ? originUser.identifier : "", destinationUser: destinationUser ? destinationUser.name : "", destinationUserIdentifier: destinationUser ? destinationUser.identifier : "", owner: document.getElementById("reassignment-record-owner").value.trim(), status: document.getElementById("reassignment-record-status").value, selectedAssets: selectedAssets }; }
  document.addEventListener("click", function (event) { const createButton = event.target.closest(".js-reassignment-create"); const editButton = event.target.closest(".js-reassignment-detail"); if (createButton) { if (!canWriteAppModule("reassignment")) return; openWorkspace("create"); return; } if (editButton) { if (!canViewAppModule("reassignment")) return; openWorkspace("edit", editButton.dataset.reassignmentId); } });
  backButton.addEventListener("click", closeWorkspace); originToggle.addEventListener("click", function () { toggleStaticSection("reassignment-origin-toggle", "reassignment-origin-content", "Expandir usuario origen", "Colapsar usuario origen"); }); destinationToggle.addEventListener("click", function () { toggleStaticSection("reassignment-destination-toggle", "reassignment-destination-content", "Expandir usuario destino", "Colapsar usuario destino"); }); formToggle.addEventListener("click", function () { toggleStaticSection("reassignment-form-toggle", "reassignment-form-content", "Expandir datos de emision", "Colapsar datos de emision"); }); originInput.addEventListener("input", renderReassignmentOriginSummary); originInput.addEventListener("change", renderReassignmentOriginSummary); destinationInput.addEventListener("input", renderReassignmentDestinationSummary); destinationInput.addEventListener("change", renderReassignmentDestinationSummary); assetAddButton.addEventListener("click", function () { addAssetToWorkspace(assetSelect.value); }); assetSelect.addEventListener("change", function () { assetAddButton.disabled = !assetSelect.value; });
  document.addEventListener("click", function (event) { const assetToggleButton = event.target.closest(".js-reassignment-asset-toggle"); const toggleButton = event.target.closest(".js-reassignment-checklist-toggle"); const assetRemoveButton = event.target.closest(".js-reassignment-asset-remove"); const removeButton = event.target.closest(".js-reassignment-checklist-remove"); const assetChecklistAddButton = event.target.closest(".js-reassignment-asset-checklist-add"); if (assetToggleButton) { const assetItem = currentReassignmentAssetState.items.find(function (item) { return item.assetCode === assetToggleButton.dataset.assetCode; }); if (!assetItem) return; assetItem.collapsed = !assetItem.collapsed; renderSelectedReassignmentAssets(); return; } if (toggleButton) { const assetItem = currentReassignmentAssetState.items.find(function (item) { return item.assetCode === toggleButton.dataset.assetCode; }); const section = assetItem ? assetItem.checklistSections.find(function (item) { return item.id === toggleButton.dataset.checklistId; }) : null; if (!section) return; section.collapsed = !section.collapsed; renderSelectedReassignmentAssets(); return; } if (assetRemoveButton) { currentReassignmentAssetState.items = currentReassignmentAssetState.items.filter(function (item) { return item.assetCode !== assetRemoveButton.dataset.assetCode; }); renderSelectedReassignmentAssets(); return; } if (assetChecklistAddButton) { const selector = document.querySelector(`[data-reassignment-asset-checklist-selector="${assetChecklistAddButton.dataset.assetCode}"]`); addChecklistToAsset(assetChecklistAddButton.dataset.assetCode, selector ? selector.value : ""); return; } if (!removeButton) return; const assetItem = currentReassignmentAssetState.items.find(function (item) { return item.assetCode === removeButton.dataset.assetCode; }); if (!assetItem) return; assetItem.checklistSections = assetItem.checklistSections.filter(function (item) { return item.id !== removeButton.dataset.checklistId; }); renderSelectedReassignmentAssets(); });
  document.addEventListener("input", function (event) { const input = event.target.closest("[data-reassignment-check-input='true']"); if (!input) return; const assetItem = currentReassignmentAssetState.items.find(function (item) { return item.assetCode === input.dataset.assetCode; }); const section = assetItem ? assetItem.checklistSections.find(function (item) { return item.id === input.dataset.checklistId; }) : null; if (!section) return; if (input.type === "checkbox") { section.answers[input.dataset.checkId] = input.checked; return; } if (input.type === "radio") { if (input.checked) section.answers[input.dataset.checkId] = input.value; return; } section.answers[input.dataset.checkId] = input.value; });
  document.addEventListener("change", function (event) { const input = event.target.closest("[data-reassignment-check-input='true']"); if (!input || input.type !== "radio") return; const assetItem = currentReassignmentAssetState.items.find(function (item) { return item.assetCode === input.dataset.assetCode; }); const section = assetItem ? assetItem.checklistSections.find(function (item) { return item.id === input.dataset.checklistId; }) : null; if (section && input.checked) section.answers[input.dataset.checkId] = input.value; });
  saveButton.addEventListener("click", function () { if (!canWriteAppModule("reassignment")) return; const payload = collectReassignmentWorkspaceValues(); if (!payload.document || !payload.date || !payload.selectedAssets.length || !payload.originUser || !payload.destinationUser || !payload.owner) return; if (currentReassignmentWorkspaceMode === "edit" && currentReassignmentWorkspaceId) { const existingRecord = getReassignmentRecords().find(function (item) { return item.id === currentReassignmentWorkspaceId; }); if (!existingRecord) return; Object.assign(existingRecord, payload); } else { if (!Array.isArray(mockData.reassignments)) mockData.reassignments = []; mockData.reassignments.unshift(Object.assign({ id: "reassignment-" + Date.now() }, payload)); } renderReassignment(); filterReassignments(); closeWorkspace(); });
}
document.addEventListener("DOMContentLoaded", function () {
  renderDashboard();
  renderHandover();
  renderReassignment();
  renderReception();
  populateLabRecordSelects();
  renderLabQueue();
  renderAssetsOverview();
  renderAssetFilters();
  renderAssetsTable(mockData.assets);
  renderDevices();
  renderPeople();
  renderPeopleDetail(mockData.users[0].id);
  renderSystemUsers();
  renderSystemUserDetail(mockData.systemUsers[0].id);
  renderReports();
  setupNavigation();
  setupGlobalSearch();
  setupCurrentUserSelector();
  setupTabs();
  setupSidebar();
  setupBackToTop();
  setupBrandModal();
  setupPeopleWorkspace();
  setupSystemUsersWorkspace();
  setupMailTestModal();
  setupCmdbSettings();
  renderAllChecklistSettings();
  setupChecklistSettings();
  setupReportsWorkspace();
  setupHandoverWorkspace();
  setupReassignmentWorkspace();
  setupReceptionWorkspace();
  setupLabWorkspace();
  setupDevicesModule();
  setupLabEvidencePreviewModal();
  setupAssetsWorkspace();
  setupInteractiveTables();
  setupSortableTables();
});















