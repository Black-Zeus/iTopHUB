import { useEffect, useMemo, useState } from "react";
import { DataTable } from "../../components/ui/general/DataTable";
import { CollapseToggleButton } from "../../components/ui/general/CollapseToggleButton";
import { KpiCard } from "../../components/ui/general/KpiCard";
import { Panel, PanelHeader } from "../../components/ui/general/Panel";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Icon } from "../../components/ui/icon/Icon";
import ModalManager from "../../components/ui/modal";
import { Button } from "../../ui/Button";
import { getItopPersonDetail, searchItopPeople } from "../../services/people-service";

function buildPeopleKpis(rows) {
  return [
    {
      label: "Total personas",
      value: String(rows.length).padStart(2, "0"),
      helper: "Resultado actual",
      tone: "default",
    },
    {
      label: "Activas",
      value: String(rows.filter((row) => row.status.toLowerCase() === "active").length).padStart(2, "0"),
      helper: "Estado iTop activo",
      tone: "success",
    },
    {
      label: "Con correo",
      value: String(rows.filter((row) => row.asset).length).padStart(2, "0"),
      helper: "Dato disponible",
      tone: "warning",
    },
    {
      label: "Con cargo",
      value: String(rows.filter((row) => row.role).length).padStart(2, "0"),
      helper: "Funcion registrada",
      tone: "danger",
    },
  ];
}


function DetailRows({ items = [], loading = false, columns = 2 }) {
  const resolvedColumns = columns === 2 ? 2 : 1;
  const itemsPerColumn = Math.ceil(items.length / resolvedColumns);
  const columnSets = Array.from({ length: resolvedColumns }, (_, index) =>
    items.slice(index * itemsPerColumn, (index + 1) * itemsPerColumn)
  );

  return (
    <div className={`grid gap-x-8 ${columns === 2 ? "md:grid-cols-2" : ""}`}>
      {columnSets.map((columnItems, columnIndex) => (
        <div key={`detail-column-${columnIndex}`} className="grid gap-y-4">
          {columnItems.map((item) => (
            <div
              key={`${columnIndex}-${item.label}`}
              className={`grid grid-cols-[9rem_minmax(0,1fr)] items-start gap-3 border-b border-[rgba(255,255,255,0.05)] pb-3 ${loading ? "animate-pulse" : ""}`}
            >
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {item.label}
              </span>
              <span className="min-w-0">
                <span className="break-words text-sm font-medium text-[var(--text-primary)]">
                  {item.value}
                </span>
                {item.alert ? (
                  <span className="mt-1 inline-flex items-center gap-2 text-xs font-semibold text-[var(--warning)]">
                    <Icon name="warning" size={12} className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {item.alert}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}


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


function getCmdbHeaderMeta(item) {
  const typeField = Array.isArray(item.fields) ? item.fields.find((field) => field.label === "Tipo") : null;
  const classLabel = item.className ? `Clase ${item.className}` : "";
  const typeLabel = typeField?.value ? `Tipo ${typeField.value}` : "";

  return [classLabel, typeLabel].filter(Boolean).join(" - ");
}


function PersonDetailModalContent({ row }) {
  const [activeTab, setActiveTab] = useState("summary");
  const [expandedCmdbId, setExpandedCmdbId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const item = await getItopPersonDetail(row.id);
        if (!cancelled) {
          setDetail(item);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "No fue posible cargar el detalle de la persona.");
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
    { id: "cmdb", label: "Objetos CMDB" },
  ];
  const cmdbItems = detail?.cmdbItems ?? [];
  const summaryItems = loading
    ? [
        { label: "Codigo", value: "Cargando..." },
        { label: "Nombre", value: "Cargando..." },
        { label: "Correo", value: "Cargando..." },
        { label: "Telefono", value: "Cargando..." },
        { label: "Cargo", value: "Cargando..." },
        { label: "Organizacion", value: "Cargando..." },
        { label: "Localidad", value: "Cargando..." },
        { label: "Jefatura", value: "Cargando..." },
        { label: "Estado", value: "Cargando..." },
      ]
    : [
        { label: "Codigo", value: detail?.code || "Sin dato" },
        { label: "Nombre", value: detail?.person || "Sin dato" },
        { label: "Correo", value: detail?.asset || "Sin dato" },
        { label: "Telefono", value: detail?.phone || "Sin dato" },
        { label: "Cargo", value: detail?.role || "Sin dato" },
        { label: "Organizacion", value: detail?.organization || "Sin dato" },
        { label: "Localidad", value: detail?.location || "Sin dato" },
        { label: "Jefatura", value: detail?.manager || "Sin dato" },
        { label: "Estado", value: detail?.status || "Sin dato" },
      ];

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
                Persona
              </p>
              <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                {loading ? row.person : detail?.person || row.person}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {loading ? "Cargando detalle..." : detail?.asset || "Sin correo registrado"}
              </p>
            </div>

            <DetailRows items={summaryItems} loading={loading} columns={2} />
          </section>
        ) : (
          <div className="grid gap-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <article
                  key={`cmdb-loading-${index}`}
                  className="overflow-hidden rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-app)] shadow-[var(--shadow-subtle)] animate-pulse"
                >
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="h-4 w-48 rounded-full bg-[var(--bg-hover)]" />
                      <div className="mt-2 h-3 w-28 rounded-full bg-[var(--bg-hover)]" />
                    </div>
                    <div className="h-8 w-20 rounded-full bg-[var(--bg-hover)]" />
                  </div>
                </article>
              ))
            ) : null}

            {cmdbItems.length === 0 ? (
              <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5 text-sm text-[var(--text-secondary)]">
                Esta persona no tiene objetos CMDB asociados en iTop.
              </div>
            ) : !loading ? (
              cmdbItems.map((item) => {
                const isExpanded = expandedCmdbId === item.id;
                const sortedFields = sortCmdbFields(item.fields);
                const headerMeta = getCmdbHeaderMeta(item);
                return (
                  <article
                    key={`${item.className}-${item.id}`}
                    className="overflow-hidden rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-app)] shadow-[var(--shadow-subtle)]"
                  >
                    <div className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--bg-hover)]">
                      <button
                        type="button"
                        onClick={() => setExpandedCmdbId((current) => (current === item.id ? null : item.id))}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-base font-semibold uppercase text-[var(--text-primary)]">
                          {item.name}
                        </p>
                        <p className="mt-1 text-xs tracking-[0.04em] text-[var(--text-muted)]">
                          {headerMeta || "Clase no informada"}
                        </p>
                      </button>

                      <div className="inline-flex items-center gap-3">
                        <span className="rounded-full border border-[rgba(81,152,194,0.18)] bg-[rgba(81,152,194,0.1)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                          {item.code}
                        </span>
                        <CollapseToggleButton
                          isCollapsed={!isExpanded}
                          onClick={() => {
                            setExpandedCmdbId((current) => (current === item.id ? null : item.id));
                          }}
                          collapsedLabel="Expandir objeto CMDB"
                          expandedLabel="Colapsar objeto CMDB"
                        />
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="border-t border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] px-5 py-4">
                        {Array.isArray(item.fields) && item.fields.length > 0 ? (
                          <DetailRows items={sortedFields} columns={2} />
                        ) : (
                          <p className="text-sm text-[var(--text-secondary)]">
                            <span className="font-semibold text-[var(--text-primary)]">Sin detalle:</span> Este objeto no expone mas datos relevantes.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}


function openPersonModal(row) {
  const modalId = ModalManager.custom({
    title: `Persona: ${row.person}`,
    size: "personDetail",
    showFooter: false,
    showHeader: true,
    content: <PersonDetailModalContent row={row} />,
  });
}


export function PeoplePage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const columns = useMemo(
    () => [
      { key: "code", label: "Codigo", sortable: true },
      { key: "person", label: "Nombre", sortable: true },
      { key: "asset", label: "Correo", sortable: true },
      { key: "phone", label: "Telefono", sortable: true },
      { key: "role", label: "Cargo", sortable: true },
      {
        key: "status",
        label: "Estado",
        render: (value) => <StatusChip status={value} />,
      },
      {
        key: "action",
        label: "Acciones",
        render: (_, row) => (
          <Button type="button" variant="secondary" size="sm" onClick={() => openPersonModal(row)}>
            <Icon name="eye" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Ver
          </Button>
        ),
      },
    ],
    []
  );

  const kpis = useMemo(() => buildPeopleKpis(rows), [rows]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setHasSearched(true);

    try {
      const items = await searchItopPeople({ query });
      setRows(items);
    } catch (searchError) {
      setRows([]);
      setError(searchError.message || "No fue posible consultar personas en iTop.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {error ? (
        <div className="rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
          {error}
        </div>
      ) : null}

      <Panel>
        <PanelHeader eyebrow="Consultas" title="Personas" />

        <form className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Filtro
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre y/o correo"
              className="h-[52px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </label>

          <div className="flex items-end">
            <Button type="submit" variant="primary" className="h-[52px] w-full lg:w-auto" disabled={loading}>
              <Icon name="search" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {loading ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </form>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyMessage={
            hasSearched
              ? "No se encontraron personas en iTop con los filtros enviados."
              : "El listado parte vacio. Escribe un filtro y presiona Enter o Buscar."
          }
        />
      </Panel>
    </div>
  );
}
