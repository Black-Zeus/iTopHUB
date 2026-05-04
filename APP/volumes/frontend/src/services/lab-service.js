import { apiRequest } from "@services/api-client";

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
    (detail && typeof detail === "object" ? detail.message : null)
    || (typeof detail === "string" ? detail : null)
    || rawText
    || fallbackMessage;

  const error = new Error(message || fallbackMessage);
  if (detail && typeof detail === "object" && detail.brand) {
    error.brand = detail.brand;
  }
  throw error;
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


export async function getLabBootstrap() {
  return apiRequest("/v1/lab/bootstrap", {
    fallbackMessage: "No fue posible preparar el modulo de laboratorio.",
    retryOnRevalidate: true,
  });
}


export async function listLabRecords({ query = "", status = "", reason = "" } = {}) {
  const params = new URLSearchParams();
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (normalizedQuery) params.set("q", normalizedQuery);
  if (status) params.set("status", status);
  if (reason) params.set("reason", reason);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/v1/lab/records${suffix}`, {
    fallbackMessage: "No fue posible cargar las actas de laboratorio.",
    retryOnRevalidate: true,
  });
}


export async function getLabRecord(recordId) {
  return apiRequest(`/v1/lab/records/${recordId}`, {
    fallbackMessage: "No fue posible cargar el detalle del acta.",
    retryOnRevalidate: true,
  });
}


export async function createLabRecord(payload) {
  return apiRequest("/v1/lab/records", {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackMessage: "No fue posible crear el acta de laboratorio.",
    retryOnRevalidate: true,
  });
}


export async function updateLabRecord(recordId, payload) {
  return apiRequest(`/v1/lab/records/${recordId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    fallbackMessage: "No fue posible actualizar el acta.",
    retryOnRevalidate: true,
  });
}


export async function generateLabDocument(recordId, phase) {
  return apiRequest(`/v1/lab/records/${recordId}/documents/${phase}`, {
    method: "POST",
    fallbackMessage: `No fue posible generar el documento de ${phase}.`,
    retryOnRevalidate: true,
  });
}


export async function uploadLabEvidences(recordId, phase, files) {
  const serializedFiles = await Promise.all(
    files.map(async (file) => ({
      name: file.name || file.originalName || "",
      mimeType: file.type || file.mimeType || "",
      contentBase64: file instanceof File ? await readFileAsBase64(file) : (file.contentBase64 || ""),
      caption: file.caption || "",
    }))
  );

  return apiRequest(`/v1/lab/records/${recordId}/evidences`, {
    method: "POST",
    body: JSON.stringify({ phase, files: serializedFiles }),
    fallbackMessage: "No fue posible cargar las evidencias.",
    retryOnRevalidate: true,
  });
}


export async function fetchLabDocumentBlob(recordId, storedName) {
  const url = `${API_BASE_URL}/v1/lab/records/${recordId}/documents/${encodeURIComponent(storedName)}`;
  let response;
  try {
    response = await fetch(url, { credentials: "include" });
  } catch {
    throw new Error("No fue posible descargar el documento.");
  }
  if (!response.ok) {
    throw new Error(`Error al descargar documento: ${response.status}`);
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename[^;=\n]*=([^;\n]*)/);
  const filename = match ? match[1].replace(/['"]/g, "").trim() : storedName;
  return { url: blobUrl, filename };
}


export async function fetchLabEvidenceBlob(recordId, storedName) {
  const url = `${API_BASE_URL}/v1/lab/records/${recordId}/evidences/${encodeURIComponent(storedName)}`;
  let response;
  try {
    response = await fetch(url, { credentials: "include" });
  } catch {
    throw new Error("No fue posible descargar la evidencia.");
  }
  if (!response.ok) {
    throw new Error(`Error al descargar evidencia: ${response.status}`);
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  return { url: blobUrl };
}


export async function createLabSignatureSession(recordId, { forceNew = false, phase = "", workflowKind = "" } = {}) {
  const params = new URLSearchParams();
  if (forceNew) params.set("force_new", "true");
  if (phase) params.set("phase", phase);
  if (workflowKind) params.set("workflow_kind", workflowKind);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await apiRequest(`/v1/lab/records/${recordId}/signature-session${suffix}`, {
    method: "POST",
    fallbackMessage: "No fue posible abrir la sesión QR de firma.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function getLabSignatureSession(recordId, { phase = "", workflowKind = "" } = {}) {
  const params = new URLSearchParams();
  if (phase) params.set("phase", phase);
  if (workflowKind) params.set("workflow_kind", workflowKind);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await apiRequest(`/v1/lab/records/${recordId}/signature-session${suffix}`, {
    fallbackMessage: "No fue posible consultar la sesión QR de firma.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function finalizeLabClosure(recordId) {
  const response = await apiRequest(`/v1/lab/records/${recordId}/finalize-closure`, {
    method: "POST",
    fallbackMessage: "No fue posible registrar el cierre del acta en iTop.",
    retryOnRevalidate: true,
  });
  return response.item;
}


export async function getPublicLabSignatureSession(token, { claimToken = "" } = {}) {
  const suffix = claimToken ? `?claim_token=${encodeURIComponent(claimToken)}` : "";
  const response = await publicApiRequest(`/v1/lab/signature-sessions/${encodeURIComponent(token)}${suffix}`, {
    fallbackMessage: "No fue posible cargar la sesión pública de firma.",
  });
  return response.item;
}


export async function submitPublicLabSignature(token, payload) {
  const response = await publicApiRequest(`/v1/lab/signature-sessions/${encodeURIComponent(token)}/submit`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
    fallbackMessage: "No fue posible registrar la firma digital.",
  });
  return response.item;
}


export async function fetchPublicLabSignatureDocumentBlob(token, documentKind, { claimToken = "" } = {}) {
  const suffix = claimToken ? `?claim_token=${encodeURIComponent(claimToken)}` : "";
  let response;
  try {
    response = await fetch(
      `${PUBLIC_API_BASE_URL}/v1/lab/signature-sessions/${encodeURIComponent(token)}/documents/${encodeURIComponent(documentKind)}${suffix}`
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
