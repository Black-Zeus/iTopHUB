import { apiRequest } from "./api-client";

export async function searchHub({ query = "", limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (limit) params.set("limit", String(limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/v1/search${suffix}`, {
    fallbackMessage: "No fue posible ejecutar la busqueda global.",
  });
}
