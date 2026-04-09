import { createElement, useEffect, useMemo, useRef, useState } from "react";
import ModalManager from "@/components/ui/modal";
import { AuthRevalidationModal } from "@hooks/useAuthRevalidationModal";
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

      modalId = ModalManager.custom({
        title: "Reactivar token de iTop",
        size: "medium",
        showFooter: false,
        closeOnOverlayClick: false,
        closeOnEscape: false,
        content: createElement(AuthRevalidationModal, {
          title: "Reactivar token personal",
          message:
            "Esta accion requiere usar tu token personal de iTop. Confirma tu contrasena para volver a cargarlo temporalmente en esta sesion.",
          onCancel: () => {
            ModalManager.close(modalId);
            reject(new Error("La revalidacion del token fue cancelada."));
          },
          onSubmit: async (password) => {
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
              throw new Error(message);
            }
          },
        }),
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
