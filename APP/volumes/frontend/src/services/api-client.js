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
const inFlightGetRequests = new Map();
const cachedGetResponses = new Map();

const CACHEABLE_GET_PATTERNS = [
  /^\/v1\/handover\/bootstrap(?:\?|$)/,
  /^\/v1\/lab\/bootstrap(?:\?|$)/,
  /^\/v1\/settings(?:\/|\?|$)/,
  /^\/v1\/itop\/settings\/requirement-catalog(?:\?|$)/,
  /^\/v1\/itop\/ticket\/defaults(?:\?|$)/,
  /^\/v1\/itop\/me\/teams(?:\?|$)/,
  /^\/v1\/itop\/assets\/catalog(?:\?|$)/,
];

function isGetRequest(fetchOptions) {
  return String(fetchOptions.method || "GET").toUpperCase() === "GET" && !fetchOptions.body;
}

function getDefaultCacheTtl(path) {
  return CACHEABLE_GET_PATTERNS.some((pattern) => pattern.test(path)) ? 30_000 : 0;
}

function buildGetCacheKey(path, fetchOptions) {
  const headers = fetchOptions.headers || {};
  const headerEntries = headers instanceof Headers
    ? Array.from(headers.entries())
    : Object.entries(headers);
  const stableHeaders = headerEntries
    .map(([key, value]) => [String(key).toLowerCase(), String(value)])
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify([path, stableHeaders]);
}

function looksLikeHtml(value) {
  const text = String(value || "").trim();
  return /<!doctype\s+html/i.test(text) || /<\/?(html|head|body|pre|title|script)\b/i.test(text);
}

function getReadableRawMessage(rawText) {
  const text = String(rawText || "").trim();
  if (!text || looksLikeHtml(text)) return "";
  return text;
}

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
  const rawMessage = getReadableRawMessage(rawText);
  const message =
    (detail && typeof detail === "object" ? detail.message : null) ||
    (typeof detail === "string" ? detail : null) ||
    rawMessage ||
    fallbackMessage;
  const code = detail && typeof detail === "object" ? detail.code || "API_ERROR" : "API_ERROR";

  throw new ApiError(message, {
    status: response.status,
    code,
    detail: detail || rawMessage || null,
  });
}

export async function apiRequest(path, options = {}) {
  const {
    fallbackMessage = "No fue posible completar la solicitud.",
    retryOnRevalidate = false,
    dedupe = true,
    cacheTtlMs,
    ...fetchOptions
  } = options;
  const canUseGetCache = isGetRequest(fetchOptions);
  const requestCacheTtl = Number.isFinite(cacheTtlMs) ? Math.max(0, cacheTtlMs) : getDefaultCacheTtl(path);
  const cacheKey = canUseGetCache ? buildGetCacheKey(path, fetchOptions) : "";

  if (canUseGetCache && requestCacheTtl > 0) {
    const cached = cachedGetResponses.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    if (cached) {
      cachedGetResponses.delete(cacheKey);
    }
  }

  if (canUseGetCache && dedupe && inFlightGetRequests.has(cacheKey)) {
    return inFlightGetRequests.get(cacheKey);
  }

  const isFormDataBody = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  const requestHeaders = {
    Accept: "application/json",
    ...(!isFormDataBody && fetchOptions.body ? { "Content-Type": "application/json" } : {}),
    ...(fetchOptions.headers || {}),
  };

  const requestPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: requestHeaders,
      ...fetchOptions,
    });

    const payload = await parseResponse(response, fallbackMessage);
    if (canUseGetCache && requestCacheTtl > 0) {
      cachedGetResponses.set(cacheKey, {
        value: payload,
        expiresAt: Date.now() + requestCacheTtl,
      });
    }
    return payload;
  })();

  if (canUseGetCache && dedupe) {
    inFlightGetRequests.set(cacheKey, requestPromise);
  }

  try {
    return await requestPromise;
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

      const payload = await parseResponse(retryResponse, fallbackMessage);
      if (canUseGetCache && requestCacheTtl > 0) {
        cachedGetResponses.set(cacheKey, {
          value: payload,
          expiresAt: Date.now() + requestCacheTtl,
        });
      }
      return payload;
    }

    throw error;
  } finally {
    if (canUseGetCache && dedupe) {
      inFlightGetRequests.delete(cacheKey);
    }
  }
}
