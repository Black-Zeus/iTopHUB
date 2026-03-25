import { KpiCard }   from "../../components/ui/general/KpiCard";
import { Panel, PanelHeader } from "../../components/ui/general/Panel";

const KPI_DATA = [
  { label: "Activos registrados", value: "—",  helper: "Sin datos aún",    tone: "default" },
  { label: "Entregas activas",    value: "—",  helper: "Sin datos aún",    tone: "default" },
  { label: "En laboratorio",      value: "—",  helper: "Con revisión",     tone: "warning" },
  { label: "Pendientes",          value: "—",  helper: "Con acción",       tone: "danger"  },
];

export function DashboardPage() {
  return (
    <div className="grid gap-5">

      {/* KPIs — fila ancha */}
      <div className="col-span-full grid grid-cols-4 gap-4">
        {KPI_DATA.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Grid de paneles */}
      <div className="grid grid-cols-2 gap-5">
        <Panel>
          <PanelHeader eyebrow="Actividad reciente" title="Últimas actas" />
          <p className="text-sm text-[var(--text-muted)]">
            Las actas más recientes aparecerán aquí una vez conectado el backend.
          </p>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Estado del sistema" title="Servicios" />
          <div className="grid gap-3">
            {[
              { name: "iTop",      status: "ok"   },
              { name: "DB local",  status: "ok"   },
              { name: "API Hub",   status: "warn" },
            ].map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">{s.name}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    s.status === "ok"   ? "bg-[var(--success)]" :
                    s.status === "warn" ? "bg-[var(--warning)]" :
                                          "bg-[var(--danger)]"
                  }`}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>

    </div>
  );
}