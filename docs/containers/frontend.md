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
- The frontend must treat auth as a server-side session concern:
  - session cookie only in the browser
  - no personal token returned to client code
  - modal warning before session expiry
  - password revalidation modal when runtime token must be reloaded
- User management UI must use `Vincular usuario` semantics, meaning link existing iTop accounts instead of creating identities in iTop.
- The PDQ module exposes a MAC search workflow and device detail modal backed by the backend SQLite integration.
- `Settings` now shows whether the PDQ SQLite file was detected in the configured shared folder.
- `Settings` persists panel values from MariaDB through the backend API; panel saves are independent and confirmed from the UI.
- The PDQ menu visibility is no longer a browser-only preference; it is loaded from backend configuration.
- `Settings` exposes explicit validation actions for external services from the panel itself, such as SMTP test, iTop connectivity test, and PDQ database validation, so operators can confirm the current draft values before saving or applying them elsewhere.
- In panels that expose a `Test` action, the save action should remain blocked until the current draft passes a successful validation; any subsequent edit invalidates that test requirement again.
- In `Integracion iTop`, the derived REST route should mirror the backend connector and display `URL base + /webservices/rest.php`, not the Hub backend route `/api`.
- Collapsible sections inside `Settings` should reuse the same expand/collapse interaction pattern already used in `Informes`, instead of introducing a new visual style.
