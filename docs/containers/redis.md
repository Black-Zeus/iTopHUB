# Redis Container

## Role

Provides transient state and queue coordination for background processing.

## Runtime

- Service name: `redis`
- Main port in dev: `REDIS_PORT -> 6379`
- Data mount: `APP/data/<env>/redis_data`
- Config mount: `APP/config/redis/redis.conf`
- Logs mount: `APP/logs/<env>/redis`

## Current Intent

- Use Redis for async coordination and short-lived operational state.
- Avoid turning it into a source of truth for business data.
- Hub auth uses Redis only as runtime cache, not as primary persistence.
- Current session key convention:
  - `hub:session:{session_id}:meta`
  - `hub:session:{session_id}:token`

## Tooling

- `redisinsight` is available as an optional tools container in `dev` and `qa`.
- It is exposed through the `tools` profile so it does not start by default.
