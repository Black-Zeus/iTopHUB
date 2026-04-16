import { createElement, useEffect, useMemo, useRef, useState } from "react";
import ModalManager from "@/components/ui/modal";
import { AuthRevalidationModal, SessionExpiryWarningModal } from "@hooks/useAuthRevalidationModal";
import {
  authenticateUser,
  bootstrapFirstAdminUser,
  configureAuthSessionHandlers,
  keepAliveCurrentSession,
  logoutCurrentSession,
  refreshCurrentSession,
  restoreUserSession,
  revalidateCurrentToken,
} from "@services/auth-session-service";
import { ApiError } from "@services/api-client";

const SESSION_WARNING_EARLY_BUFFER_SECONDS = 10;

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
    if (Number.isNaN(expireAtMs)) {
      warningModalOpenRef.current = false;
      return undefined;
    }

    const normalizedWarningSeconds = Math.max(1, Number(warningSeconds) || 30);
    const warningAtMs = expireAtMs - ((normalizedWarningSeconds + SESSION_WARNING_EARLY_BUFFER_SECONDS) * 1000);
    const delay = Math.max(warningAtMs - Date.now(), 0);
    let modalId = null;

    const timerId = window.setTimeout(async () => {
      if (warningModalOpenRef.current) {
        return;
      }

      warningModalOpenRef.current = true;
      modalId = ModalManager.custom({
        title: "La sesion esta por vencer",
        size: "medium",
        showFooter: false,
        showCloseButton: false,
        closeOnOverlayClick: false,
        closeOnEscape: false,
        content: createElement(SessionExpiryWarningModal, {
          title: "La sesion esta por vencer",
          message:
            "Tu sesion esta por terminar. Si sigues activo, extiendela ahora para evitar interrupciones o errores de reingreso al limite del vencimiento.",
          autoCloseSeconds: normalizedWarningSeconds,
          sessionExpiresAtMs: expireAtMs,
          onExtend: async () => {
            await keepSessionAlive();
            if (modalId) {
              ModalManager.close(modalId);
            }
          },
          onLogoutNow: async () => {
            await logout();
            if (modalId) {
              ModalManager.close(modalId);
            }
          },
          onExpire: async () => {
            await logout();
            if (modalId) {
              ModalManager.close(modalId);
            }
          },
        }),
        onClose: () => {
          warningModalOpenRef.current = false;
          modalId = null;
        },
      });
    }, delay);

    return () => {
      window.clearTimeout(timerId);
      if (modalId) {
        ModalManager.close(modalId);
      }
      warningModalOpenRef.current = false;
    };
  }, [user, expiresAt, warningSeconds]);

  const login = async (credentials) => {
    const session = await authenticateUser(credentials);
    return applySession(session);
  };

  const bootstrapFirstAdmin = async (payload) => {
    const session = await bootstrapFirstAdminUser(payload);
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
      bootstrapFirstAdmin,
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
      bootstrapFirstAdmin,
      logout,
      refreshSession,
      keepSessionAlive,
      requestRuntimeTokenRevalidation,
    ]
  );

  return authState;
}
