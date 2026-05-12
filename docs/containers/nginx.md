# Nginx Container

## Role

Acts as the reverse proxy entrypoint for the stack and centralizes public routing decisions.

## Runtime

- Service name: `nginx`
- Main port: `NGINX_HTTP_PORT -> 80`
- Config mount: `APP/config/nginx/conf.d`
- Certs mount: `APP/config/nginx/certs`
- Logs mount: `APP/logs/<env>/nginx`

## Current Intent

- In `dev`, route `/` to `/itop-hub/`.
- Route `/api/` to the Hub backend.
- Route `/itop-hub/` to the Hub frontend.
- Prepare the project for hostname-based publishing later without coupling the applications directly to public URLs.
- In `prd`, use `APP/config/nginx/prd/conf.d` so `/` redirects to `/itop-hub/`.

## Notes

- The stack does not include a local iTop container; iTop is consumed externally through backend REST/OQL integration.
- `mailpit` is not part of the Hub stack; SMTP testing belongs to `iTopN8N`.
- `redisinsight` is not part of the production compose.
- SSE endpoints should be proxied with buffering disabled and longer read/send timeouts so `/api/v1/events/*` can stay open without polling.
- Backend API endpoints use extended proxy connect/read/send timeouts because handover evidence confirmation can perform multiple iTop operations before responding.
- Dev proxy allows request bodies up to `50m` so handover evidence uploads can pass through `/api/` even when files are serialized from the browser.
