# Redis Container

## Role

Provides transient state and queue coordination for background processing.

## Runtime

- Service name: `redis`
- Main port in dev: `REDIS_PORT -> 6379`
- Data mount: `APP/data/redis_data`
- Config mount: `APP/data/settings/redis/redis.conf`
- Logs mount: `APP/logs/redis`

## Current Intent

- Use Redis for async coordination and short-lived operational state.
- Avoid turning it into a source of truth for business data.
