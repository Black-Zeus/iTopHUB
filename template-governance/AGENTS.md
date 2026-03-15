# AGENTS.md

## Purpose

This repository uses a lightweight governance model:

- `AGENTS.md` for general working rules
- `REGENERATE.md` for regeneration and normalization rules
- `docs/` for container, domain, and operations knowledge

Read this file first.
If the task is about regenerating or reorganizing documentation/rules, read `REGENERATE.md` next.

## Working Style

- Prefer minimal, explicit architecture over over-engineering.
- Keep documentation lean and navigable.
- Avoid duplicate rules across multiple files.
- Prefer updating an existing source of truth before creating a new file.
- Follow best practices unless the project explicitly documents a different decision.
- Avoid code duplication. Centralize shared logic in utilities, helpers, services, or shared modules.
- Keep files cohesive and responsibility-driven.

## Execution Policy

- Respect the repository execution boundary.
- Do not assume host runtimes are available unless the project explicitly says so.
- Prefer repository changes over ad hoc runtime actions.
- If runtime action is required, document clearly what the user must execute.

## Naming Conventions

- Follow each language/framework standard.
- Python:
  - modules, files, variables, functions: `snake_case`
  - classes: `PascalCase`
  - constants: `UPPER_SNAKE_CASE`
- JavaScript / React:
  - variables and functions: `camelCase`
  - components: `PascalCase`
  - hooks: `camelCase` with `use` prefix
  - non-component files: `kebab-case`
- SQL:
  - tables, columns, indexes, constraints: `snake_case`
- Environment variables:
  - `UPPER_SNAKE_CASE`
- Infrastructure folder names and service names:
  - `kebab-case`

## Engineering Rules

- Reuse before rewriting.
- Keep domain logic out of presentation layers when possible.
- Prefer small, testable units.
- Add comments only when intent is not obvious.
- Put dependency changes in manifest files, not in undocumented manual steps.

## Git Convention

- Use small, focused commits.
- Use imperative commit messages.
- Prefer conventional commits:
  - `feat: ...`
  - `fix: ...`
  - `docs: ...`
  - `refactor: ...`
  - `chore: ...`
- Keep one concern per commit whenever practical.

## Base Structure Guidance

- `docs/containers/`: technical notes per container/service
- `docs/domains/`: business or functional domains
- `docs/operations/`: runtime, environments, and operational boundaries

## Where To Look

- Index: `docs/README.md`
- Regeneration rules: `REGENERATE.md`
- Containers: `docs/containers/`
- Domains: `docs/domains/`
- Operations: `docs/operations/`
