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
- The list view exposes operational actions by document state: `Procesar` is available while the document is `En creacion` and currently advances it to `Emitida`; `Anular` moves the document to `Anulada`.
- The real PDF pipeline is still pending connection, but the list already reserves dedicated actions for `PDF` and manual `Cargar evidencia`.
- Manual evidence upload availability is controlled from `Configuracion > Documentos` through the `Cargar evidencias` toggle.
