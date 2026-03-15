# Backend Container

## Role

Hosts the custom application API and integration layer between the frontend, iTop, MariaDB, Redis, Mailpit, and background workers.

## Runtime

- Service name: `backend`
- Main port in dev: `BACKEND_PORT -> 8000`
- Source mount: `APP/volumes/backend/app`
- Data mount: `APP/data/backend_data`
- Logs mount: `APP/logs/backend`

## Current Intent

- Centralize business logic outside iTop.
- Use non-root database credentials.
- Coordinate asynchronous work through Redis and worker services.

## Notes

- Runs as a non-root user.
- Avoid coupling domain logic directly to iTop internals when the same logic can live here.
