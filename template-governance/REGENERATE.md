# REGENERATE.md

## Purpose

This file explains how to regenerate, normalize, or extend project rules and documentation without creating contradictions or unnecessary documentation sprawl.

## Default Regeneration Flow

1. Read `AGENTS.md`.
2. Read `docs/README.md`.
3. Read only the specific documents related to the requested change.
4. Update the smallest correct source of truth.
5. Repair references if needed.

## Rule Priority

Apply guidance in this order:

1. user request
2. `AGENTS.md`
3. `REGENERATE.md`
4. `docs/operations/*.md`
5. `docs/containers/*.md`
6. `docs/domains/*.md`

If two files conflict at the same level, normalize them so only one clear rule remains.

## File Creation Policy

Create a new file only when:

- a new container/service exists
- a new domain exists
- a new operational workflow exists
- an existing file would become hard to scan if expanded further

Otherwise, update the closest existing file.

## Lean Documentation Policy

Avoid:

- duplicate indexes
- repeated rulebooks with the same content
- speculative docs for features not yet relevant
- “quick reference” clones of existing guidance

## Portable Bootstrap

When copied to a new repository:

1. inspect the repository structure
2. create or adapt `AGENTS.md`
3. create or adapt `docs/README.md`
4. create only the `docs/` files needed by the real architecture
5. keep the system lean

## Completion Checks

Before finishing:

- remove stale references
- avoid duplicated rules
- verify referenced paths exist
- keep the result more useful, not more rigid
