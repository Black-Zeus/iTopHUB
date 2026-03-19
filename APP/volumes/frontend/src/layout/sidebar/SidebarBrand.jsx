/**
 * SidebarBrand — logo + nombre del sistema
 */
export function SidebarBrand({ collapsed }) {
  return (
    <div className="flex min-h-[72px] items-center gap-4">
      {/* Marca / logo */}
      <div className="relative z-[1] flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-[20px] border border-white/20 bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-lg font-bold text-white shadow-[0_10px_22px_rgba(81,152,194,0.18)]">
        IH
        {/* anillo decorativo */}
        <span className="pointer-events-none absolute -z-[1] h-[72px] w-[72px] rounded-[24px] border border-[rgba(120,182,217,0.18)]" style={{ transform: "rotate(10deg)" }} />
      </div>

      {/* Texto */}
      <div
        className="overflow-hidden transition-[opacity,transform,width] duration-[220ms] ease-in-out"
        style={collapsed ? { opacity: 0, transform: "translateX(-10px)", width: 0, pointerEvents: "none" } : { opacity: 1, transform: "none", width: "auto" }}
      >
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Gestión TI
        </p>
        <h1 className="text-base font-bold text-[var(--text-primary)]">iTop Hub</h1>
      </div>
    </div>
  );
}