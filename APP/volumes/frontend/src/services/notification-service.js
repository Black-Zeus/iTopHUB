import { runtimeConfig } from "../config/runtime";

function parseNotificationEvent(event) {
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

export function waitForJobNotification(jobId, { timeoutMs = runtimeConfig.jobNotificationTimeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`${runtimeConfig.apiBaseUrl}/v1/events/stream`);
    let settled = false;

    const cleanup = () => {
      eventSource.close();
      window.clearTimeout(timeoutId);
    };

    const settle = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    const handleJobUpdate = (event) => {
      const payload = parseNotificationEvent(event);
      if (!payload) {
        return;
      }

      const payloadJobId = payload?.job?.jobId || payload?.job_id;
      if (payloadJobId !== jobId) {
        return;
      }

      const status = payload?.job?.status || payload?.status;
      if (status === "completed") {
        settle(() => resolve(payload));
        return;
      }

      if (status === "failed" || status === "timeout") {
        const message = payload?.error?.detail || "Ocurrió un error al procesar la tarea.";
        settle(() => reject(new Error(message)));
      }
    };

    const handleSessionExpired = () => {
      settle(() => reject(new Error("La sesión expiró antes de recibir la notificación del proceso.")));
    };

    const handleTransportError = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        settle(() => reject(new Error("No fue posible mantener la conexión de eventos con el servidor.")));
      }
    };

    const timeoutId = window.setTimeout(() => {
      settle(() => reject(new Error("No se recibió confirmación del proceso dentro del tiempo esperado.")));
    }, timeoutMs);

    eventSource.addEventListener("job.updated", handleJobUpdate);
    eventSource.addEventListener("session.expired", handleSessionExpired);
    eventSource.onerror = handleTransportError;
  });
}
