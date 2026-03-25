import { useState } from "react";
import { useNavigate } from "react-router-dom";

const searchIconClass =
  "[&_circle]:fill-none [&_circle]:stroke-current [&_circle]:stroke-[1.9] [&_circle]:stroke-linecap-round [&_circle]:stroke-linejoin-round [&_path]:fill-none [&_path]:stroke-current [&_path]:stroke-[1.9] [&_path]:stroke-linecap-round [&_path]:stroke-linejoin-round";

export function HeaderSearch() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = query.trim();

    if (value) {
      navigate(`/search?q=${encodeURIComponent(value)}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="min-w-0 max-[768px]:flex-[1_1_100%]">
      <label className="flex min-w-[320px] items-center gap-3 rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-[0.8rem] text-[var(--text-muted)] transition-[border-color,background] duration-200 focus-within:border-[var(--accent-strong)] max-[1024px]:min-w-[260px] max-[768px]:w-full max-[768px]:min-w-0" aria-label="Busqueda global">
        <span className="whitespace-nowrap text-[0.82rem]">Buscar</span>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          className={`shrink-0 ${searchIconClass}`}
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Activo, usuario, acta o serie..."
          autoComplete="off"
          className="min-w-0 w-full border-0 bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
      </label>
    </form>
  );
}
