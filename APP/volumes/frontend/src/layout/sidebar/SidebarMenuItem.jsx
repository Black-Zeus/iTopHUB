/**
 * SidebarMenuItem - item individual del nav.
 */
export function SidebarMenuItem({ label, icon, active = false, collapsed = false, onClick }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center overflow-hidden whitespace-nowrap rounded-[14px] border py-[0.7rem] text-left transition-[background,border-color,color,padding] duration-200 ${
        active
          ? "border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-primary)]"
          : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)]"
      } ${
        collapsed ? "justify-center gap-0 px-0 min-h-[44px]" : "gap-3 px-[0.9rem]"
      }`}
    >
      <span className={`inline-flex items-center justify-center text-[var(--accent-strong)] ${collapsed ? "h-6 w-6 flex-[0_0_24px]" : "h-5 w-5 flex-[0_0_20px]"}`} aria-hidden="true">
        {icon}
      </span>
      <span
        className="inline-block min-w-0 flex-[0_1_auto] text-[0.93rem] font-medium transition-[opacity,transform,width,margin] duration-200"
        style={collapsed ? { opacity: 0, transform: "translateX(-10px)", width: 0, margin: 0, pointerEvents: "none" } : undefined}
      >
        {label}
      </span>
    </button>
  );
}
