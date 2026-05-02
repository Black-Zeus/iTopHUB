import { apiRequest } from "@services/api-client";

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
