import { useState } from "react";
import { Spinner } from "../ui";

/**
 * DataTable — tabla de datos reutilizable
 *
 * columns: [{ key, label, sortable?, render? }]
 * rows: array de objetos
 */
export function DataTable({ columns = [], rows = [], loading = false, emptyMessage = "Sin resultados" }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const va = a[sortKey] ?? "";
        const vb = b[sortKey] ?? "";
        const cmp = String(va).localeCompare(String(vb), "es", { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : rows;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="border-b border-[var(--border-color)] px-3 py-3 text-left text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]"
              >
                {col.sortable ? (
                  <button
                    onClick={() => handleSort(col.key)}
                    className="inline-flex items-center gap-1 bg-transparent border-0 p-0 font-[inherit] text-[inherit] uppercase tracking-[inherit] cursor-pointer hover:text-[var(--text-secondary)]"
                  >
                    {col.label}
                    <span className="text-[var(--accent-strong)] text-[0.8rem]">
                      {sortKey === col.key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center">
                <Spinner className="mx-auto" />
              </td>
            </tr>
          ) : sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-10 text-center text-sm text-[var(--text-muted)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr key={row.id ?? i} className="hover:bg-[var(--bg-hover)] transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="border-b border-[var(--border-color)] px-3 py-3 text-sm text-[var(--text-secondary)] align-top"
                  >
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}