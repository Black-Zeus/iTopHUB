# Backend Container

## Role

Hosts the custom application API and integration layer between the frontend, iTop, MariaDB, Redis, Mailpit, and background workers.

## Runtime

- Service name: `backend`
- Main internal port: `8000`
- Source mount: `APP/volumes/backend/app`
- Data mount: `APP/data/<env>/backend_data`
- Logs mount: `APP/logs/<env>/backend`

## Current Intent

- Centralize business logic outside iTop.
- Use non-root database credentials.
- Coordinate asynchronous work through Redis and worker services.
- Serve the Hub API behind `nginx`, currently under `/api/`.
- In `dev`, it is intentionally not published directly on the host.

## Notes

- Runs as a non-root user.
- The dev image bootstraps writable bind-mounted runtime folders such as `/app/data` and `/var/log/app` as `root` during container startup, then drops back to `appuser` before launching the backend process.
- Avoid coupling domain logic directly to iTop internals when the same logic can live here.
- A minimal FastAPI bootstrap is kept in place so the container can start cleanly before the real application is implemented.
- FastAPI bootstrap lives in `APP/volumes/backend/app/main.py`; route registration is centralized in `APP/volumes/backend/app/api/router.py`, and each module publishes its own router from `APP/volumes/backend/app/api/routes/`.
- iTop REST integration lives in `APP/volumes/backend/app/integrations/itop_cmdb_connector.py`.
- PDQ SQLite integration lives in `APP/volumes/backend/app/integrations/pdq_sqlite.py`.
- The connector uses a 3-phase auth flow: `core/check_credentials` -> local token resolution -> token validation (`list_operations`).
- The active Hub login flow now uses the authenticated user's own iTop token, never an application token for runtime operations.
- If the Hub has no local users, the auth module exposes an initial bootstrap flow that validates an iTop administrator, stores the iTop panel configuration, creates the first local admin user, and starts the session without manual SQL inserts.
- In `dev`, the backend should reach iTop through the Docker service URL `http://itop`, and the REST endpoint used by the connector is `/webservices/rest.php`.
- Business rules for login, limited admin access, token registration, and user linking are documented in `docs/domains/access-control.md`.
- Runtime iTop requests should prefer the persisted `Settings -> Integracion iTop` panel values and fall back to environment variables only when no panel config exists yet.
- Hub sessions are server-side:
  - `hub_session_id` cookie in the browser
  - session metadata in Redis under `hub:session:{session_id}:meta`
  - runtime token cache in Redis under `hub:session:{session_id}:token`
- SSE notifications should be served from the same FastAPI backend under `/v1/events/stream`, authenticated with the existing `hub_session_id` cookie instead of a separate realtime service.
- Long-running job notifications are ephemeral:
  - live fanout through Redis Pub/Sub
  - short replay window in Redis per session with TTL for reconnect races
  - no MariaDB persistence for notification delivery state
- Any new backend-managed async flow that is visible to the user should terminate through this SSE contract rather than requiring periodic polling endpoints in the frontend.
- Personal iTop tokens are stored encrypted in MariaDB and only decrypted in backend memory right before calling iTop.
- Shared runtime lookups against iTop should be exposed under `/v1/itop/*`; business routers such as `handover` should consume that integration surface instead of publishing module-specific iTop search endpoints.
- The `Personas` module must query `Person` directly from iTop with the session runtime token; Hub does not create or seed local person records for that module.
- Runtime detail/search flows for `Personas` and `Activos` must use the iTop REST connector with the session token and must not read iTop internal MariaDB tables such as `priv_change*`.
- Person detail responses enrich associated CIs from iTop and evaluate warranty alerts using the `cmdb.warrantyAlertDays` setting stored in MariaDB.
- The settings module exposes backend endpoints for panel configuration and synchronization task definitions stored in MariaDB.
- The settings module now includes `Organizacion` data used by the PDF pipeline, including organization name, acronym, and logo payload stored in panel configuration.
- The settings module also exposes service validation endpoints used directly from the UI, including SMTP test, draft iTop connectivity validation with configurable SSL behavior, and PDQ database path validation against the current panel draft.
- The settings module also exposes `Configuracion > Documentos` helpers to validate or create iTop `DocumentType` records from the current runtime session, so handover flows can persist an explicit document-type mapping instead of relying only on legacy fallback names.
- CMDB panel settings now also persist return-flow defaults such as `handoverReturnAssetStatus`, which future `Actas de Devolucion` rules should consume instead of embedding a destination asset status in the handover service.
- The administration checklist module now reads and writes checklist templates plus item definitions from MariaDB instead of frontend-only mock data.
- The handover module now persists its own delivery-document records in MariaDB and reuses iTop searches only for selecting receiver and CMDB assets before emission.
- The handover module also exposes a temporary `Actas de Devolucion` mirror through the same API/persistence flow, separated by `handover_type = return` until dedicated return rules replace the shared behavior.
- The return handover flow now consumes `cmdb.handoverReturnAssetStatus` during confirmation, revalidates in backend that every returned asset is still assigned in iTop to the selected responsible, and blocks confirmation unless the emitted PDF set (`main` + `detail`) exists.
- Handover PDF files are generated through the internal `pdf-worker` service, stored temporarily under `/app/data/handover_documents`, and associated to each acta through `generated_documents` metadata in MariaDB.
- Handover orchestration currently stays in `modules/handover/service.py`, while reusable serialization and document-building concerns now live in `modules/handover/payloads.py`, `modules/handover/shared.py`, and `modules/handover/document_templates.py` to keep future acta variants out of a single file.
- Handover document variants are now defined in `modules/handover/handover_types.py`; numbering prefixes, document titles, and evidence-side behavior should be added there instead of hardcoding new `if handover_type` branches in `service.py`.
- Checklist completeness for handover is enforced in backend workflow steps, not only in the UI: emission and evidence-confirmation must fail when an asset has no checklist selected or an answer is still incomplete.
- Handover ticket requirement is governed by `Settings -> docs.requirementEnabled`; backend must not hardcode ticket obligatoriness in the handover-type catalog.
- The configured ticket initial status is resolved from `Settings -> docs.requirementInitialStatus`; when it is `assigned`, backend handover confirmation must explicitly leave the created iTop request in `Asignado`.
- Handover PDFs consume organization and document-layout settings from MariaDB, including logo, page size, margins, folio traceability, and footer page numbering.
- Handover document synchronization should first resolve the iTop `DocumentType` from `docs.itopDocumentTypeStrategy`, `docs.itopDocumentTypeBaseName`, and `docs.itopDocumentTypeIds`; the older fallback list in `handover_types.py` remains only as backward compatibility.
- Before enqueuing handover emission, `backend` must validate that the session still has a runtime iTop token available so the frontend can trigger password revalidation in the normal HTTP flow instead of discovering the problem only after the async job starts.
- Handover PDF generation enriches each delivered asset from iTop at emit time using the current session runtime token; the PDF detail must prefer that live iTop snapshot for specifications rather than relying only on the draft payload saved in MariaDB.
- Manual handover evidence uploads are stored temporarily under `/app/data/handover_evidence` inside the backend data mount, while document metadata continues to live in MariaDB.
- Rolling back a handover from `Emitida` to `En creacion` removes the generated PDF files and clears `generated_documents`, but preserves `evidence_attachments`; evidence lifecycle is managed separately from PDF regeneration.
- Expected runtime env vars for connector bootstrap:
  - `ITOP_URL`
  - `ITOP_REST_USER`
  - `ITOP_REST_PASSWORD`
  - `ITOP_AUTH_TOKEN` or per-user `ITOP_AUTH_TOKEN_<USERNAME>`
  - `ITOP_VERIFY_SSL` and `ITOP_TIMEOUT_SECONDS`
- Expected backend runtime env vars for PDQ bootstrap:
  - `PDQ_ENABLED`
  - `PDQ_SQLITE_DIR`
  - `PDQ_SQLITE_FILE_NAME` or `PDQ_SQLITE_FILE_GLOB`
  - `PDQ_SEARCH_MIN_CHARS`
- Expected compose/bootstrap variable for the shared folder mount:
  - `PDQ_SHARED_ROOT`
- Expected backend runtime env vars for Hub auth/session:
  - `HUB_TOKEN_KEK`
  - `HUB_TOKEN_KEK_VERSION`
  - `HUB_SESSION_TTL_SECONDS`
  - `HUB_RUNTIME_TOKEN_TTL_SECONDS`
  - `HUB_SESSION_WARNING_SECONDS`
- Expected backend runtime env vars for PDF orchestration:
  - `PDF_WORKER_URL`
  - `INTERNAL_API_SECRET`
- Optional backend runtime env vars for ephemeral SSE notifications:
  - `HUB_NOTIFICATION_TTL_SECONDS`
  - `HUB_NOTIFICATION_HISTORY_LIMIT`
  - `HUB_SSE_HEARTBEAT_SECONDS`
  - `HUB_SSE_RETRY_MS`
