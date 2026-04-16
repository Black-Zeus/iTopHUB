# Handover Domain

## Scope

Covers delivery certificates, assignment events, user acceptance, and outbound asset movements.

## Current Intent

- Handover records should be operationally simple for support teams.
- These workflows likely involve asset state transitions, assigned user data, and document generation.

## Notes

- Keep the workflow aligned with CMDB state updates.
- PDF generation belongs to the document pipeline, not to the UI itself.
- The Hub should persist a snapshot of the receiver, each delivered asset, and the checklist answers captured at emission time.
- Default handover checklist seeds should stay short and operational, but they must cover delivery readiness by CMDB type, including condition of salida (`Nuevo` vs `Refaccionado o spare`), visual integrity, and base accessories such as chargers, cabling, adapters, or equivalent items when applicable.
- In handover, checklist templates must be suggested and accepted only when their `cmdb_class_label` matches the CMDB class of the selected asset. Generic templates without class binding may remain reusable across asset types.
- Handover checklist wording must avoid ambiguous accessory grouping. Each check should describe only what belongs to that asset type, so a positive answer always represents one clear deliverable and does not mix independent items such as a laptop adapter versus a separate dock.
- Handover checklist items should follow a logical delivery-preparation order: output condition, visual state, presentation or cleanliness, accessories that belong to that asset, and final observations.
- The list view exposes operational actions by document state: `En creacion` allows `Editar`, `Procesar`, and `Anular`; `Emitida` allows `Cancelar` as a rollback to `En creacion`, plus `PDF`, `Cargar evidencia`, and `Anular`; `Confirmada` keeps the document in read-only flow with `PDF` and, when enabled, `Cargar evidencia`; `Anulada` does not expose operational actions.
- The real PDF pipeline is still pending connection, but `PDF` and manual `Cargar evidencia` must stay out of the initial draft state and only appear once the document has already been emitted or confirmed.
- Manual evidence upload availability is controlled from `Configuracion > Documentos` through the `Cargar evidencias` toggle.
- Allowed evidence file types are also controlled from `Configuracion > Documentos`; the handover modal and backend validation must respect that configured extension list instead of hardcoding formats in the UI.
- Emitting a handover document must validate receiver, assets, asset assignability, and completion of every applied checklist answer. When emission succeeds, the Hub sets `fecha de asignacion` automatically and moves the document to `Emitida`.
- Cancelling emission is a true rollback step: it is only valid from `Emitida`, returns the document to `En creacion`, and clears `fecha de asignacion` so the draft can be adjusted and emitted again.
- Uploading evidence from `Emitida` is the forward step to `Confirmada`: the operator selects one or more files, explicitly confirms the status change in the modal, and the backend stores those files in temporary backend storage while appending their metadata to `evidence_attachments`.
