# Runtime Workflow

## Execution Boundary

This project is operated through Docker.
The user controls runtime operations with `docker_tools_v2.sh`.

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

## Stability Rules

- Prefer deterministic repository state over one-off console fixes.
- Put dependency changes in dependency manifests.
- Put database bootstrap and schema work in ordered init files.
- Keep runtime commands user-driven and documented.
