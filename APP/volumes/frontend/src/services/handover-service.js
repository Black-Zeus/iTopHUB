import { apiRequest } from "@services/api-client";
import { searchItopAssets, searchItopPeople } from "./itop-service";


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
  const items = await searchItopPeople({ query });
  return items.map((item) => ({
    id: Number(item.id),
    code: item.code,
    name: item.person,
    email: item.asset,
    phone: item.phone,
    role: item.role,
    status: item.status,
  }));
}


export async function searchHandoverAssets({ query = "" } = {}) {
  return searchItopAssets({ query });
}
