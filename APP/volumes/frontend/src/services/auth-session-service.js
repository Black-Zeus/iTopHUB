import { apiRequest, setApiClientHandlers } from "@services/api-client";

let runtimeTokenPromptHandler = null;
let sessionExpiredHandler = null;

export function configureAuthSessionHandlers({ onRuntimeTokenPrompt, onSessionExpired } = {}) {
  runtimeTokenPromptHandler = onRuntimeTokenPrompt || null;
  sessionExpiredHandler = onSessionExpired || null;

  setApiClientHandlers({
    onTokenRevalidationRequired: async () => {
      if (!runtimeTokenPromptHandler) {
        throw new Error("No existe manejador para revalidar el token.");
      }
      await runtimeTokenPromptHandler();
    },
    onSessionExpired: async () => {
      if (sessionExpiredHandler) {
        await sessionExpiredHandler();
      }
    },
  });
}

export async function authenticateUser(credentials) {
  return apiRequest("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: credentials.username.trim(),
      password: credentials.password,
    }),
    fallbackMessage: "No fue posible iniciar sesion.",
  });
}

export async function restoreUserSession() {
  return apiRequest("/v1/auth/session", {
    fallbackMessage: "No fue posible recuperar la sesion.",
  });
}

export async function refreshCurrentSession() {
  return apiRequest("/v1/auth/session", {
    fallbackMessage: "No fue posible recargar la sesion.",
  });
}

export async function keepAliveCurrentSession() {
  return apiRequest("/v1/auth/keep-alive", {
    method: "POST",
    fallbackMessage: "No fue posible extender la sesion.",
  });
}

export async function revalidateCurrentToken(password) {
  return apiRequest("/v1/auth/revalidate", {
    method: "POST",
    body: JSON.stringify({ password }),
    fallbackMessage: "No fue posible revalidar el token personal.",
  });
}

export async function logoutCurrentSession() {
  return apiRequest("/v1/auth/logout", {
    method: "POST",
    fallbackMessage: "No fue posible cerrar la sesion.",
  });
}
