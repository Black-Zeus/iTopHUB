/**
 * SidebarToggle — botón flotante para colapsar/expandir el sidebar
 * Se posiciona de forma fixed relativo al sidebar.
 */
export function SidebarToggle({ collapsed, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
      style={{ left: collapsed ? "72px" : "240px" }}
      className="fixed top-5 z-[200] flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--border-strong)] bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-[var(--shadow-soft)] transition-[left] duration-[250ms] ease-in-out hover:-translate-y-px"
    >
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.25"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }}
      >
        <path d="M14.5 5.5L8 12l6.5 6.5" />
      </svg>
    </button>
  );
}