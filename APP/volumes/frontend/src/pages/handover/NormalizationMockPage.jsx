import { KpiCard, Panel, PanelHeader } from "../../components/ui/general";
import { Button } from "../../ui/Button";
import { MessageBanner } from "./handover-editor-shared";

const MOCK_KPIS = [
  { label: "Mockups listos", value: "01", helper: "Vista inicial publicada", tone: "default" },
  { label: "Flujos activos", value: "00", helper: "Sin operaciones habilitadas aun", tone: "warning" },
  { label: "Checklist base", value: "01", helper: "Catalogo inicial disponible", tone: "success" },
];

export function NormalizationMockPage() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 xl:grid-cols-3">
        {MOCK_KPIS.map((item) => (
          <KpiCard key={item.label} {...item} />
        ))}
      </div>

      <Panel wide className="grid gap-6">
        <PanelHeader
          eyebrow="Mockup"
          title="Actas de Normalizacion"
          helper="Esta vista deja visible el nuevo menu y el espacio funcional para la futura implementacion del flujo."
        />

        <MessageBanner>
          El flujo operativo de normalizacion aun no esta habilitado. Por ahora quedan preparados el menu, la ruta y el catalogo de checklist asociado para continuar en una siguiente fase.
        </MessageBanner>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Propuesta de alcance</h3>
            <div className="mt-4 grid gap-3 text-sm text-[var(--text-secondary)]">
              <p>Permitir seleccionar activos candidatos a normalizacion.</p>
              <p>Documentar criterio, responsable y observaciones tecnicas del proceso.</p>
              <p>Emitir una version documental propia cuando el flujo definitivo sea aprobado.</p>
            </div>
          </section>

          <section className="rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Estado actual</h3>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Menu y breadcrumb disponibles.
              </div>
              <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Checklist de tipo normalizacion disponible en administracion.
              </div>
              <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Sin creacion, emision ni confirmacion habilitadas por ahora.
              </div>
            </div>
          </section>
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" disabled>
            Proximamente
          </Button>
        </div>
      </Panel>
    </div>
  );
}
