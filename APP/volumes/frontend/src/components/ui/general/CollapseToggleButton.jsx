export function CollapseToggleButton({ isCollapsed, onClick, collapsedLabel, expandedLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--border-strong)] bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-[var(--shadow-subtle)] transition-transform ${
        isCollapsed ? "" : "rotate-180"
      }`}
      title={isCollapsed ? collapsedLabel : expandedLabel}
      aria-label={isCollapsed ? collapsedLabel : expandedLabel}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
        <path
          d="M7 10l5 5 5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
