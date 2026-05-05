import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Panel, PanelHeader } from "../../components/ui/general/Panel";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Icon } from "../../components/ui/icon/Icon";
import { Button } from "../../ui/Button";
import { searchHub } from "../../services/global-search-service";

const TYPE_ICONS = {
  handover: "fileLines",
  lab: "flask",
  user: "user",
};

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value || "-");
  return parsed.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function groupResults(items) {
  const groups = new Map();
  items.forEach((item) => {
    const label = item.type || "Resultado";
    const current = groups.get(label) || { label, items: [] };
    current.items.push(item);
    groups.set(label, current);
  });
  return Array.from(groups.values()).sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
}

function SearchResultCard({ item, onOpen }) {
  const iconName = TYPE_ICONS[item.kind] || "search";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid min-h-[126px] content-between gap-3 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4 text-left transition hover:border-[var(--accent-strong)] hover:bg-[var(--bg-hover)]"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-base font-bold text-[var(--text-primary)]">{item.title || "Sin titulo"}</span>
          <span className="mt-1 block truncate text-sm text-[var(--text-secondary)]">{item.subtitle || item.description || "-"}</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--accent-strong)]">
          <Icon name={iconName} size={16} className="h-4 w-4" />
        </span>
      </span>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <StatusChip status={item.status || "Sin estado"} />
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{formatDate(item.date)}</span>
      </span>
    </button>
  );
}

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(routeQuery);
  const [items, setItems] = useState([]);
  const [sources, setSources] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setQuery(routeQuery);
  }, [routeQuery]);

  useEffect(() => {
    let cancelled = false;
    async function runSearch() {
      const value = routeQuery.trim();
      setError("");
      if (value.length < 2) {
        setItems([]);
        setSources({});
        return;
      }
      setLoading(true);
      try {
        const payload = await searchHub({ query: value, limit: 50 });
        if (cancelled) return;
        setItems(payload.items || []);
        setSources(payload.sources || {});
      } catch (searchError) {
        if (cancelled) return;
        setItems([]);
        setSources({});
        setError(searchError.message || "No fue posible ejecutar la busqueda.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    runSearch();
    return () => {
      cancelled = true;
    };
  }, [routeQuery]);

  const groups = useMemo(() => groupResults(items), [items]);
  const totalSources = Number(sources.handover || 0) + Number(sources.lab || 0) + Number(sources.users || 0);

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = query.trim();
    if (value) {
      setSearchParams({ q: value });
    }
  };

  return (
    <div className="grid gap-5">
      <Panel>
        <PanelHeader
          eyebrow="Busqueda global"
          title="Buscar en la BD del Hub"
          actions={<span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">No consulta iTop</span>}
        />
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="flex min-w-0 items-center gap-3 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-[var(--text-muted)] focus-within:border-[var(--accent-strong)]">
            <Icon name="search" size={16} className="h-4 w-4 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Acta, activo, serie, usuario o correo registrado en el Hub"
              className="min-w-0 w-full border-0 bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </label>
          <Button type="submit">
            <Icon name="search" size={14} className="h-3.5 w-3.5" />
            Buscar
          </Button>
        </form>
      </Panel>

      <div className="grid gap-3 md:grid-cols-3">
        <Panel>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Actas operativas</p>
          <strong className="mt-2 block text-3xl text-[var(--text-primary)]">{String(sources.handover || 0).padStart(2, "0")}</strong>
        </Panel>
        <Panel>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Laboratorio</p>
          <strong className="mt-2 block text-3xl text-[var(--text-primary)]">{String(sources.lab || 0).padStart(2, "0")}</strong>
        </Panel>
        <Panel>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Usuarios Hub</p>
          <strong className="mt-2 block text-3xl text-[var(--text-primary)]">{String(sources.users || 0).padStart(2, "0")}</strong>
        </Panel>
      </div>

      <Panel>
        <PanelHeader eyebrow="Resultados" title={routeQuery ? `Coincidencias para "${routeQuery}"` : "Ingresa un termino"} />
        {loading ? (
          <div className="rounded-[14px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-6 text-sm text-[var(--text-muted)]">
            Buscando en la BD del Hub...
          </div>
        ) : error ? (
          <div className="rounded-[14px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.08)] px-4 py-4 text-sm font-semibold text-[var(--danger)]">
            {error}
          </div>
        ) : routeQuery.trim().length < 2 ? (
          <div className="rounded-[14px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-6 text-sm text-[var(--text-muted)]">
            Escribe al menos 2 caracteres para buscar registros internos del Hub.
          </div>
        ) : totalSources === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-6 text-sm text-[var(--text-muted)]">
            No se encontraron coincidencias visibles para tu perfil.
          </div>
        ) : (
          <div className="grid gap-5">
            {groups.map((group) => (
              <section key={group.label} className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{group.label}</h3>
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {group.items.length} resultado(s)
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {group.items.map((item) => (
                    <SearchResultCard key={item.id} item={item} onOpen={() => navigate(item.path)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
