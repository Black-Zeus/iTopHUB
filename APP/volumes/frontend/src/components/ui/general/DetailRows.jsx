export function DetailRows({ items = [], loading = false, columns = 2 }) {
  const resolvedColumns = columns === 2 ? 2 : 1;
  const itemsPerColumn = Math.ceil(items.length / resolvedColumns);
  const columnSets = Array.from({ length: resolvedColumns }, (_, index) =>
    items.slice(index * itemsPerColumn, (index + 1) * itemsPerColumn)
  );

  return (
    <div className={`grid gap-x-8 ${columns === 2 ? "md:grid-cols-2" : ""}`}>
      {columnSets.map((columnItems, columnIndex) => (
        <div key={`detail-column-${columnIndex}`} className="grid gap-y-4">
          {columnItems.map((item) => (
            <div
              key={`${columnIndex}-${item.label}`}
              className={`grid grid-cols-[9rem_minmax(0,1fr)] items-start gap-3 border-b border-[rgba(255,255,255,0.05)] pb-3 ${loading ? "animate-pulse" : ""}`}
            >
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {item.label}
              </span>
              <span className="min-w-0">
                <span className="break-words text-sm font-medium text-[var(--text-primary)]">
                  {item.value}
                </span>
                {item.alert ? (
                  <span className="mt-1 inline-flex items-center gap-2 text-xs font-semibold text-[var(--warning)]">
                    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" aria-hidden="true">
                      <path
                        d="M12 9v4m0 4h.01M10.29 3.86 1.82 18A2 2 0 0 0 3.55 21h16.9a2 2 0 0 0 1.73-3l-8.47-14.14a2 2 0 0 0-3.42 0Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {item.alert}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
