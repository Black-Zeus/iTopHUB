import { useEffect, useMemo, useRef, useState } from "react";

const SESSION_WARNING_TICK_MS = 100;

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function buildCountdownDeadline(autoCloseSeconds, sessionExpiresAtMs) {
  const now = Date.now();
  const requestedDeadline = now + (autoCloseSeconds * 1000);

  if (!Number.isFinite(sessionExpiresAtMs)) {
    return requestedDeadline;
  }

  return Math.max(now, Math.min(requestedDeadline, sessionExpiresAtMs));
}

function PasswordPrompt({ title, message, busy, error, onSubmit, onCancel }) {
  const [password, setPassword] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit(password);
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
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
          type="submit"
          disabled={busy || !password}
          className="rounded-full bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Validando..." : "Confirmar"}
        </button>
      </div>
    </form>
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

export function SessionExpiryWarningModal({
  title,
  message,
  autoCloseSeconds = 30,
  sessionExpiresAtMs,
  onExtend,
  onLogoutNow,
  onExpire,
}) {
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");

  const countdownDeadlineMs = useMemo(
    () => buildCountdownDeadline(autoCloseSeconds, sessionExpiresAtMs),
    [autoCloseSeconds, sessionExpiresAtMs]
  );
  const countdownDurationMs = useMemo(
    () => Math.max(1, countdownDeadlineMs - Date.now()),
    [countdownDeadlineMs]
  );
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, countdownDeadlineMs - Date.now()));
  const expireTriggeredRef = useRef(false);
  const openedWithSeconds = useMemo(
    () => Math.max(0, Math.ceil(Math.max(0, countdownDeadlineMs - Date.now()) / 1000)),
    [countdownDeadlineMs]
  );

  useEffect(() => {
    expireTriggeredRef.current = false;
    setRemainingMs(Math.max(0, countdownDeadlineMs - Date.now()));

    const timerId = window.setInterval(() => {
      const nextRemainingMs = Math.max(0, countdownDeadlineMs - Date.now());
      setRemainingMs(nextRemainingMs);

      if (nextRemainingMs > 0 || expireTriggeredRef.current) {
        return;
      }

      expireTriggeredRef.current = true;
      window.clearInterval(timerId);
      void onExpire?.();
    }, SESSION_WARNING_TICK_MS);

    return () => window.clearInterval(timerId);
  }, [countdownDeadlineMs, onExpire]);

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const progressPercent = Math.max(0, Math.min(100, (remainingMs / countdownDurationMs) * 100));

  const handleExtend = async () => {
    setBusyAction("extend");
    setError("");

    try {
      await onExtend?.();
    } catch (actionError) {
      setError(actionError?.message || "No fue posible extender la sesion.");
      setBusyAction("");
    }
  };

  const handleLogoutNow = async () => {
    setBusyAction("logout");
    setError("");

    try {
      await onLogoutNow?.();
    } catch (actionError) {
      setError(actionError?.message || "No fue posible cerrar la sesion.");
      setBusyAction("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-secondary)]">
        <p className="font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="mt-2">{message}</p>
      </div>

      <div className="rounded-[22px] border border-[rgba(210,138,138,0.38)] bg-[rgba(210,138,138,0.12)] px-5 py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Cierre automatico
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--text-primary)]">
              {formatCountdown(remainingSeconds)}
            </p>
          </div>
          <span className="inline-flex min-w-[64px] justify-center rounded-full bg-[rgba(210,138,138,0.2)] px-3 py-2 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
            {remainingSeconds}s
          </span>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[rgba(255,255,255,0.18)]">
          <div
            className="h-full rounded-full bg-[var(--accent-strong)] transition-[width] duration-100 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="mt-3 text-sm text-[var(--text-primary)]">
          La sesion se cerrara automaticamente en {openedWithSeconds} segundos si no confirmas actividad.
        </p>
      </div>

      {error ? (
        <div className="rounded-[18px] border border-[rgba(210,138,138,0.45)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-sm text-[var(--text-primary)]">
          {error}
        </div>
      ) : null}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={handleLogoutNow}
          disabled={!!busyAction}
          className="rounded-full border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-primary)] disabled:opacity-60"
        >
          {busyAction === "logout" ? "Cerrando..." : "Cerrar sesion ahora"}
        </button>
        <button
          type="button"
          onClick={handleExtend}
          disabled={!!busyAction}
          className="rounded-full bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busyAction === "extend" ? "Extendiendo..." : "Seguir activo"}
        </button>
      </div>
    </div>
  );
}
