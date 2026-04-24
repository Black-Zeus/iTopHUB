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


export async function searchItopPeople({ query = "", status = "", organizationId = "" } = {}) {
  const payload = await apiRequest(`/v1/itop/people/search${buildSearchSuffix(query, { status, org_id: organizationId })}`, {
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


export async function searchItopAssets({ query = "", assignedPersonId = "" } = {}) {
  const payload = await apiRequest(`/v1/itop/assets/search${buildSearchSuffix(query, { assigned_person_id: assignedPersonId })}`, {
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


export async function getItopRequirementCatalog() {
  return apiRequest("/v1/itop/settings/requirement-catalog", {
    fallbackMessage: "No fue posible cargar los catalogos de iTop para el ticket iTop.",
    retryOnRevalidate: true,
  });
}


export async function getItopTicketDefaults() {
  const payload = await apiRequest("/v1/itop/ticket/defaults", {
    fallbackMessage: "No fue posible cargar la configuracion del ticket iTop.",
    retryOnRevalidate: true,
  });
  return payload.item || {};
}


export async function getItopCurrentUserTeams() {
  const payload = await apiRequest("/v1/itop/me/teams", {
    fallbackMessage: "No fue posible cargar los grupos del usuario conectado.",
    retryOnRevalidate: true,
  });
  return {
    items: payload.items || [],
    sessionUser: payload.sessionUser || null,
  };
}


export async function searchItopTeams({ query = "", organizationId = "" } = {}) {
  const payload = await apiRequest(`/v1/itop/teams/search${buildSearchSuffix(query, { org_id: organizationId })}`, {
    fallbackMessage: "No fue posible buscar equipos en iTop.",
    retryOnRevalidate: true,
  });
  return payload.items ?? [];
}


export async function searchItopTeamPeople({ teamId, query = "" } = {}) {
  if (!teamId) {
    return [];
  }
  const payload = await apiRequest(`/v1/itop/teams/${encodeURIComponent(teamId)}/people/search${buildSearchSuffix(query)}`, {
    fallbackMessage: "No fue posible buscar analistas del equipo en iTop.",
    retryOnRevalidate: true,
  });
  return payload.items ?? [];
}
