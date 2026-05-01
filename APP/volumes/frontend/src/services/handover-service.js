import { apiRequest } from "@services/api-client";
import { searchItopAssets, searchItopPeople } from "./itop-service";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const PUBLIC_API_BASE_URL = "/api";


async function parsePublicApiResponse(response, fallbackMessage) {
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

  throw new Error(message || fallbackMessage);
}


async function publicApiRequest(path, options = {}) {
  const {
    fallbackMessage = "No fue posible completar la solicitud pública.",
    ...fetchOptions
  } = options;
  const isFormDataBody = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  const requestHeaders = {
    Accept: "application/json",
    ...(!isFormDataBody && fetchOptions.body ? { "Content-Type": "application/json" } : {}),
    ...(fetchOptions.headers || {}),
  };

  let response;
  try {
    response = await fetch(`${PUBLIC_API_BASE_URL}${path}`, {
      headers: requestHeaders,
      ...fetchOptions,
    });
  } catch {
    throw new Error(fallbackMessage);
  }

  return parsePublicApiResponse(response, fallbackMessage);
}


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


async function serializeHandoverItems(items = []) {
  return Promise.all((items || []).map(async (item) => ({
    ...item,
    evidences: await Promise.all((item?.evidences || []).map(async (evidence) => ({
      name: evidence?.name || evidence?.originalName || evidence?.storedName || evidence?.file?.name || "",
      originalName: evidence?.originalName || evidence?.name || evidence?.storedName || evidence?.file?.name || "",
      storedName: evidence?.storedName || "",
      mimeType: evidence?.mimeType || evidence?.file?.type || "",
      fileSize: evidence?.fileSize ?? evidence?.size ?? evidence?.file?.size ?? null,
      caption: evidence?.caption || "",
      source: evidence?.source || "",
      contentBase64: evidence?.file ? await readFileAsBase64(evidence.file) : "",
    }))),
  })));
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
  const serializedItems = await serializeHandoverItems(payload?.items || []);
  const response = await apiRequest("/v1/handover/documents", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      items: serializedItems,
    }),
    fallbackMessage: "No fue posible crear el acta de entrega.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function updateHandoverDocument(documentId, payload) {
  const serializedItems = await serializeHandoverItems(payload?.items || []);
  const response = await apiRequest(`/v1/handover/documents/${documentId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...payload,
      items: serializedItems,
    }),
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


export async function uploadHandoverEvidence(documentId, items = [], ticketPayload = null) {
  const serializedFiles = await Promise.all(
    items.map(async ({ file, documentType = "" }) => ({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      contentBase64: await readFileAsBase64(file),
      documentType,
    }))
  );

  const response = await apiRequest(`/v1/handover/documents/${documentId}/evidence`, {
    method: "POST",
    body: JSON.stringify({ files: serializedFiles, ticket: ticketPayload || {} }),
    fallbackMessage: "No fue posible cargar la evidencia del acta de entrega.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function createHandoverSignatureSession(documentId, { forceNew = false } = {}) {
  const suffix = forceNew ? "?force_new=true" : "";
  const response = await apiRequest(`/v1/handover/documents/${documentId}/signature-session${suffix}`, {
    method: "POST",
    fallbackMessage: "No fue posible abrir la sesión QR de firma.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function getHandoverSignatureSession(documentId) {
  const response = await apiRequest(`/v1/handover/documents/${documentId}/signature-session`, {
    fallbackMessage: "No fue posible consultar la sesión QR de firma.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function publishSignedHandover(documentId, ticketPayload = null) {
  const response = await apiRequest(`/v1/handover/documents/${documentId}/publish-signed`, {
    method: "POST",
    body: JSON.stringify({ ticket: ticketPayload || {} }),
    fallbackMessage: "No fue posible publicar el ticket del acta firmada.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function getPublicHandoverSignatureSession(token, { claimToken = "" } = {}) {
  const suffix = claimToken ? `?claim_token=${encodeURIComponent(claimToken)}` : "";
  const response = await publicApiRequest(`/v1/handover/signature-sessions/${encodeURIComponent(token)}${suffix}`, {
    fallbackMessage: "No fue posible cargar la sesión pública de firma.",
  });
  return response.item;
}


export async function submitPublicHandoverSignature(token, payload) {
  const response = await publicApiRequest(`/v1/handover/signature-sessions/${encodeURIComponent(token)}/submit`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
    fallbackMessage: "No fue posible registrar la firma digital.",
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
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]+)\1/i);
  const filename = match?.[2]?.trim() || null;
  const namedBlob = filename ? new File([blob], filename, { type: "application/pdf" }) : blob;
  return { blob, url: URL.createObjectURL(namedBlob), filename };
}


export async function fetchPublicHandoverSignatureDocumentBlob(token, documentKind, { claimToken = "" } = {}) {
  const suffix = claimToken ? `?claim_token=${encodeURIComponent(claimToken)}` : "";
  let response;
  try {
    response = await fetch(
      `${PUBLIC_API_BASE_URL}/v1/handover/signature-sessions/${encodeURIComponent(token)}/documents/${encodeURIComponent(documentKind)}${suffix}`
    );
  } catch {
    throw new Error("No fue posible obtener el documento de la sesión de firma.");
  }
  if (!response.ok) {
    let rawText = "";
    try {
      rawText = await response.text();
      const payload = rawText ? JSON.parse(rawText) : null;
      const detail = payload?.detail;
      throw new Error(
        (detail && typeof detail === "object" ? detail.message : null)
        || (typeof detail === "string" ? detail : null)
        || rawText
        || "No fue posible obtener el documento de la sesión de firma."
      );
    } catch (error) {
      if (error instanceof Error && error.message) {
        throw error;
      }
      throw new Error("No fue posible obtener el documento de la sesión de firma.");
    }
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]+)\1/i);
  const filename = match?.[2]?.trim() || null;
  const namedBlob = filename ? new File([blob], filename, { type: "application/pdf" }) : blob;
  return { blob, url: URL.createObjectURL(namedBlob), filename };
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


export async function searchHandoverAssets({ query = "", assignedPersonId = "" } = {}) {
  return searchItopAssets({ query, assignedPersonId });
}
