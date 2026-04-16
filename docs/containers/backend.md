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
- Personal iTop tokens are stored encrypted in MariaDB and only decrypted in backend memory right before calling iTop.
- Shared runtime lookups against iTop should be exposed under `/v1/itop/*`; business routers such as `handover` should consume that integration surface instead of publishing module-specific iTop search endpoints.
- The `Personas` module must query `Person` directly from iTop with the session runtime token; Hub does not create or seed local person records for that module.
- Person detail responses enrich associated CIs from iTop and evaluate warranty alerts using the `cmdb.warrantyAlertDays` setting stored in MariaDB.
- The settings module exposes backend endpoints for panel configuration and synchronization task definitions stored in MariaDB.
- The settings module also exposes service validation endpoints used directly from the UI, including SMTP test, draft iTop connectivity validation with configurable SSL behavior, and PDQ database path validation against the current panel draft.
- The administration checklist module now reads and writes checklist templates plus item definitions from MariaDB instead of frontend-only mock data.
- The handover module now persists its own delivery-document records in MariaDB and reuses iTop searches only for selecting receiver and CMDB assets before emission.
- Manual handover evidence uploads are stored temporarily under `/app/data/handover_evidence` inside the backend data mount, while document metadata continues to live in MariaDB.
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
