import { apiRequest } from "@services/api-client";


export async function searchItopPeople({ query = "" } = {}) {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const params = new URLSearchParams();
  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest(`/v1/people/itop/search${suffix}`, {
    fallbackMessage: "No fue posible buscar personas en iTop.",
    retryOnRevalidate: true,
  });
  return payload.items ?? [];
}


export async function getItopPersonDetail(personId) {
  const payload = await apiRequest(`/v1/people/${personId}`, {
    fallbackMessage: "No fue posible cargar el detalle de la persona.",
    retryOnRevalidate: true,
  });
  return payload.item;
}
