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
- iTop REST integration lives in `APP/volumes/backend/app/integrations/itop_cmdb_connector.py`.
- The connector uses a 3-phase auth flow: `core/check_credentials` -> local token resolution -> token validation (`list_operations`).
- Expected runtime env vars for connector bootstrap:
  - `ITOP_URL`
  - `ITOP_REST_USER`
  - `ITOP_REST_PASSWORD`
  - `ITOP_AUTH_TOKEN` or per-user `ITOP_AUTH_TOKEN_<USERNAME>`
  - `ITOP_VERIFY_SSL` and `ITOP_TIMEOUT_SECONDS`
