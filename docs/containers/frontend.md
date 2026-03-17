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
