const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, { status = 500, code = "API_ERROR", detail = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

let tokenRevalidationHandler = null;
let sessionExpiredHandler = null;

export function setApiClientHandlers({ onTokenRevalidationRequired, onSessionExpired } = {}) {
  tokenRevalidationHandler = onTokenRevalidationRequired || null;
  sessionExpiredHandler = onSessionExpired || null;
}

async function parseResponse(response, fallbackMessage) {
  let payload = null;
  let rawText = "";

  try {
    rawText = await response.text();
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }

  if (response.ok) {
    return payload;
  }

  const detail = payload?.detail;
  const message =
    (detail && typeof detail === "object" ? detail.message : null) ||
    (typeof detail === "string" ? detail : null) ||
    rawText ||
    fallbackMessage;
  const code = detail && typeof detail === "object" ? detail.code || "API_ERROR" : "API_ERROR";

  throw new ApiError(message, {
    status: response.status,
    code,
    detail,
  });
}

export async function apiRequest(path, options = {}) {
  const {
    fallbackMessage = "No fue posible completar la solicitud.",
    retryOnRevalidate = false,
    ...fetchOptions
  } = options;
  const isFormDataBody = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  const requestHeaders = {
    Accept: "application/json",
    ...(!isFormDataBody && fetchOptions.body ? { "Content-Type": "application/json" } : {}),
    ...(fetchOptions.headers || {}),
  };

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: requestHeaders,
      ...fetchOptions,
    });

    return await parseResponse(response, fallbackMessage);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error;
    }

    if (error.code === "SESSION_EXPIRED" && sessionExpiredHandler) {
      await sessionExpiredHandler(error);
    }

    if (error.code === "TOKEN_REVALIDATION_REQUIRED" && retryOnRevalidate && tokenRevalidationHandler) {
      await tokenRevalidationHandler(error);
      const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
        credentials: "include",
        headers: requestHeaders,
        ...fetchOptions,
      });

      return parseResponse(retryResponse, fallbackMessage);
    }

    throw error;
  }
}
