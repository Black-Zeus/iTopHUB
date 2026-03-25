/**
 * SidebarToggle - boton flotante para colapsar o expandir el sidebar.
 */
export function SidebarToggle({ collapsed, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
      className={`fixed top-5 z-[200] grid h-11 w-11 place-items-center rounded-[14px] border border-[var(--border-strong)] bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-[var(--shadow-soft)] transition-[left,transform,background] duration-[250ms] ease-in-out hover:-translate-y-px max-[768px]:hidden ${
        collapsed ? "left-[72px]" : "left-[240px]"
      } max-[1024px]:left-[72px]`}
    >
      <span
        className="inline-block leading-none transition-transform duration-[250ms] ease-in-out"
        style={{ transform: collapsed ? "rotate(180deg)" : "none" }}
        aria-hidden="true"
      >
        <svg className="block h-[18px] w-[18px]" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
