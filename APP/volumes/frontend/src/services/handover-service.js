import { apiRequest } from "@services/api-client";
import { searchItopAssets, searchItopPeople } from "./itop-service";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");


function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64Payload = result.includes(",") ? result.split(",").pop() : result;
      resolve(base64Payload || "");
    };
    reader.onerror = () => reject(new Error(`No fue posible leer el archivo ${file.name}.`));
    reader.readAsDataURL(file);
  });
}


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


export async function updateHandoverDocumentStatus(documentId, status) {
  const detail = await getHandoverDocument(documentId);
  return updateHandoverDocument(documentId, {
    ...detail,
    status,
  });
}


export async function emitHandoverDocument(documentId) {
  const response = await apiRequest(`/v1/handover/documents/${documentId}/emit`, {
    method: "POST",
    fallbackMessage: "No fue posible emitir el acta de entrega.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function rollbackHandoverDocument(documentId) {
  const response = await apiRequest(`/v1/handover/documents/${documentId}/rollback`, {
    method: "POST",
    fallbackMessage: "No fue posible cancelar la emision del acta de entrega.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function uploadHandoverEvidence(documentId, items = []) {
  const serializedFiles = await Promise.all(
    items.map(async ({ file, observation = "" }) => ({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      contentBase64: await readFileAsBase64(file),
      observation,
    }))
  );

  const response = await apiRequest(`/v1/handover/documents/${documentId}/evidence`, {
    method: "POST",
    body: JSON.stringify({ files: serializedFiles }),
    fallbackMessage: "No fue posible cargar la evidencia del acta de entrega.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function fetchHandoverEvidenceBlob(documentId, storedName) {
  const response = await fetch(
    `${API_BASE_URL}/v1/handover/documents/${documentId}/evidence/${encodeURIComponent(storedName)}`,
    { credentials: "include" }
  );
  if (!response.ok) {
    throw new Error("No fue posible obtener el adjunto.");
  }
  const blob = await response.blob();
  return { blob, url: URL.createObjectURL(blob) };
}


export async function fetchHandoverGeneratedPdfBlob(documentId, documentKind) {
  const response = await fetch(
    `${API_BASE_URL}/v1/handover/documents/${documentId}/pdf/${encodeURIComponent(documentKind)}`,
    { credentials: "include" }
  );
  if (!response.ok) {
    throw new Error("No fue posible obtener el PDF generado.");
  }
  const blob = await response.blob();
  return { blob, url: URL.createObjectURL(blob) };
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
