/**
 * SidebarMenuGroup — agrupación semántica de items del nav
 * El label del grupo se oculta cuando el sidebar está colapsado.
 */
export function SidebarMenuGroup({ label, children, collapsed = false }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <p
          className="px-[0.95rem] text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] transition-[opacity,height] duration-200 overflow-hidden"
          style={collapsed ? { opacity: 0, height: 0, pointerEvents: "none" } : { opacity: 1, height: "auto" }}
        >
          {label}
        </p>
      )}
      {children}
    </div>
  );
}