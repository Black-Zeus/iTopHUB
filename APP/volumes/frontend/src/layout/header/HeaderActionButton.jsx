import { Button } from "../../ui";

/**
 * HeaderActionButton — botón de acción primaria contextual en el topbar.
 * Cada página puede inyectar su propio botón via Context o props.
 */
export function HeaderActionButton({ label, onClick, disabled = false }) {
  if (!label) return null;

  return (
    <Button variant="primary" size="sm" onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
}