import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
    <form onSubmit={handleSubmit} className="search-form">
      <label className="searchbox" aria-label="Búsqueda global">
        <span className="searchbox-label">Buscar</span>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="searchbox-icon"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Activo, usuario, acta o serie…"
          autoComplete="off"
          className="searchbox-input"
        />
      </label>
    </form>
  );
}
