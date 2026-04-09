import { apiRequest } from "./api-client";

export async function getChecklists() {
  return apiRequest("/v1/checklists", {
    fallbackMessage: "No fue posible cargar los checklists.",
  });
}

export async function createChecklist(payload) {
  return apiRequest("/v1/checklists", {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackMessage: "No fue posible crear el checklist.",
  });
}

export async function updateChecklist(checklistId, payload) {
  return apiRequest(`/v1/checklists/${checklistId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    fallbackMessage: "No fue posible actualizar el checklist.",
  });
}
