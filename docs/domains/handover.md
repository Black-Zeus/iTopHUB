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
- Emitting a handover document now generates two PDFs through `backend -> pdf-worker -> gotenberg`: the main acta (`ENT-YYYY-NNNN`) and its technical detail (`ENTD-YYYY-NNNN`).
- The handover emit action must fail fast when the session no longer has a runtime iTop token, so the UI can request password revalidation before the async document job is enqueued.
- Generated handover PDFs are stored temporarily in backend storage and their metadata is persisted with the acta so the UI can offer download actions without regenerating blindly.
- The technical detail PDF must recover asset specifications from iTop at emit time. For computer assets such as `PC`, `Desktop`, `Laptop`, or `Notebook`, the `Especificaciones` block should stay limited to `Serie`, `Marca / Modelo`, `CPU`, `RAM`, and `Sistema Operativo`.
- Manual evidence upload availability is controlled from `Configuracion > Documentos` through the `Cargar evidencias` toggle.
- Allowed evidence file types are also controlled from `Configuracion > Documentos`; the handover modal and backend validation must respect that configured extension list instead of hardcoding formats in the UI.
- Emitting a handover document must validate receiver, assets, asset assignability, and completion of every applied checklist answer. When emission succeeds, the Hub sets `fecha de asignacion` automatically and moves the document to `Emitida`.
- Cancelling emission is a true rollback step: it is only valid from `Emitida`, returns the document to `En creacion`, and clears `fecha de asignacion` so the draft can be adjusted and emitted again.
- Emission rollback must remove the generated PDF set associated with the acta (`ENT` and `ENTD`) from backend temporary storage and clear `generated_documents` metadata, because those files belong only to the emitted snapshot being reverted.
- Emission rollback must not remove manual evidence attachments already associated with the acta. Evidence remains part of the record unless a separate evidence-management action removes it explicitly.
- Uploading evidence from `Emitida` is the forward step to `Confirmada`: the operator selects one or more files, explicitly confirms the status change in the modal, and the backend stores those files in temporary backend storage while appending their metadata to `evidence_attachments`.
