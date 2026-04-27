import { apiRequest } from "@services/api-client";

export async function getReportCatalog(includeInactive = false) {
  const qs = includeInactive ? "?include_inactive=true" : "";
  const payload = await apiRequest(`/v1/reports${qs}`, {
    fallbackMessage: "No fue posible cargar el catalogo de reportes.",
    retryOnRevalidate: true,
  });
  return payload.items ?? [];
}

export async function getReportDefinition(reportCode) {
  const payload = await apiRequest(`/v1/reports/${reportCode}`, {
    fallbackMessage: "No fue posible cargar la definicion del reporte.",
    retryOnRevalidate: true,
  });
  return payload.item ?? null;
}

export async function executeReport(reportCode, filters = {}, pagination = {}) {
  const payload = await apiRequest(`/v1/reports/${reportCode}/execute`, {
    method: "POST",
    body: JSON.stringify({ filters, pagination }),
    fallbackMessage: "No fue posible ejecutar el reporte.",
    retryOnRevalidate: true,
  });
  return payload;
}

export async function exportReportCsv(reportCode, filters = {}) {
  const payload = await apiRequest(`/v1/reports/${reportCode}/export/csv`, {
    method: "POST",
    body: JSON.stringify({ filters, pagination: {} }),
    fallbackMessage: "No fue posible exportar el reporte.",
    retryOnRevalidate: true,
  });
  return payload;
}

export async function getReportVersions(reportCode) {
  const payload = await apiRequest(`/v1/reports/${reportCode}/versions`, {
    fallbackMessage: "No fue posible cargar las versiones del reporte.",
    retryOnRevalidate: true,
  });
  return payload.items ?? [];
}

export async function downloadReportCsv(reportCode, filters = {}) {
  const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
  const response = await fetch(`${API_BASE_URL}/v1/reports/${reportCode}/export/csv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ filters, pagination: { page: 1, page_size: 0 } }),
  });
  if (!response.ok) {
    throw new Error("No fue posible exportar el reporte.");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : `reporte_${reportCode}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
