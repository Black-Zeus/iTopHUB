import { apiRequest } from "@services/api-client";


function buildSearchSuffix(query = "", extraParams = {}) {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const params = new URLSearchParams();

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim() !== "") {
      params.set(key, `${value}`.trim());
    }
  });

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}


export async function searchItopPeople({ query = "", status = "" } = {}) {
  const payload = await apiRequest(`/v1/itop/people/search${buildSearchSuffix(query, { status })}`, {
    fallbackMessage: "No fue posible buscar personas en iTop.",
    retryOnRevalidate: true,
  });
  return payload.items ?? [];
}


export async function getItopPersonDetail(personId) {
  const payload = await apiRequest(`/v1/itop/people/${personId}`, {
    fallbackMessage: "No fue posible cargar el detalle de la persona.",
    retryOnRevalidate: true,
  });
  return payload.item;
}


export async function searchItopAssets({ query = "" } = {}) {
  const payload = await apiRequest(`/v1/itop/assets/search${buildSearchSuffix(query)}`, {
    fallbackMessage: "No fue posible buscar activos en iTop.",
    retryOnRevalidate: true,
  });
  return payload.items ?? [];
}


export async function getItopAssetDetail(assetId) {
  const payload = await apiRequest(`/v1/itop/assets/${assetId}`, {
    fallbackMessage: "No fue posible cargar el detalle del activo.",
    retryOnRevalidate: true,
  });
  return payload.item;
}


export async function getItopAssetCatalog() {
  return apiRequest("/v1/itop/assets/catalog", {
    fallbackMessage: "No fue posible cargar el catalogo de marcas y modelos.",
    retryOnRevalidate: true,
  });
}


export async function searchItopUsers(query = "") {
  const payload = await apiRequest(`/v1/itop/users/search${buildSearchSuffix(query)}`, {
    fallbackMessage: "No fue posible buscar usuarios en iTop.",
    retryOnRevalidate: true,
  });
  return payload.items ?? [];
}
