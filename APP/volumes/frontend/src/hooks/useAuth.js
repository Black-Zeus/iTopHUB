import { useEffect, useMemo, useRef, useState } from "react";
import ModalManager from "@/components/ui/modal";
import {
  authenticateUser,
  configureAuthSessionHandlers,
  keepAliveCurrentSession,
  logoutCurrentSession,
  refreshCurrentSession,
  restoreUserSession,
  revalidateCurrentToken,
} from "@services/auth-session-service";
import { ApiError } from "@services/api-client";


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


export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [warningSeconds, setWarningSeconds] = useState(30);

  const warningModalOpenRef = useRef(false);
  const revalidationPromiseRef = useRef(null);

  const applySession = (session) => {
    setUser(session?.user ?? null);
    setExpiresAt(session?.expiresAt ?? null);
    setWarningSeconds(session?.warningSeconds ?? 30);
    return session;
  };

  const clearSession = () => {
    setUser(null);
    setExpiresAt(null);
    setWarningSeconds(30);
  };

  const logout = async () => {
    try {
      await logoutCurrentSession();
    } catch {
      // El backend puede haber expirado la sesion. Igual limpiamos cliente.
    }
    clearSession();
  };

  const refreshSession = async () => {
    const session = await refreshCurrentSession();
    return applySession(session);
  };

  const keepSessionAlive = async () => {
    const session = await keepAliveCurrentSession();
    return applySession(session);
  };

  const requestRuntimeTokenRevalidation = async () => {
    if (revalidationPromiseRef.current) {
      return revalidationPromiseRef.current;
    }

    revalidationPromiseRef.current = new Promise((resolve, reject) => {
      let modalId = null;

      function RevalidationModal() {
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState("");

        const handleCancel = () => {
          ModalManager.close(modalId);
          reject(new Error("La revalidacion del token fue cancelada."));
        };

        const handleSubmit = async (password) => {
          setBusy(true);
          setError("");
          try {
            const session = await revalidateCurrentToken(password);
            applySession(session);
            ModalManager.close(modalId);
            resolve(session);
          } catch (submitError) {
            const message =
              submitError instanceof ApiError
                ? submitError.message
                : submitError?.message || "No fue posible revalidar el token personal.";
            setError(message);
            setBusy(false);
          }
        };

        return (
          <PasswordPrompt
            title="Reactivar token personal"
            message="Esta accion requiere usar tu token personal de iTop. Confirma tu contrasena para volver a cargarlo temporalmente en esta sesion."
            busy={busy}
            error={error}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        );
      }

      modalId = ModalManager.custom({
        title: "Reactivar token de iTop",
        size: "medium",
        showFooter: false,
        closeOnOverlayClick: false,
        closeOnEscape: false,
        content: <RevalidationModal />,
        onClose: () => reject(new Error("La revalidacion del token fue cancelada.")),
      });
    }).finally(() => {
      revalidationPromiseRef.current = null;
    });

    return revalidationPromiseRef.current;
  };

  useEffect(() => {
    configureAuthSessionHandlers({
      onRuntimeTokenPrompt: requestRuntimeTokenRevalidation,
      onSessionExpired: async () => {
        clearSession();
      },
    });
  }, []);

  useEffect(() => {
    let active = true;

    const boot = async () => {
      try {
        const session = await restoreUserSession();
        if (active) {
          applySession(session);
        }
      } catch (error) {
        if (active) {
          clearSession();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    boot();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user || !expiresAt) {
      warningModalOpenRef.current = false;
      return undefined;
    }

    const expireAtMs = new Date(expiresAt).getTime();
    const warningAtMs = expireAtMs - (warningSeconds * 1000);
    const delay = Math.max(warningAtMs - Date.now(), 0);

    const timerId = window.setTimeout(async () => {
      if (warningModalOpenRef.current) {
        return;
      }

      warningModalOpenRef.current = true;
      try {
        const keepAlive = await ModalManager.confirm({
          title: "La sesion esta por vencer",
          message: "Tu sesion expirara en menos de 30 segundos. Confirma si sigues activo para extenderla por otras 4 horas.",
          confirmText: "Seguir activo",
          cancelText: "Cerrar sesion",
          closeOnOverlayClick: false,
          closeOnEscape: false,
        });

        if (keepAlive) {
          await keepSessionAlive();
        } else {
          await logout();
        }
      } catch {
        await logout();
      } finally {
        warningModalOpenRef.current = false;
      }
    }, delay);

    return () => window.clearTimeout(timerId);
  }, [user, expiresAt, warningSeconds]);

  const login = async (credentials) => {
    const session = await authenticateUser(credentials);
    return applySession(session);
  };

  const authState = useMemo(
    () => ({
      user,
      expiresAt,
      warningSeconds,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
      refreshSession,
      keepSessionAlive,
      requestRuntimeTokenRevalidation,
    }),
    [
      user,
      expiresAt,
      warningSeconds,
      loading,
      login,
      logout,
      refreshSession,
      keepSessionAlive,
      requestRuntimeTokenRevalidation,
    ]
  );

  return authState;
}
