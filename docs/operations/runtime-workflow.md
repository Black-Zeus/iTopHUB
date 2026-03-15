# Runtime Workflow

## Execution Boundary

This project is operated through Docker.
The user controls runtime operations with `docker_tools_v3.sh`.

The AI agent should prepare files, configuration, and documentation, but should not assume host runtimes such as `node`, `python`, `npm`, or `pip` are available for direct execution.

## What The Agent Should Do

- Update `package.json`, `requirements.txt`, `pyproject.toml`, `.env*`, Dockerfiles, and compose files as needed.
- Leave services ready for user-managed restart, rebuild, or dependency installation.
- Tell the user what operational step is required if a change depends on runtime execution.

## What The Agent Should Avoid

- Assuming host-level package managers are available.
- Treating ad hoc runtime commands as part of the normal implementation path.
- Relying on manual hidden steps that are not captured in repository files.

## Environment Layering

- `.env`: common defaults shared by all environments.
- `.env.dev`: development-specific overrides.
- `.env.qa`: QA-specific overrides.
- `.env.prd`: production-specific overrides.

## Versioned Templates

- `.env.example`
- `.env.dev.example`
- `.env.qa.example`
- `.env.prd.example`

These example files are the reproducible source for rebuilding local environment files in a fresh clone.

## Bootstrap Minimo

Para reconstruir el entorno local desde cero:

1. copiar `.env.example` como `.env`
2. copiar `.env.dev.example` como `.env.dev`
3. ajustar secretos, puertos y overrides locales
4. validar con `docker compose --env-file .env --env-file .env.dev -f docker-compose-dev.yml config`

La fase activa hoy es `dev`.
`docker-compose-qa.yml` y `docker-compose.yml` deben leerse como scaffolds diferidos hasta que el proyecto entre formalmente en esas fases.

## Runtime Paths

- `APP/volumes/`: mounted source code
- `APP/data/<env>`: persistent service data
- `APP/logs/<env>`: persistent service logs
- `APP/config/`: persistent container configuration

## Stability Rules

- Prefer deterministic repository state over one-off console fixes.
- Put dependency changes in dependency manifests.
- Put database bootstrap and schema work in ordered init files.
- Keep runtime commands user-driven and documented.
