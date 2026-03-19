import { Panel, PanelHeader } from "../../components/Panel";

export function SettingsPage() {
  return (
    <Panel>
      <PanelHeader eyebrow="Sistema" title="Configuración" />
      <p className="text-sm text-[var(--text-muted)]">Módulo en construcción.</p>
    </Panel>
  );
}