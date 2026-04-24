import { apiRequest } from "./api-client";

export async function getSettings() {
  return apiRequest("/v1/settings", {
    fallbackMessage: "No fue posible cargar la configuracion del sistema.",
  });
}

export async function updateSettingsPanel(panelCode, config) {
  return apiRequest(`/v1/settings/${panelCode}`, {
    method: "PUT",
    body: JSON.stringify({ config }),
    fallbackMessage: "No fue posible guardar la configuracion del panel.",
  });
}

export async function createSyncTask(payload) {
  return apiRequest("/v1/settings/sync/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackMessage: "No fue posible crear la tarea de sincronizacion.",
  });
}

export async function updateSyncTask(taskId, payload) {
  return apiRequest(`/v1/settings/sync/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    fallbackMessage: "No fue posible actualizar la tarea de sincronizacion.",
  });
}

export async function deleteSyncTask(taskId) {
  return apiRequest(`/v1/settings/sync/tasks/${taskId}`, {
    method: "DELETE",
    fallbackMessage: "No fue posible eliminar la tarea de sincronizacion.",
  });
}

export async function testMailSettings(config) {
  return apiRequest("/v1/settings/mail/test", {
    method: "POST",
    body: JSON.stringify({ config }),
    fallbackMessage: "No fue posible enviar el correo de prueba.",
  });
}

export async function testItopSettings(config) {
  return apiRequest("/v1/settings/itop/test", {
    method: "POST",
    body: JSON.stringify({ config }),
    fallbackMessage: "No fue posible validar la conexion con iTop.",
  });
}

export async function testPdqSettings(config) {
  return apiRequest("/v1/settings/pdq/test", {
    method: "POST",
    body: JSON.stringify({ config }),
    fallbackMessage: "No fue posible validar la base de datos PDQ.",
  });
}

export async function validateItopDocumentTypes(config) {
  return apiRequest("/v1/settings/docs/itop-document-types/validate", {
    method: "POST",
    body: JSON.stringify({ config }),
    fallbackMessage: "No fue posible validar los tipos documentales en iTop.",
  });
}

export async function createItopDocumentTypes(config) {
  return apiRequest("/v1/settings/docs/itop-document-types/create", {
    method: "POST",
    body: JSON.stringify({ config }),
    fallbackMessage: "No fue posible crear los tipos documentales en iTop.",
  });
}

export async function getSettingsProfiles() {
  const payload = await apiRequest("/v1/settings/profiles", {
    fallbackMessage: "No fue posible cargar los perfiles.",
  });
  return payload?.items || [];
}

export async function createSettingsProfile(payload) {
  return apiRequest("/v1/settings/profiles", {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackMessage: "No fue posible crear el perfil.",
  });
}

export async function updateSettingsProfile(roleCode, payload) {
  return apiRequest(`/v1/settings/profiles/${roleCode}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    fallbackMessage: "No fue posible actualizar el perfil.",
  });
}
