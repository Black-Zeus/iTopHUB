import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function HeaderSearch() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form onSubmit={handleSubmit}>
      <label
        className="flex min-w-[300px] items-center gap-3 rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-2 text-[var(--text-muted)] transition-[border-color] duration-200 focus-within:border-[var(--accent-strong)]"
        aria-label="Búsqueda global"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
          className="flex-shrink-0" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Activo, usuario, acta o serie…"
          autoComplete="off"
          className="w-full border-0 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
      </label>
    </form>
  );
}