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

- In `dev`, route `/` to the local iTop container.
- Route `/api/` to the Hub backend.
- Route `/itop-hub/` to the Hub frontend.
- Prepare the project for hostname-based publishing later without coupling the applications directly to public URLs.

## Notes

- `itop` is only proxied locally in `dev`.
- In `qa` and `prd`, the expectation is to proxy the Hub while consuming the original iTop site externally.
