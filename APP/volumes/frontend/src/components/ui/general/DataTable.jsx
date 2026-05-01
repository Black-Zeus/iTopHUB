import { useEffect, useMemo, useState } from "react";
import { Spinner } from "../../../ui";

/**
 * DataTable — tabla de datos reutilizable
 *
 * columns: [{ key, label, sortable?, render?, headerClassName?, cellClassName? }]
 * rows: array de objetos
 */
export function DataTable({
  columns = [],
  rows = [],
  loading = false,
  emptyMessage = "Sin resultados",
  pagination = false,
  pageSize = 30,
  paginationAlwaysVisible = false,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(
    () => (sortKey
      ? [...rows].sort((a, b) => {
          const va = a[sortKey] ?? "";
          const vb = b[sortKey] ?? "";
          const cmp = String(va).localeCompare(String(vb), "es", { numeric: true });
          return sortDir === "asc" ? cmp : -cmp;
        })
      : rows),
    [rows, sortDir, sortKey],
  );

  const safePageSize = Math.max(1, Number(pageSize) || 30);
  const totalPages = Math.max(1, Math.ceil(sorted.length / safePageSize));
  const paginatedRows = pagination
    ? sorted.slice((currentPage - 1) * safePageSize, (currentPage - 1) * safePageSize + safePageSize)
    : sorted;
  const startRow = sorted.length === 0 ? 0 : ((currentPage - 1) * safePageSize) + 1;
  const endRow = pagination ? Math.min(currentPage * safePageSize, sorted.length) : sorted.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [rows, sortKey, sortDir, safePageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`border-b border-[var(--border-color)] px-3 py-3 align-middle text-left text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)] ${col.headerClassName || ""}`}
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
              paginatedRows.map((row, i) => (
                <tr key={row.id ?? i} className="hover:bg-[var(--bg-hover)] transition-colors">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`border-b border-[var(--border-color)] px-3 py-3 align-middle text-sm text-[var(--text-secondary)] ${col.cellClassName || ""}`}
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

      {(pagination && (paginationAlwaysVisible || sorted.length > safePageSize || sorted.length > 0)) ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[var(--text-muted)]">
            {loading
              ? "Cargando registros..."
              : sorted.length === 0
                ? "Mostrando 0 resultados"
                : `Mostrando ${startRow} - ${endRow} de ${sorted.length} resultados`}
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="rounded-full border border-[var(--border-color)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={loading || currentPage === 1}
            >
              Anterior
            </button>
            <span className="min-w-[7rem] text-center text-sm font-semibold text-[var(--text-primary)]">
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              className="rounded-full border border-[var(--border-color)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={loading || currentPage === totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
