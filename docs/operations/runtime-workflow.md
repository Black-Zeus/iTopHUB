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

## Terminal Access In Containers

- `docker_tools_v3.sh` is the supported interactive entry point for container shells.
- When the user chooses `Abrir terminal en contenedor`, the script now asks whether the shell should open as the container's normal user or as `root`.
- The default path should be the container's normal user.
- `root` access should be used only for package installation, bootstrap, permissions repair, or exceptional maintenance.

## Stack Shutdown Behavior

- `docker_tools_v3.sh` should stop the full compose stack by default when running shutdown or cleanup flows.
- Optional profile services such as `redisinsight` must be included automatically in stack teardown so shared networks can be removed cleanly.

## Interactive Log Streams

- When `docker_tools_v3.sh` opens a foreground log stream, `Ctrl+C` should stop only that stream and return to the menu.
- This behavior is especially important in Windows shells, where unhandled interrupts can otherwise terminate the whole script session.

## Environment Layering

- `.env`: common defaults shared by all environments.
- `.env.dev`: development-specific overrides.
- `.env.qa`: QA-specific overrides.
- `.env.prd`: production-specific overrides.

## Versioned Templates

- `.env.example`

This example file is the reproducible source for rebuilding local environment files in a fresh clone.

## Bootstrap Minimo

Para reconstruir el entorno local desde cero:

1. copiar `.env.example` como `.env`
2. crear `.env.dev`, `.env.qa` o `.env.prd` segun el entorno de trabajo
3. dejar en ese archivo solo overrides del entorno
4. ajustar secretos, puertos y overrides locales
5. validar con `docker compose --env-file .env --env-file .env.dev -f docker-compose-dev.yml config`

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
