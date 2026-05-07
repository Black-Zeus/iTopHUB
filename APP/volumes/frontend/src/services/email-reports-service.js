import { apiRequest } from "@services/api-client";

export async function getEmailReports(includeInactive = false) {
  const qs = includeInactive ? "?include_inactive=true" : "";
  const payload = await apiRequest(`/v1/email-reports${qs}`, {
    fallbackMessage: "No fue posible cargar los reportes por correo.",
  });
  return payload.items ?? [];
}

export async function createEmailReport(report) {
  const payload = await apiRequest("/v1/email-reports", {
    method: "POST",
    body: JSON.stringify(report),
    fallbackMessage: "No fue posible crear el reporte por correo.",
  });
  return payload.item ?? null;
}

export async function updateEmailReport(reportId, report) {
  const payload = await apiRequest(`/v1/email-reports/${reportId}`, {
    method: "PUT",
    body: JSON.stringify(report),
    fallbackMessage: "No fue posible actualizar el reporte por correo.",
  });
  return payload.item ?? null;
}

export async function deleteEmailReport(reportId) {
  return apiRequest(`/v1/email-reports/${reportId}`, {
    method: "DELETE",
    fallbackMessage: "No fue posible eliminar el reporte por correo.",
  });
}

export async function triggerEmailReport(reportId, parameters = {}) {
  return apiRequest(`/v1/email-reports/${reportId}/trigger`, {
    method: "POST",
    body: JSON.stringify({ parameters }),
    fallbackMessage: "No fue posible solicitar el reporte por correo.",
  });
}
