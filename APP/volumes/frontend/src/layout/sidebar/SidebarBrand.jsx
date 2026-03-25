/**
 * SidebarBrand - logo + nombre del sistema.
 */
export function SidebarBrand({ collapsed }) {
  return (
    <div className="brand-block">
      <div className="brand-trigger" aria-hidden="true">
        <div className="brand-mark">IH</div>
        <div
          className="brand-copy"
          style={collapsed ? { opacity: 0, transform: "translateX(-10px)", width: 0, pointerEvents: "none" } : undefined}
        >
          <p className="brand-eyebrow">Gestión TI</p>
          <h1 className="brand-title">iTop Hub</h1>
        </div>
      </div>
    </div>
  );
}
