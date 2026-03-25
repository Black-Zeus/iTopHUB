import { Panel, PanelHeader } from "../../components/ui/general/Panel";

export function LabPage() {
  return (
    <Panel>
      <PanelHeader eyebrow="Laboratorio" title="Registro Técnico" />
      <p className="text-sm text-[var(--text-muted)]">Módulo en construcción.</p>
    </Panel>
  );
}