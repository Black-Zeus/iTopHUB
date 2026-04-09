import { useState } from "react";

function PasswordPrompt({ title, message, busy, error, onSubmit, onCancel }) {
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    await onSubmit(password);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-secondary)]">
        <p className="font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="mt-2">{message}</p>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-[var(--text-primary)]">Contrasena de iTop</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none"
        />
      </label>

      {error ? (
        <div className="rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
          {error}
        </div>
      ) : null}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-primary)] disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || !password}
          className="rounded-full bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Validando..." : "Confirmar"}
        </button>
      </div>
    </div>
  );
}

export function AuthRevalidationModal({ title, message, onSubmit, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (password) => {
    setBusy(true);
    setError("");

    try {
      await onSubmit(password);
    } catch (submitError) {
      setError(submitError?.message || "No fue posible revalidar el token personal.");
      setBusy(false);
    }
  };

  return (
    <PasswordPrompt
      title={title}
      message={message}
      busy={busy}
      error={error}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    />
  );
}
