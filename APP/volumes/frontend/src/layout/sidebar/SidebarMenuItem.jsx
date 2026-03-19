/**
 * SidebarMenuItem — item individual del nav
 * Acepta un icono SVG como children.
 */
export function SidebarMenuItem({ to, label, icon, active = false, collapsed = false, onClick }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={[
        "flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-[14px] border px-[0.95rem] py-[0.82rem] text-left transition-[background,border-color,color,padding] duration-200",
        active
          ? "border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-primary)]"
          : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)]",
        collapsed ? "justify-center" : "",
      ].join(" ")}
    >
      {/* Icono */}
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[var(--accent-strong)]"
        aria-hidden="true"
      >
        {icon}
      </span>

      {/* Label */}
      <span
        className="flex-shrink-0 text-sm font-medium transition-[opacity,transform,width,margin] duration-200"
        style={collapsed
          ? { opacity: 0, transform: "translateX(-10px)", width: 0, margin: 0, pointerEvents: "none" }
          : { opacity: 1, transform: "none", width: "auto" }
        }
      >
        {label}
      </span>
    </button>
  );
}