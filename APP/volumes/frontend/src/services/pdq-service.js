const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

async function parseJsonResponse(response) {
  let payload = null;
  let rawText = "";

  try {
    rawText = await response.text();
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload?.detail || rawText || "No fue posible completar la solicitud a PDQ.";
    throw new Error(detail);
  }

  return payload;
}

export async function getPdqStatus() {
  const response = await fetch(`${API_BASE_URL}/v1/integrations/pdq/config`, {
    headers: {
      Accept: "application/json",
    },
  });

  return parseJsonResponse(response);
}

export async function searchPdqDevices(query) {
  const response = await fetch(
    `${API_BASE_URL}/v1/integrations/pdq/search?query=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  return parseJsonResponse(response);
}
