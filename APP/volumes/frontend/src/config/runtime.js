const DEFAULT_JOB_NOTIFICATION_TIMEOUT_MS = 180000;

function parsePositiveInt(value, defaultValue) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return defaultValue;
}

export const runtimeConfig = {
  apiBaseUrl: (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, ""),
  jobNotificationTimeoutMs: parsePositiveInt(
    import.meta.env.VITE_JOB_NOTIFICATION_TIMEOUT_MS,
    DEFAULT_JOB_NOTIFICATION_TIMEOUT_MS
  ),
};
