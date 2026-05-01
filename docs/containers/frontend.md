# Frontend Container

## Role

Runs the custom React/Vite interface for the Hub layer on top of iTop.

## Runtime

- Service name: `frontend`
- Main port in dev: `FRONTEND_PORT -> 5173`
- Source mount: `APP/volumes/frontend`
- Logs mount: `APP/logs/<env>/frontend`

## Current Intent

- This is the primary UI for operational workflows.
- The static mockup under `Draft/` is reference material for the future React migration.
- It should integrate with the custom backend and may deep-link or embed data coming from iTop.
- It is expected to be published through `nginx`, currently under `/itop-hub/`.
- In `dev`, it is also exposed directly for quick validation through `FRONTEND_PORT`.

## Current Migration Direction

- `Draft/ui/operations-hub` is the visual and workflow source of truth for the Hub migration.
- React code copied from other projects must be treated as candidate reference material, not as canonical frontend structure.
- Preserve only reusable frontend foundations that directly support the Hub:
  - routing patterns that match Hub modules
  - shared UI primitives that are domain-agnostic
  - utility helpers with clear operational value
  - service patterns that can be adapted to the Hub backend contract
- Discard or quarantine code that is coupled to unrelated domains, missing stores/hooks/services, or external dependencies not yet declared in `package.json`.
- Prefer rebuilding Hub modules from the `Draft/` flows over adapting feature modules from unrelated applications.

## Notes

- Runs as a non-root user.
- Keep frontend-specific environment variables in the layered `.env` files.
- El timeout de espera para notificaciones SSE del frontend debe configurarse con `VITE_JOB_NOTIFICATION_TIMEOUT_MS` en los `.env` versionados, no como numero hardcodeado dentro de una pagina o servicio.
- Las notificaciones UI deben pasar por el wrapper `useToast()` del proyecto; internamente puede usar `react-hot-toast`, pero los modulos deben enviar payloads claros con `title`, `description` y `tone` en vez de strings sueltos cuando el contexto lo amerite.
- Any user-facing async action should wait on the shared SSE flow and report its terminal result with toast instead of page-level success banners or polling loops.
- The frontend must treat auth as a server-side session concern:
  - session cookie only in the browser
  - no personal token returned to client code
  - session warning modal must use backend-provided `warningSeconds`, but open 10 seconds earlier than that configured threshold as a safety margin
  - password revalidation modal when runtime token must be reloaded
- If the backend reports that no Hub users exist yet, the login screen must switch to an initial setup wizard that collects the iTop URL, iTop administrator credentials, and that administrator's personal token.
- User management UI must use `Vincular usuario` semantics, meaning link existing iTop accounts instead of creating identities in iTop.
- The `Personas` module is read-only in the Hub: it starts empty and only loads rows after an explicit search against iTop using the active session token.
- The person detail modal shows CMDB objects associated in iTop and applies the warranty alert threshold configured in `Settings -> CMDB`.
- The PDQ module exposes a MAC search workflow and device detail modal backed by the backend SQLite integration.
- `Settings` now shows whether the PDQ SQLite file was detected in the configured shared folder.
- `Settings` persists panel values from MariaDB through the backend API; panel saves are independent and confirmed from the UI.
- `Settings` now includes an `Organizacion` panel used by PDF generation, where operators define organization name, acronym, and the logo rendered on generated documents.
- `Settings > Documentos` now also owns iTop document-type provisioning for actas, including strategy selection (`Tipo unico` vs `Uno por tipo de acta`), preview of expected names, and explicit `Validar en iTop` / `Crear faltantes` actions before saving the panel.
- The PDQ menu visibility is no longer a browser-only preference; it is loaded from backend configuration.
- `Settings` exposes explicit validation actions for external services from the panel itself, such as SMTP test, iTop connectivity test, and PDQ database validation, so operators can confirm the current draft values before saving or applying them elsewhere.
- In panels that expose a `Test` action, the save action should remain blocked until the current draft passes a successful validation; any subsequent edit invalidates that test requirement again.
- In `Integracion iTop`, the derived REST route should mirror the backend connector and display `URL base + /webservices/rest.php`, not the Hub backend route `/api`.
- The `Checklists` administration page loads its templates from the backend and persists changes only when the operator confirms `Guardar checklist`, preserving the current editing flow while removing frontend-only mock storage.
- The `Actas de Entrega` page is no longer a static placeholder: it now loads list data from the backend, searches iTop for receiver/assets during authoring, and saves the acta body plus checklist answers in MariaDB.
- In `Actas de Entrega`, rows in estado `Emitida` now expose both `Adjunto` and `QR`: `Adjunto` preserves the manual evidence-upload path, while `QR` opens a mobile signing session that lets the receiver sign the already generated PDF from their phone.
- The mobile signing page lives outside the authenticated Hub shell, under a public tokenized route, but it must remain scoped to that one acta session: review generated documents, capture the signature, and then leave the Hub row in estado `Firmada` so the operator can continue straight to ticket publication.
- `Actas de Devolucion` currently mirrors the same handover UI flow as `Actas de Entrega`, exposed as a separate route and filtered by document type while its dedicated business rules are still pending.
- `Actas de Devolucion` now diverge from delivery in the editor: they allow only one responsible and select assets through a modal filtered by that responsible's current iTop assignments, instead of the inline stock search used by delivery.
- Collapsible sections should reuse the same expand/collapse interaction pattern defined from `Informes`, including the same button structure, icon direction, and rotation transition, instead of introducing alternate variants per module.
- Export actions for table results should reuse the same header-button pattern used in `PDQ`: `PanelHeader.actions`, `Button variant="secondary"`, `Icon name="download"`, and the label `Descargar Excel`, even when the generated file is CSV for compatibility reasons.
- Every filtering form must expose an explicit `Buscar` button visible in the UI; pressing Enter may also submit the search, but the button is mandatory and should remain visually aligned with the filter controls.
- Any frontend action labeled `Quitar` must open a confirmation modal before removing data from the current view or form, including nested items such as assets, contacts, or checklists.
