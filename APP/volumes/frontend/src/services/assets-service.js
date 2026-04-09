import { apiRequest } from "@services/api-client";


export async function searchItopAssets({ query = "" } = {}) {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const params = new URLSearchParams();
  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest(`/v1/assets/itop/search${suffix}`, {
    fallbackMessage: "No fue posible buscar activos en iTop.",
    retryOnRevalidate: true,
  });
  return payload.items ?? [];
}


export async function getItopAssetDetail(assetId) {
  const payload = await apiRequest(`/v1/assets/${assetId}`, {
    fallbackMessage: "No fue posible cargar el detalle del activo.",
    retryOnRevalidate: true,
  });
  return payload.item;
}


export async function getItopAssetCatalog() {
  return apiRequest("/v1/assets/itop/catalog", {
    fallbackMessage: "No fue posible cargar el catalogo de marcas y modelos.",
    retryOnRevalidate: true,
  });
}
