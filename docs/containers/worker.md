# Worker Container

## Role

Executes asynchronous jobs that should not block the backend request cycle.

## Runtime

- Service name: `worker`
- Source mount: `APP/volumes/worker/app`
- Temp/settings mount: `APP/config/worker/temp`
- Logs mount: `APP/logs/<env>/worker`
- Dependencies: `redis`, `backend`

## Current Intent

- Process queued tasks with minimal privileges.
- Keep job orchestration separate from API request handling.

## Notes

- Runs as a non-root user.
- Prompt-based or AI-specific behavior is intentionally out of scope for the current phase.
- The current code is a bootstrap worker with heartbeat logs so the service starts cleanly during early integration.
- Async jobs handled here must follow the shared Redis job-status contract so FastAPI can fan out terminal notifications through SSE without frontend polling.
