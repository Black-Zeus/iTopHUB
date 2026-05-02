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
- `Actas de Devolucion` siguen compartiendo el core de handover, pero ya operan como una variante con reglas propias: admiten un solo responsable, solo aceptan activos actualmente asociados a esa persona en iTop, y su confirmacion debe devolver esos activos al estado CMDB configurado para devoluciones.
- `Actas de Reasignacion` tambien deben vivir dentro del mismo core de handover: reutilizan la tabla maestra, el detalle de activos, la emision PDF y la integracion documental/ticket existente, pero modelan al `responsable origen` como un `additional_receiver` dedicado con rol fijo `Responsable origen`.
- En reasignacion, el formulario debe exigir origen, destino y al menos un activo; cada activo seleccionado debe validarse contra el origen actual en iTop antes de guardar, emitir o confirmar.
- La reasignacion no usa checklist tecnico ni evidencia fotografica por activo como requisito del flujo. El detalle solo conserva la observacion opcional por activo y la trazabilidad documental del cambio.
- Al confirmar una reasignacion, backend debe dejar cada activo vinculado unicamente al responsable destino en iTop, retirar la relacion activa con el origen y mantener la trazabilidad con ticket, PDFs y relaciones CMDB ya existentes.
- Los checklist de handover ya no deben tratarse como un unico bloque generico: `Entrega`, `Devolucion` y `Normalizacion` deben tener tipos de uso separados para que cada acta consuma solo sus propias plantillas.
- `Configuracion > CMDB` now owns the target CMDB status to be used by the return flow through `cmdb.handoverReturnAssetStatus`, so future return-specific orchestration should read that setting instead of hardcoding the destination status.
- `Actas de Devolucion` now enforce a single responsible person. The draft, emit, and confirm steps must reject additional receivers for that acta type.
- Return asset selection is constrained to assets currently linked in iTop to the selected responsible. Frontend must expose that selection through a filtered modal, while backend revalidates the same ownership rule before emission and first confirmation.
- In `Actas de Devolucion`, that ownership must also be exclusive: an asset associated in iTop to the selected responsible plus any additional contact must be rejected from selection, draft save, emission, and confirmation.
- The return flow must keep its own PDF builders, even when the initial layout matches delivery, so future wording and layout changes for `Acta` and `Detalle` can evolve without touching the delivery template.
- `Actas de Devolucion` now support photographic evidence per asset in the technical detail: each image belongs to one selected asset, requires a mandatory glosa, and must persist separately from the global `Acta/Detalle` confirmation attachments.
- The return detail PDF must group those per-asset evidences under each asset block, rendering each image at a fixed 400x300 layout with its glosa beside it.
- Return ownership validation should follow the same relation used by the asset-selection modal (`lnkContactToFunctionalCI` on the selected responsible) so an asset accepted by the modal is not rejected later because of a looser contact lookup.
- In return handovers, the iTop ticket keeps `caller_id` as the selected responsible and must not add additional ticket contacts beyond that caller, even though other handover variants may still register broader contact sets.
- `Actas de Devolucion` must use checklists de tipo `Devolucion`; `Actas de Entrega` must keep using `Entrega`; future `Actas de Normalizacion` should consume only `Normalizacion`.
- `Actas de Normalizacion` ya operan dentro del core de handover: pueden ser creadas por cualquier usuario con acceso al modulo, pero antes de `Procesar` deben seleccionar un `solicitante administrador` asociado a un usuario Hub activo con perfil administrador y persona iTop vinculada.
- Ese `solicitante administrador` debe persistirse en el acta y reutilizarse como solicitante del ticket iTop y como responsable emisor mostrado en los PDF de normalizacion, aunque el borrador haya sido creado por otro usuario.
- Return confirmation must fail if the generated PDF pair (`acta` + `detalle`) is missing. PDF generation remains mandatory before evidence can move the acta to `Confirmada`.
- When a return acta is confirmed, backend must read the destination CMDB status from `Configuracion > CMDB > handoverReturnAssetStatus`, unlink the responsible from each returned asset, and then update only those included assets to that configured status.
- The backend now treats handover variants as a catalog-driven family (`initial_assignment`, `return`, `reassignment`, `replacement`, `normalization`, `laboratory`) so new acta types can declare numbering, PDF labels, and evidence-sync behavior without expanding one monolithic service file.
- Default handover checklist seeds should stay short and operational, but they must cover delivery readiness by CMDB type, including condition of salida (`Nuevo` vs `Refaccionado o spare`), visual integrity, and base accessories such as chargers, cabling, adapters, or equivalent items when applicable.
- In handover, checklist templates must be suggested and accepted only when their `cmdb_class_label` matches the CMDB class of the selected asset. Generic templates without class binding may remain reusable across asset types.
- Handover checklist wording must avoid ambiguous accessory grouping. Each check should describe only what belongs to that asset type, so a positive answer always represents one clear deliverable and does not mix independent items such as a laptop adapter versus a separate dock.
- Handover checklist items should follow a logical delivery-preparation order: output condition, visual state, presentation or cleanliness, accessories that belong to that asset, and final observations.
- At least one checklist must be selected for every activo before an acta can move to `Emitida` or `Confirmada`; backend validation must reject both emission and evidence confirmation when a selected asset has no checklist or an incomplete answer.
- The list view exposes operational actions by document state: `En creacion` allows `Editar`, `Procesar`, and `Anular`; `Emitida` allows `Cancelar` as a rollback to `En creacion`, plus `PDF`, `Cargar evidencia`, and `Anular`; `Confirmada` keeps the document in read-only flow with `PDF` and, when enabled, `Cargar evidencia`; `Anulada` does not expose operational actions.
- Emitting a handover document now generates two PDFs through `backend -> pdf-worker -> gotenberg`: the main acta (`ENT-YYYY-NNNN`) and its technical detail (`ENTD-YYYY-NNNN`).
- The handover emit action must fail fast when the session no longer has a runtime iTop token, so the UI can request password revalidation before the async document job is enqueued.
- Generated handover PDFs are stored temporarily in backend storage and their metadata is persisted with the acta so the UI can offer download actions without regenerating blindly.
- The institutional legend shown as the main acta subtitle and as issuer-signature fallback must be configured from `Configuracion > Documentos`, with an explicit toggle plus editable text instead of a hardcoded phrase.
- The iTop `DocumentType` used when attaching handover PDFs should be governed from `Configuracion > Documentos`; operators may manage it as one shared type (`Acta`) or as one type per handover variant, and backend should persist the resolved IDs in settings once validated.
- Handover confirmation must fail if that configured iTop `DocumentType` is missing, unvalidated, or no longer exists in iTop; backend must not fall back silently to legacy names or to the first available document type.
- The technical detail PDF must recover asset specifications from iTop at emit time. For computer assets such as `PC`, `Desktop`, `Laptop`, or `Notebook`, the `Especificaciones` block should stay limited to `Serie`, `Marca / Modelo`, `CPU`, `RAM`, and `Sistema Operativo`.
- Temporary handover files must now resolve their storage path from the internal handover-type catalog instead of a flat `document_<id>` folder. Generated PDFs, global evidence, and per-asset evidence should live under typed subdirectories such as `handover_documents/<handover_type>/document_<id>`.
- Download and read operations must remain compatible with legacy flat folders. When a file is not found in the typed directory, backend should retry the old flat path before returning `404`.
- Manual evidence upload availability is controlled from `Configuracion > Documentos` through the `Cargar evidencias` toggle.
- Allowed evidence file types are also controlled from `Configuracion > Documentos`; the handover modal and backend validation must respect that configured extension list instead of hardcoding formats in the UI.
- Emitting a handover document must validate receiver, assets, asset assignability, and completion of every applied checklist answer. When emission succeeds, the Hub sets `fecha de asignacion` automatically and moves the document to `Emitida`.
- Cancelling emission is a true rollback step: it is only valid from `Emitida`, returns the document to `En creacion`, and clears `fecha de asignacion` so the draft can be adjusted and emitted again.
- Emission rollback must remove the generated PDF set associated with the acta (`ENT` and `ENTD`) from backend temporary storage and clear `generated_documents` metadata, because those files belong only to the emitted snapshot being reverted.
- Emission rollback must not remove manual evidence attachments already associated with the acta. Evidence remains part of the record unless a separate evidence-management action removes it explicitly.
- Uploading evidence from `Emitida` is the forward step to `Confirmada`: the operator selects one or more files, explicitly confirms the status change in the modal, and the backend stores those files in temporary backend storage while appending their metadata to `evidence_attachments`.
- `Actas de Entrega` now also expose a QR signature branch from `Emitida`: the operator may open a mobile signing session, let the receiver sign the already generated PDF, and move the document to `Firmada` before ticket publication.
- `Firmada` is an intermediate handover state reserved for PDFs signed through the QR/mobile flow. From there the Hub must skip manual evidence upload of the main acta and continue directly with ticket creation, attachment sync, and the final transition to `Confirmada`.
- The QR/mobile flow must remain reusable for future handover variants: the public token only authorizes reviewing that acta, opening its generated PDFs, and submitting the receiver signature that replaces the main generated PDF in backend storage.
- QR signing is governed from `Configuracion > Firma QR`: the Hub must use a server-reachable public base URL, reject `localhost` values, and allow defining whether the method is enabled, the QR lifetime, the public route, and whether the detail PDF is exposed on mobile.
- Each QR session is single-device when `qr.singleDeviceLock` is enabled: the first mobile device that opens the token claims the session, the Hub reflects that state as `en uso/ocupada`, and any second device must be blocked until the session is completed or expires.
- Mobile signing must persist traceability outside the PDF itself. The latest claimed/signed device session is stored in a dedicated table and surfaced back on the acta detail as an informational card with whatever device metadata the browser could provide.
- The receiver signature modifies only the receiver box inside the main PDF. The issuer/agent signature is automatic and stamp-based: backend renders it from the repository asset `APP/volumes/backend/app/modules/signature/assets/TimbreFirma.png`, overlays the agent name, and places that stamp on the issuer signature box without user interaction.
- That evidence-upload step must allow at most 2 files total, require exactly one `Acta` attachment, and treat the `Detalle` attachment as optional.
- Ticket obligatoriness for handover confirmation is controlled only from `Configuracion > Ticket iTop` (`docs.requirementEnabled`); acta-type catalog entries must not hardcode whether a ticket is required.
- When `docs.requirementEnabled` is active, handover confirmation must require a real iTop ticket payload and create the request; when it is inactive, the confirmation flow must not demand or create a ticket.
- If iTop times out during ticket creation, any retry/recovery flow must identify that ticket only through the acta reference already embedded in the request, never by subject matching, because one user may generate multiple actas over time.
- In `Actas de Entrega`, right before creating the iTop ticket, backend must revalidate in iTop that every included asset is still in `Stock`/inventory; any other status must block ticket creation and confirmation.
- The configured ticket initial status now defaults to `assigned`; when that setting is active, backend creation must explicitly leave the iTop request in `Asignado` instead of only normalizing the setting value.
