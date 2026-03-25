/**
 * SidebarMenuGroup - agrupacion semantica de items del nav.
 */
export function SidebarMenuGroup({ label, children, collapsed = false }) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <p
          className="overflow-hidden px-[0.95rem] text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] transition-[opacity,height] duration-200"
          style={collapsed ? { opacity: 0, height: 0, pointerEvents: "none" } : { opacity: 1, height: "auto" }}
        >
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
}
