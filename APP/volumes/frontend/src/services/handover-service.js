import { apiRequest } from "@services/api-client";


export async function getHandoverBootstrap() {
  return apiRequest("/v1/handover/bootstrap", {
    fallbackMessage: "No fue posible preparar el modulo de entrega.",
    retryOnRevalidate: true,
  });
}


export async function listHandoverDocuments({ query = "", status = "", handoverType = "" } = {}) {
  const params = new URLSearchParams();
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }
  if (status) {
    params.set("status", status);
  }
  if (handoverType) {
    params.set("handover_type", handoverType);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/v1/handover/documents${suffix}`, {
    fallbackMessage: "No fue posible cargar las actas de entrega.",
    retryOnRevalidate: true,
  });
}


export async function getHandoverDocument(documentId) {
  const payload = await apiRequest(`/v1/handover/documents/${documentId}`, {
    fallbackMessage: "No fue posible cargar el detalle del acta de entrega.",
    retryOnRevalidate: true,
  });
  return payload.item;
}


export async function createHandoverDocument(payload) {
  const response = await apiRequest("/v1/handover/documents", {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackMessage: "No fue posible crear el acta de entrega.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function updateHandoverDocument(documentId, payload) {
  const response = await apiRequest(`/v1/handover/documents/${documentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    fallbackMessage: "No fue posible actualizar el acta de entrega.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function searchHandoverPeople({ query = "" } = {}) {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const params = new URLSearchParams();
  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest(`/v1/handover/people/search${suffix}`, {
    fallbackMessage: "No fue posible buscar personas para el acta.",
    retryOnRevalidate: true,
  });
  return payload.items ?? [];
}


export async function searchHandoverAssets({ query = "" } = {}) {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const params = new URLSearchParams();
  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest(`/v1/handover/assets/search${suffix}`, {
    fallbackMessage: "No fue posible buscar activos para el acta.",
    retryOnRevalidate: true,
  });
  return payload.items ?? [];
}
