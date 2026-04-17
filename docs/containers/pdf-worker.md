# PDF Worker Container

## Role

Generates PDFs and document outputs without loading that responsibility into the main backend.

## Runtime

- Service name: `pdf-worker`
- Source mount: `APP/volumes/pdf-worker/app`
- Logs mount: `APP/logs/<env>/pdf-worker`
- Dependencies: `redis`, `backend`, `gotenberg`

## Current Intent

- Isolate document generation.
- Keep rendering concerns separate from main business logic.

## Notes

- Runs as a non-root user.
- The dev image bootstraps writable bind-mounted runtime folders such as `/app/data` and `/var/log/app` as `root` during container startup, then drops back to `appuser` before launching the worker process.
- When touching PDF features, review `gotenberg.md` too.
- Exposes an internal-only HTTP endpoint used by `backend` to convert HTML into PDF.
- Receives trusted HTML payloads from `backend`, forwards them to `gotenberg`, and returns the rendered PDF bytes.
- Access to the internal render endpoint is protected with `INTERNAL_API_SECRET`.
- When a queued PDF job reaches `processing`, `completed`, or `failed`, the worker must update the shared Redis job record so the backend SSE stream can notify the originating session.
- If notification TTL/history tuning is changed in `backend`, keep the same values available in `pdf-worker` so event publication and replay use the same ephemeral policy.
