import { apiRequest } from "@services/api-client";


export async function getUsers() {
  const payload = await apiRequest("/v1/users", {
    fallbackMessage: "No fue posible cargar los usuarios.",
  });
  return payload.items ?? [];
}


export async function searchItopUsers(query) {
  const payload = await apiRequest(`/v1/users/itop/search?q=${encodeURIComponent(query)}`, {
    fallbackMessage: "No fue posible buscar usuarios en iTop.",
    retryOnRevalidate: true,
  });
  return payload.items ?? [];
}


export async function getUserRoles() {
  const payload = await apiRequest("/v1/users/roles", {
    fallbackMessage: "No fue posible cargar los roles.",
  });
  return payload.items ?? [];
}


export async function updateUser(userId, userPayload) {
  const payload = await apiRequest(`/v1/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(userPayload),
    fallbackMessage: "No fue posible actualizar el usuario.",
  });
  return payload;
}


export async function createUser(userPayload) {
  const payload = await apiRequest("/v1/users", {
    method: "POST",
    body: JSON.stringify(userPayload),
    fallbackMessage: "No fue posible vincular el usuario.",
  });
  return payload.item;
}
