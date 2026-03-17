# AGENTS.md

## Purpose

This repository is organized so each container has a dedicated documentation file under `docs/containers/`.
Agents working in this project should read this file first, then open only the container-specific document that matches the task.
For documentation regeneration, normalization, or governance updates, read `REGENERATE.md` immediately after this file.

## Working Style

- Prefer minimal, explicit architecture over over-engineering.
- Docker is the execution boundary for this project.
- The user manages runtime operations through `docker_tools_v3.sh`.
- Do not assume local availability of `node`, `python`, `npm`, `pip`, or similar host tools for agent-driven execution.
- Do not run service restarts, `npm install`, dependency syncs, migrations, or similar operational commands unless the user explicitly asks for them.
- If a change requires runtime execution by the user, state it clearly and leave the repository prepared so the user can perform it later.
- When running host commands through PowerShell, prefer simple single commands over chained expressions or shell-specific shortcuts, because complex command composition is less reliable in this project environment.
- Root should only be used to install packages, bootstrap infrastructure, or prepare the runtime.
- Application processes should run with the minimum privileges required.
- Database clients must not connect as `root` except for bootstrap or emergency maintenance.
- Follow best practices by default unless the project has an explicit reason not to.
- Avoid code duplication. If logic is reused or likely to be reused, move it into a shared utility, service, helper, or module.
- Prefer creating clear base structures early: shared folders, common services, utility modules, typed contracts, and documentation anchors.
- Keep files cohesive. One file should own one clear responsibility.
- Prefer composition over scattered copy-paste implementations.
- Environment variables are layered:
  - `.env` contains common defaults.
  - `.env.dev`, `.env.qa`, `.env.prd` only override environment-specific values.
  - `.env.example` is the versioned source used to rebuild local environment files.
- Dependency declarations must live in repository-managed files such as `requirements.txt`, `pyproject.toml`, `package.json`, or equivalent.
- Do not solve dependency needs by asking the agent to install them ad hoc on the host.
- MariaDB init files follow ordered execution under `APP/config/mariadb/init`.
- Keep Docker changes focused on the current phase. For now, `docker-compose-dev.yml` is the active target.
- Treat `docker-compose.yml` and `docker-compose-qa.yml` as deferred scaffolds until those phases are explicitly activated by the user.
- If a non-active environment is not being aligned yet, mark it clearly as deferred instead of pretending it is already canonical.
- When documenting a new decision, update the relevant file in `docs/containers/` instead of adding loose notes elsewhere.

## Naming Conventions

- Follow each language or framework standard instead of forcing one style everywhere.
- Python:
  - modules, files, variables, functions: `snake_case`
  - classes: `PascalCase`
  - constants: `UPPER_SNAKE_CASE`
- JavaScript / React:
  - variables and functions: `camelCase`
  - React components: `PascalCase`
  - hooks: `camelCase` with `use` prefix
  - non-component files: `kebab-case`
- SQL:
  - tables, columns, indexes, constraints: `snake_case`
- Environment variables:
  - `UPPER_SNAKE_CASE`
- Docker service names, folder names for infrastructure, and mounted runtime directories:
  - `kebab-case`

## Engineering Rules

- Reuse before rewriting. Search for an existing helper or module before adding new logic.
- If the same behavior appears in more than one place, centralize it.
- Put cross-cutting logic in shared utility locations rather than in feature-specific files.
- Keep domain logic out of UI components when it can live in services or backend modules.
- Prefer small, testable units over large multi-purpose files.
- Name things by responsibility, not by implementation detail.
- Add comments only when the intent is not obvious from the code.
- Build with future QA/PRD promotion in mind, even if only dev is active now.
- If code needs a new dependency, update the correct dependency manifest instead of relying on one-off manual installation steps.
- If a change would normally require container reload, rebuild, install, migration, or console execution, tell the user exactly what they need to run.

## Runtime And Execution Policy

- The AI agent should prioritize file changes, configuration updates, and documentation.
- The AI agent should not depend on host-level language runtimes being available.
- Operational execution belongs to the user unless explicitly delegated.
- Prefer wording like:
  - update `package.json` or `requirements.txt`
  - leave the container ready for rebuild/restart
  - tell the user which command or menu action to run in `docker_tools_v3.sh`
- If verification would require running app-specific commands that are not safely available here, report that clearly instead of improvising.

## Git Usage Policy

- Normal Git workflow is allowed for non-destructive repository work.
- Do not create commits unless the user explicitly requests a commit in the current task.
- Allowed Git operations include:
  - `git add`
  - `git commit`
  - `git status`
  - `git log`
  - `git branch`
  - `git switch`
  - `git checkout`
  - `git remote`
  - `git push`
- These operations are acceptable when they support the requested task and do not introduce destructive behavior.
- Do not use destructive Git commands such as `reset --hard`, forced history rewrites, or cleanup commands unless the user explicitly requests them.
- This policy expresses the intended working model for the project, but actual sandbox execution permissions still depend on the environment approval system.

## Git Convention

- Use small, focused commits.
- Keep commits scoped to one concern: infrastructure, docs, backend, frontend, or schema.
- Write commit messages in imperative mood.
- Prefer a conventional format:
  - `feat: add mariadb init block structure`
  - `fix: stop backend from using root db healthcheck`
  - `docs: add container and domain documentation`
  - `refactor: centralize environment layering rules`
  - `chore: align dockerfiles with non-root runtime`
- If the change affects behavior, document the why in the commit body.
- If the change affects configuration, mention the impacted environment or container in the commit body.
- For schema-related changes, reference the migration/init files touched.
- Avoid mixing docs, refactors, and behavior changes in the same commit unless they are inseparable.

## Base Structure Guidance

- `docs/containers/`: technical and operational notes per container.
- `docs/domains/`: functional and business-domain notes.
- `docs/operations/`: workflow, execution boundary, and environment usage notes.
- `Draft/`: structured pre-implementation drafts for UI, PDFs, mails, and related exploratory artifacts.
- `APP/volumes/`: live application source code mounted in containers.
- `APP/data/`: runtime data organized by environment.
- `APP/logs/`: service logs organized by environment.
- `APP/config/`: persistent container configuration, bootstrap files, and startup assets.
- `docker/`: image definitions and container build assets.

Phase rule:

- `docker-compose-dev.yml` is the active reference implementation.
- `docker-compose-qa.yml` and `docker-compose.yml` may exist ahead of time, but they should be documented as deferred scaffolds until promoted.

When a new cross-project concern appears, create a dedicated place for it early instead of scattering one-off files.

## Where To Look

- General documentation index: `docs/README.md`
- Regeneration guide: `REGENERATE.md`
- Operations guide: `docs/operations/runtime-workflow.md`
- Frontend container: `docs/containers/frontend.md`
- Backend container: `docs/containers/backend.md`
- Worker container: `docs/containers/worker.md`
- PDF worker container: `docs/containers/pdf-worker.md`
- iTop container: `docs/containers/itop.md`
- MariaDB container: `docs/containers/mariadb.md`
- Redis container: `docs/containers/redis.md`
- Mailpit container: `docs/containers/mailpit.md`
- Gotenberg container: `docs/containers/gotenberg.md`
- Nginx container: `docs/containers/nginx.md`
- CMDB domain: `docs/domains/cmdb.md`
- Handover domain: `docs/domains/handover.md`
- Reception domain: `docs/domains/reception.md`
- Laboratory domain: `docs/domains/laboratory.md`
- Reporting domain: `docs/domains/reporting.md`

## Search Rules For Future Agents

- If the task is about regenerating, normalizing, deduplicating, or extending project rules/docs, read `REGENERATE.md`.
- If the task mentions schema, seeds, grants, DB users, or bootstrap, read `docs/containers/mariadb.md`.
- If the task mentions CMDB, ITSM, iTop integration, API sync, or shared database usage, read `docs/containers/itop.md`.
- If the task mentions React, Vite, UI integration, or module migration from `Draft/`, read `docs/containers/frontend.md`.
- If the task mentions business logic, APIs, auth, orchestration, or service integration, read `docs/containers/backend.md`.
- If the task mentions queues, async jobs, background processing, or retries, read `docs/containers/worker.md`.
- If the task mentions PDF generation, documents, rendering, or Gotenberg, read `docs/containers/pdf-worker.md` and `docs/containers/gotenberg.md`.
- If the task mentions reverse proxy, routing, hostnames, or public path layout, read `docs/containers/nginx.md`.
- If the task mentions cache, broker-like behavior, or transient job state, read `docs/containers/redis.md`.
- If the task mentions SMTP, captured emails, or dev notifications, read `docs/containers/mailpit.md`.
- If the task mentions assets, inventory, lifecycle, or CMDB synchronization, read `docs/domains/cmdb.md`.
- If the task mentions delivery certificates, assignment records, or handover flows, read `docs/domains/handover.md`.
- If the task mentions intake, returns, receiving, or incoming asset workflows, read `docs/domains/reception.md`.
- If the task mentions diagnosis, repair, technical review, or queue handling for devices, read `docs/domains/laboratory.md`.
- If the task mentions dashboards, KPIs, analytics, or exports, read `docs/domains/reporting.md`.

## Documentation Maintenance

- Keep container docs short and operational.
- Keep domain docs focused on workflows, entities, and business rules.
- Record decisions, not just descriptions.
- If a service is not in use yet, mark it clearly as reserved or future work.
