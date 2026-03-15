# PDF Worker Container

## Role

Generates PDFs and document outputs without loading that responsibility into the main backend.

## Runtime

- Service name: `pdf-worker`
- Source mount: `APP/volumes/pdf-worker/app`
- Logs mount: `APP/logs/pdf-worker`
- Dependencies: `redis`, `backend`, `gotenberg`

## Current Intent

- Isolate document generation.
- Keep rendering concerns separate from main business logic.

## Notes

- Runs as a non-root user.
- When touching PDF features, review `gotenberg.md` too.
