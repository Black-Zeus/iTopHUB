# Documentation Index

This folder centralizes operational notes for the Docker-based architecture.

## Governance

- `../AGENTS.md`
- `../REGENERATE.md`

## Containers

- `containers/frontend.md`
- `containers/backend.md`
- `containers/worker.md`
- `containers/pdf-worker.md`
- `containers/itop.md`
- `containers/mariadb.md`
- `containers/redis.md`
- `containers/mailpit.md`
- `containers/gotenberg.md`

## Domains

- `domains/cmdb.md`
- `domains/handover.md`
- `domains/reception.md`
- `domains/laboratory.md`
- `domains/reporting.md`

## Operations

- `operations/runtime-workflow.md`

## Documentation Rule

When a decision affects one container more than the others, document it in that container file first.
When a decision affects workflows, business rules, records, or user-facing processes, document it in the matching domain file.
When a decision affects execution boundaries, environment usage, or operational responsibilities, document it in `docs/operations/`.
