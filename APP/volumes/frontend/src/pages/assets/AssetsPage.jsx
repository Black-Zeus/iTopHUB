import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../../components/ui/general/DataTable";
import { DetailRows } from "../../components/ui/general/DetailRows";
import { FilterDropdown } from "../../components/ui/general/FilterDropdown";
import { Panel, PanelHeader } from "../../components/ui/general/Panel";
import { SearchFilterInput } from "../../components/ui/general/SearchFilterInput";
import { StatusChip, normalizeStatus } from "../../components/ui/general/StatusChip";
import { Button } from "../../ui/Button";
import { Icon } from "../../components/ui/icon/Icon";
import ModalManager from "../../components/ui/modal";
import { openPersonModal } from "../people/PeoplePage";
import { getItopAssetCatalog, getItopAssetDetail, searchItopAssets } from "../../services/assets-service";
import { getSettings } from "../../services/settings-service";
import { downloadRowsAsCsv } from "../../utils/export-csv";

const CMDB_FIELD_ORDER = [
  "Estado",
  "Organizacion",
  "Ubicacion",
  "Tipo",
  "Marca",
  "Modelo",
  "Numero de activo",
  "Numero de serie",
  "Sistema operativo",
  "Procesador",
  "RAM",
  "Numero",
  "Puesto en produccion",
  "Compra",
  "Garantia",
  "Descripcion",
  "Clase",
];

const RESOURCE_FIELD_LABELS = new Set([
  "Sistema operativo",
  "Procesador",
  "RAM",
]);

const ASSET_FILTER_CONTROL_HEIGHT = "h-[66px]";


function sortCmdbFields(fields = []) {
  const orderMap = new Map(CMDB_FIELD_ORDER.map((label, index) => [label, index]));
  return [...fields].sort((left, right) => {
    const leftIndex = orderMap.has(left.label) ? orderMap.get(left.label) : Number.MAX_SAFE_INTEGER;
    const rightIndex = orderMap.has(right.label) ? orderMap.get(right.label) : Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return String(left.label).localeCompare(String(right.label));
  });
}


function formatAssignmentDate(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}


function getHistoryBadgeClassName(action) {
  if (action === "Agregado") {
    return "bg-[rgba(127,191,156,0.14)] text-[var(--success)]";
  }
  if (action === "Creado") {
    return "bg-[rgba(81,152,194,0.14)] text-[var(--accent-strong)]";
  }
  return "bg-[rgba(210,138,138,0.14)] text-[var(--danger)]";
}


function downloadAssetsCsv(rows) {
  const header = [
    "Codigo",
    "Clase",
    "Nombre",
    "Marca",
    "Modelo",
    "Serie",
    "Usuario asignado",
    "Fecha garantia",
    "Estado",
  ];

  const csvRows = rows.map((row) => [
    row.code || "",
    row.className || "",
    row.name || "",
    row.brand || "",
    row.model || "",
    row.serial || "",
    Array.isArray(row.assignedUsers)
      ? row.assignedUsers.map((contact) => contact.name || "").filter(Boolean).join(", ")
      : row.assignedUser || "",
    row.warrantyDate || "",
    row.status || "",
  ]);

  downloadRowsAsCsv({
    filename: "activos_cmdb.csv",
    header,
    rows: csvRows,
  });
}


function renderAssetFilterSelection({ label, selectedOptions }) {
  return (
    <>
      <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="mt-1 flex min-h-[1.75rem] flex-wrap items-center gap-2">
        {selectedOptions.length === 0 ? (
          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
            Todos
          </span>
        ) : selectedOptions.length <= 2 ? (
          selectedOptions.map((option) => (
            <span
              key={option.value}
              className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]"
            >
              {option.label}
            </span>
          ))
        ) : (
          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
            {selectedOptions.length} seleccionados
          </span>
        )}
      </span>
    </>
  );
}


function getAssetFilterOptionClassName(_, isActive) {
  return isActive
    ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
    : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]";
}


function AssetDetailModalContent({ row }) {
  const [activeTab, setActiveTab] = useState("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const item = await getItopAssetDetail(row.id);
        if (!cancelled) {
          setDetail(item);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "No fue posible cargar el detalle del activo.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [row.id]);

  const tabs = [
    { id: "summary", label: "Resumen" },
    { id: "contacts", label: "Personas relacionadas" },
    { id: "history", label: "Historial" },
  ];
  const contactItems = detail?.contacts ?? [];
  const historyItems = detail?.contactHistory ?? [];
  const summaryItems = loading
    ? [
        { label: "Codigo", value: "Cargando..." },
        { label: "Nombre", value: "Cargando..." },
        { label: "Clase", value: "Cargando..." },
        { label: "Estado", value: "Cargando..." },
      ]
    : [
        { label: "Codigo", value: detail?.code || "Sin dato" },
        { label: "Nombre", value: detail?.name || "Sin dato" },
        { label: "Clase", value: detail?.className || "Sin dato" },
        { label: "Estado", value: detail?.status || "Sin dato" },
      ];
  const orderedFields = sortCmdbFields(detail?.fields ?? []);
  const generalFields = orderedFields.filter((field) => !RESOURCE_FIELD_LABELS.has(field.label));
  const resourceFields = orderedFields.filter((field) => RESOURCE_FIELD_LABELS.has(field.label));

  return (
    <div className="flex h-[640px] flex-col overflow-hidden p-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
                  : "border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-5">
        {error ? (
          <div className="rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
            {error}
          </div>
        ) : null}

        {activeTab === "summary" ? (
          <section className="rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-app)] px-5 py-5 shadow-[var(--shadow-subtle)]">
            <div className="mb-4 border-b border-[rgba(255,255,255,0.05)] pb-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Activo CMDB
              </p>
              <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                {loading ? row.name : detail?.name || row.name}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {loading ? "Cargando detalle..." : detail?.className || row.className}
              </p>
            </div>

            <DetailRows items={summaryItems} loading={loading} columns={2} />

            {generalFields.length > 0 ? (
              <div className="mt-6 border-t border-[var(--border-color)] pt-5">
                <p className="mb-4 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Informacion general
                </p>
                <DetailRows items={generalFields} loading={loading} columns={2} />
              </div>
            ) : null}

            {resourceFields.length > 0 ? (
              <div className="mt-6 border-t border-[var(--border-color)] pt-5">
                <p className="mb-4 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Recursos
                </p>
                <DetailRows items={resourceFields} loading={loading} columns={2} />
              </div>
            ) : null}
          </section>
        ) : activeTab === "contacts" ? (
          <div className="rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-app)] shadow-[var(--shadow-subtle)]">
            {loading ? (
              Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={`contacts-loading-${index}`}
                  className="border-b border-[var(--border-color)] px-5 py-4 last:border-b-0 animate-pulse"
                >
                  <div className="h-4 w-48 rounded-full bg-[var(--bg-hover)]" />
                  <div className="mt-2 h-3 w-28 rounded-full bg-[var(--bg-hover)]" />
                </div>
              ))
            ) : null}

            {!loading && contactItems.length === 0 ? (
              <div className="p-5 text-sm text-[var(--text-secondary)]">
                Este activo no tiene personas relacionadas en iTop.
              </div>
            ) : null}

            {!loading
              ? contactItems.map((contact) => (
                  <div
                    key={contact.id}
                    className="border-b border-[var(--border-color)] px-5 py-4 last:border-b-0"
                  >
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-[var(--text-primary)]">{contact.name}</p>
                        <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
                          {contact.role || "Sin cargo registrado"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                          Correo
                        </p>
                        <p className="mt-1 truncate text-sm text-[var(--text-primary)]">
                          {contact.email || "Sin correo"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                          Asignacion
                        </p>
                        <p className="mt-1 truncate text-sm text-[var(--text-primary)]">
                          {contact.assignedAt ? formatAssignmentDate(contact.assignedAt) : "Sin fecha disponible"}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                          {contact.assignedBy ? `Por ${contact.assignedBy}` : "Usuario no disponible"}
                        </p>
                      </div>
                      <div className="flex items-center md:justify-end">
                        <StatusChip status={contact.status} />
                      </div>
                    </div>
                  </div>
                ))
              : null}
          </div>
        ) : (
          <div className="rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-app)] shadow-[var(--shadow-subtle)]">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`history-loading-${index}`}
                  className="border-b border-[var(--border-color)] px-5 py-4 last:border-b-0 animate-pulse"
                >
                  <div className="h-4 w-56 rounded-full bg-[var(--bg-hover)]" />
                  <div className="mt-2 h-3 w-36 rounded-full bg-[var(--bg-hover)]" />
                </div>
              ))
            ) : null}

            {!loading && historyItems.length === 0 ? (
              <div className="p-5 text-sm text-[var(--text-secondary)]">
                Este activo no tiene historial de asignaciones o remociones de personas en iTop.
              </div>
            ) : null}

            {!loading
              ? historyItems.map((entry) => (
                  <div
                    key={`${entry.id}-${entry.contactId}`}
                    className="border-b border-[var(--border-color)] px-5 py-4 last:border-b-0"
                  >
                    <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] md:items-start">
                      <div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getHistoryBadgeClassName(entry.action)}`}
                        >
                          {entry.action}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {entry.contactName}
                        </p>
                        <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
                          {entry.contactEmail || entry.contactRole || entry.contactStatus || "Sin detalle adicional"}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                          {entry.contactStatus ? `Estado ${entry.contactStatus}` : "Estado no disponible"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {formatAssignmentDate(entry.changedAt)}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                          {entry.changedBy ? `Por ${entry.changedBy}` : "Usuario no disponible"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              : null}
          </div>
        )}
      </div>
    </div>
  );
}


function openAssetModal(row) {
  ModalManager.custom({
    title: `Activo: ${row.name}`,
    size: "personDetail",
    showFooter: false,
    showHeader: true,
    content: <AssetDetailModalContent row={row} />,
  });
}


export function AssetsPage() {
  const [draftFilters, setDraftFilters] = useState({
    query: "",
    className: [],
    brand: [],
    model: [],
    assignedUser: [],
    serial: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    query: "",
    className: [],
    brand: [],
    model: [],
    assignedUser: [],
    serial: "",
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enabledClassOptions, setEnabledClassOptions] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [brandCatalog, setBrandCatalog] = useState([]);
  const [modelCatalog, setModelCatalog] = useState([]);
  const [assignedUserCatalog, setAssignedUserCatalog] = useState([]);

  const columns = useMemo(
    () => [
      { key: "code", label: "Codigo", sortable: true },
      { key: "className", label: "Clase", sortable: true },
      { key: "name", label: "Nombre", sortable: true },
      { key: "brandModel", label: "Marca / Modelo", sortable: true },
      { key: "serial", label: "Serie", sortable: true },
      {
        key: "assignedUser",
        label: "Usuario asignado",
        sortable: true,
        render: (_, row) => {
          const contacts = Array.isArray(row.assignedUsers) ? row.assignedUsers : [];
          if (contacts.length === 0) {
            return "Sin asignar";
          }

          return (
            <div className="flex flex-wrap gap-1.5">
              {contacts.map((contact) => (
                <button
                  key={`${row.id}-${contact.id}-${contact.name}`}
                  type="button"
                  onClick={() =>
                    openPersonModal({
                      id: contact.id,
                      person: contact.name,
                    })
                  }
                  className="inline-flex rounded-full border border-[rgba(81,152,194,0.2)] bg-[rgba(81,152,194,0.08)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)] transition hover:bg-[rgba(81,152,194,0.16)]"
                >
                  {contact.name}
                </button>
              ))}
            </div>
          );
        },
      },
      { key: "warrantyDate", label: "Fecha garantia", sortable: true },
      {
        key: "status",
        label: "Estado",
        render: (value) => <StatusChip status={value} />,
      },
      {
        key: "action",
        label: "Acciones",
        render: (_, row) => (
          <Button type="button" variant="secondary" size="sm" onClick={() => openAssetModal(row)}>
            <Icon name="eye" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Ver
          </Button>
        ),
      },
    ],
    []
  );

  const classOptions = useMemo(
    () => [
      { value: "all", label: "Todas" },
      ...enabledClassOptions.map((value) => ({
        value,
        label: value,
      })),
    ],
    [enabledClassOptions]
  );

  const brandOptions = useMemo(() => {
    const availableBrands = brandCatalog.filter((item) => {
      if (draftFilters.className.length === 0) {
        return true;
      }
      return item.classes?.some((className) => draftFilters.className.includes(className));
    });

    return [
      { value: "all", label: "Todas" },
      ...availableBrands.map((item) => ({
        value: item.name,
        label: item.name,
      })),
    ];
  }, [brandCatalog, draftFilters.className]);

  const modelOptions = useMemo(() => {
    const availableModels = modelCatalog.filter((item) => {
      const matchesClass =
        draftFilters.className.length === 0 ||
        item.classes?.some((className) => draftFilters.className.includes(className));
      if (draftFilters.brand.length === 0) {
        return matchesClass;
      }
      return matchesClass && draftFilters.brand.includes(item.brandName);
    });

    return [
      { value: "all", label: "Todos" },
      ...availableModels.map((item) => ({
        value: item.name,
        label: item.name,
      })),
    ];
  }, [draftFilters.brand, draftFilters.className, modelCatalog]);

  const assignedUserOptions = useMemo(
    () => [
      { value: "all", label: "Todos" },
      ...assignedUserCatalog.map((item) => ({
        value: item.name,
        label: item.name,
      })),
    ],
    [assignedUserCatalog]
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = appliedFilters.query.trim().toLowerCase();
    const normalizedSerial = appliedFilters.serial.trim().toLowerCase();

    return rows.filter((row) => {
      const haystack = [
        row.code,
        row.className,
        row.name,
        row.brandModel,
        row.brand,
        row.model,
        row.serial,
        row.assignedUser,
        row.warrantyDate,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
      const matchesClass = appliedFilters.className.length === 0 || appliedFilters.className.includes(row.className);
      const matchesBrand = appliedFilters.brand.length === 0 || appliedFilters.brand.includes(row.brand);
      const matchesModel = appliedFilters.model.length === 0 || appliedFilters.model.includes(row.model);
      const matchesAssignedUser =
        appliedFilters.assignedUser.length === 0 ||
        appliedFilters.assignedUser.some((value) =>
          String(row.assignedUser || "")
            .split(",")
            .map((item) => item.trim())
            .includes(value)
        );
      const matchesSerial =
        normalizedSerial.length === 0 || String(row.serial || "").toLowerCase().includes(normalizedSerial);

      return (
        matchesQuery &&
        matchesClass &&
        matchesBrand &&
        matchesModel &&
        matchesAssignedUser &&
        matchesSerial
      );
    });
  }, [appliedFilters, rows]);

  const hasFiltersApplied = useMemo(
    () =>
      Boolean(
        appliedFilters.query.trim() ||
        appliedFilters.className.length ||
        appliedFilters.brand.length ||
        appliedFilters.model.length ||
        appliedFilters.assignedUser.length ||
        appliedFilters.serial.trim()
      ),
    [appliedFilters]
  );

  const loadAssets = async (query = "") => {
    setLoading(true);
    setError("");

    try {
      const items = await searchItopAssets({ query });
      setRows(items);
    } catch (loadError) {
      setRows([]);
      setError(loadError.message || "No fue posible consultar activos en iTop.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadFilterCatalogs = async () => {
      try {
        const [catalogPayload, settingsPayload] = await Promise.all([
          getItopAssetCatalog(),
          getSettings(),
        ]);
        if (!cancelled) {
          setBrandCatalog(catalogPayload?.brands || []);
          setModelCatalog(catalogPayload?.models || []);
          setAssignedUserCatalog(catalogPayload?.assignedUsers || []);
          setEnabledClassOptions(settingsPayload?.panels?.cmdb?.enabledAssetTypes || []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "No fue posible cargar los catalogos de filtros.");
        }
      }
    };

    loadFilterCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleReset = () => {
    const emptyAdvancedFilters = {
      className: [],
      brand: [],
      model: [],
      assignedUser: [],
      serial: "",
    };
    setDraftFilters((current) => ({
      ...current,
      ...emptyAdvancedFilters,
    }));
    setAppliedFilters((current) => ({
      ...current,
      ...emptyAdvancedFilters,
    }));
    setRows([]);
    setHasSearched(false);
    setError("");
  };

  const handleApplyFilters = async (event) => {
    event.preventDefault();
    setAppliedFilters(draftFilters);
    setHasSearched(true);
    await loadAssets(draftFilters.query);
  };

  const toggleFilterValue = (key, value, selectionMode = "multiple") => {
    if (value === "all") {
      setDraftFilters((current) => ({ ...current, [key]: [] }));
      return;
    }

    setDraftFilters((current) => {
      const currentValues = current[key];

      if (selectionMode === "single") {
        return {
          ...current,
          [key]: currentValues.includes(value) ? [] : [value],
        };
      }

      return {
        ...current,
        [key]: currentValues.includes(value)
          ? currentValues.filter((item) => item !== value)
          : [...currentValues, value],
      };
    });
  };

  useEffect(() => {
    const validBrandValues = new Set(brandOptions.map((option) => option.value));
    const validModelValues = new Set(modelOptions.map((option) => option.value));
    const validAssignedUserValues = new Set(assignedUserOptions.map((option) => option.value));

    setDraftFilters((current) => {
      const nextBrand = current.brand.filter((value) => validBrandValues.has(value));
      const nextModel = current.model.filter((value) => validModelValues.has(value));
      const nextAssignedUsers = current.assignedUser.filter((value) => validAssignedUserValues.has(value));

      if (
        nextBrand.length === current.brand.length &&
        nextModel.length === current.model.length &&
        nextAssignedUsers.length === current.assignedUser.length
      ) {
        return current;
      }

      return {
        ...current,
        brand: nextBrand,
        model: nextModel,
        assignedUser: nextAssignedUsers,
      };
    });
  }, [assignedUserOptions, brandOptions, modelOptions]);

  const topRowAdvancedFilters = ["className"];
  const secondRowAdvancedFilters = ["brand", "model", "assignedUser", "serial"];
  const renderAdvancedFilter = (filterKey) => {
    if (filterKey === "className") {
      return (
        <FilterDropdown
          label="Clase"
          selectedValues={draftFilters.className}
          options={classOptions}
          selectionMode="single"
          onToggleOption={(value) => toggleFilterValue("className", value, "single")}
          onClear={() => setDraftFilters((current) => ({ ...current, className: [] }))}
          triggerClassName="py-3"
          buttonHeightClassName={ASSET_FILTER_CONTROL_HEIGHT}
          menuOffsetClassName="top-[calc(100%+0.55rem)]"
          menuClassName="rounded-[18px]"
          renderSelection={renderAssetFilterSelection}
          renderOptionLeading={() => (
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
          )}
          renderOptionDescription={(option) =>
            option.value === "all" ? "Sin restriccion aplicada" : "Selecciona una clase"
          }
          getOptionClassName={getAssetFilterOptionClassName}
        />
      );
    }

    if (filterKey === "brand") {
      return (
        <FilterDropdown
          label="Marca"
          selectedValues={draftFilters.brand}
          options={brandOptions}
          selectionMode="single"
          onToggleOption={(value) => toggleFilterValue("brand", value, "single")}
          onClear={() => setDraftFilters((current) => ({ ...current, brand: [] }))}
          triggerClassName="py-3"
          buttonHeightClassName={ASSET_FILTER_CONTROL_HEIGHT}
          menuOffsetClassName="top-[calc(100%+0.55rem)]"
          menuClassName="rounded-[18px]"
          renderSelection={renderAssetFilterSelection}
          renderOptionLeading={() => (
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
          )}
          renderOptionDescription={(option) =>
            option.value === "all" ? "Sin restriccion aplicada" : "Selecciona una marca"
          }
          getOptionClassName={getAssetFilterOptionClassName}
        />
      );
    }

    if (filterKey === "model") {
      return (
        <FilterDropdown
          label="Modelo"
          selectedValues={draftFilters.model}
          options={modelOptions}
          selectionMode="multiple"
          onToggleOption={(value) => toggleFilterValue("model", value, "multiple")}
          onClear={() => setDraftFilters((current) => ({ ...current, model: [] }))}
          triggerClassName="py-3"
          buttonHeightClassName={ASSET_FILTER_CONTROL_HEIGHT}
          menuOffsetClassName="top-[calc(100%+0.55rem)]"
          menuClassName="rounded-[18px]"
          renderSelection={renderAssetFilterSelection}
          renderOptionLeading={() => (
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
          )}
          renderOptionDescription={(option) =>
            option.value === "all" ? "Sin restriccion aplicada" : "Combina este valor con otros"
          }
          getOptionClassName={getAssetFilterOptionClassName}
        />
      );
    }

    if (filterKey === "assignedUser") {
      return (
        <FilterDropdown
          label="Usuario"
          selectedValues={draftFilters.assignedUser}
          options={assignedUserOptions}
          selectionMode="single"
          onToggleOption={(value) => toggleFilterValue("assignedUser", value, "single")}
          onClear={() => setDraftFilters((current) => ({ ...current, assignedUser: [] }))}
          triggerClassName="py-3"
          buttonHeightClassName={ASSET_FILTER_CONTROL_HEIGHT}
          menuOffsetClassName="top-[calc(100%+0.55rem)]"
          menuClassName="rounded-[18px]"
          renderSelection={renderAssetFilterSelection}
          renderOptionLeading={() => (
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />
          )}
          renderOptionDescription={(option) =>
            option.value === "all" ? "Sin restriccion aplicada" : "Filtra por display name"
          }
          getOptionClassName={getAssetFilterOptionClassName}
        />
      );
    }

    if (filterKey === "serial") {
      return (
        <SearchFilterInput
          value={draftFilters.serial}
          onChange={(event) => setDraftFilters((current) => ({ ...current, serial: event.target.value }))}
          placeholder="Numero de serie"
        />
      );
    }

    return null;
  };

  return (
    <div className="grid gap-5">
      {error ? (
        <div className="rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
          {error}
        </div>
      ) : null}

      <Panel>
        <form className="grid gap-4" onSubmit={handleApplyFilters}>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="grid gap-3">
              <div className="grid gap-3 xl:grid-cols-3">
                <div className="min-w-0 xl:col-span-2">
                  <SearchFilterInput
                    value={draftFilters.query}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, query: event.target.value }))}
                    placeholder="Nombre objeto, codigo, marca, modelo, persona asociada"
                  />
                </div>

                {topRowAdvancedFilters.map((filterKey) => (
                  <div key={`advanced-top-${filterKey}`} className="min-w-0">
                    {renderAdvancedFilter(filterKey)}
                  </div>
                ))}
              </div>

              <div className="grid gap-3 xl:grid-cols-4">
                {secondRowAdvancedFilters.map((filterKey) => (
                  <div key={`advanced-bottom-${filterKey}`} className="min-w-0">
                    {renderAdvancedFilter(filterKey)}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-center gap-3 xl:w-[12rem]">
              <div className="grid gap-3 xl:grid-cols-1">
                <Button
                  type="submit"
                  variant="primary"
                  className={`${ASSET_FILTER_CONTROL_HEIGHT} w-full`}
                  aria-label={loading ? "Buscando" : "Buscar"}
                  title={loading ? "Buscando" : "Buscar"}
                >
                  <Icon name="search" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Buscar
                </Button>
              </div>

              <Button
                type="button"
                variant="secondary"
                className={`${ASSET_FILTER_CONTROL_HEIGHT} w-full`}
                onClick={handleReset}
                aria-label="Limpiar filtros"
                title="Limpiar filtros"
              >
                <Icon name="filterClear" size={14} className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
                Limpiar filtros
              </Button>
            </div>
          </div>
        </form>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="Consulta CMDB"
          title="Activos"
          actions={filteredRows.length ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadAssetsCsv(filteredRows)}
            >
              <Icon name="download" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Descargar Excel
            </Button>
          ) : null}
        />

        <DataTable
          columns={columns}
          rows={filteredRows}
          loading={loading}
          emptyMessage={
            !hasSearched
              ? "El listado parte vacio. Define un filtro y presiona Enter o Filtrar."
              : hasFiltersApplied
              ? "No hay activos que coincidan con los filtros actuales."
              : "No hay activos CMDB visibles con la configuracion actual."
          }
        />
      </Panel>
    </div>
  );
}
