# Frontend Container

## Role

Runs the custom React/Vite interface for the Hub layer on top of iTop.

## Runtime

- Service name: `frontend`
- Main port in dev: `FRONTEND_PORT -> 5173`
- Source mount: `APP/volumes/frontend`
- Logs mount: `APP/logs/frontend`

## Current Intent

- This is the primary UI for operational workflows.
- The static mockup under `Draft/` is reference material for the future React migration.
- It should integrate with the custom backend and may deep-link or embed data coming from iTop.

## Notes

- Runs as a non-root user.
- Keep frontend-specific environment variables in the layered `.env` files.
