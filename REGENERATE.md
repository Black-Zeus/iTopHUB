# REGENERATE.md

## Purpose

This file defines how an AI agent should regenerate, extend, or normalize project guidance without creating contradictions, duplicate rules, or unnecessary documentation sprawl.

It is designed to be portable so it can be copied into another repository and used as the bootstrap rulebook for project documentation and operational guidance.

## Core Goal

Regenerate or extend the project guidance in a stable way:

- no contradictory rules
- no duplicated rule sets
- no hidden runtime assumptions
- no unnecessary file proliferation
- no expensive or overly rigid workflows

## Default Strategy

When asked to regenerate docs, rules, or project guidance:

1. Read `AGENTS.md` first.
2. Read `docs/README.md` second.
3. Read only the container, domain, or operations documents that match the requested change.
4. Reuse existing files whenever possible.
5. Add new files only when the information introduces a genuinely new concern or scope.

## Priority Order

When rules overlap, apply them in this order:

1. User request
2. `AGENTS.md`
3. `REGENERATE.md`
4. `docs/operations/*.md`
5. `docs/containers/*.md`
6. `docs/domains/*.md`
7. incidental comments in code or old drafts

If two files conflict at the same level, do not guess. Normalize them so only one clear rule remains documented.

## Regeneration Rules

- Prefer updating an existing file over creating a new one.
- Do not split a document unless the topic has clearly become multi-domain or multi-container.
- Do not duplicate the same rule across many files unless one file is the source of truth and the others only reference it.
- If a rule becomes general, move it upward:
  - container-specific -> `AGENTS.md` or `docs/operations/`
  - domain-specific -> `docs/domains/`
  - operational/execution-specific -> `docs/operations/`
- If a rule becomes too local, move it downward into the most specific document.

## When To Create A New File

Create a new file only if at least one of these is true:

- a new container exists
- a new business domain exists
- a new operational workflow exists
- the current file would become hard to scan if expanded further
- the new information has a distinct lifecycle from existing docs

Otherwise, update the closest existing file.

## Naming Rules For New Documentation

- Root-level governance files:
  - `AGENTS.md`
  - `REGENERATE.md`
- Container docs:
  - `docs/containers/<container-name>.md`
- Domain docs:
  - `docs/domains/<domain-name>.md`
- Operations docs:
  - `docs/operations/<topic-name>.md`

Use `kebab-case` for documentation file names under `docs/`.

## Required Checks Before Finishing

Before considering a regeneration complete, verify:

- there are no stale references to removed files
- the new rules do not duplicate an existing rule without need
- the file paths mentioned actually exist
- the updated structure still reflects the active project phase
- non-active phases are either aligned intentionally or explicitly marked as deferred scaffolds
- the guidance does not require host tools the user does not want the agent to rely on
- the result makes the next agent more effective, not more constrained for no reason

## Documentation Growth Policy

Keep the system lean:

- one index
- one general rulebook
- one regeneration rulebook
- one file per container
- one file per domain
- one file per operational concern only when truly needed

Avoid creating:

- multiple overlapping indexes
- “quick guide” duplicates
- changelog-like docs for internal structure unless explicitly requested
- speculative docs for features not yet relevant

## Portable Bootstrap Procedure

If this file is copied into another project, the agent should:

1. Inspect the repository structure.
2. Create `AGENTS.md` if missing.
3. Create `docs/README.md` if missing.
4. Create these folders if needed:
   - `docs/containers`
   - `docs/domains`
   - `docs/operations`
5. Create only the docs required by the real architecture in that repository.
6. Document runtime boundaries, naming conventions, environment layering, and commit conventions in `AGENTS.md`.
7. Add `REGENERATE.md` as the stable rule for future normalization work.

## Safe Regeneration Pattern

Use this pattern:

1. inspect
2. detect active structure
3. identify contradictions or gaps
4. update the smallest correct source of truth
5. mark deferred or future-phase items explicitly when they are not being aligned yet
6. repair links and references
7. summarize what changed and what remains intentionally deferred

## Non-Goals

This file is not meant to:

- force a skill-based workflow when a markdown rulebook is enough
- create extra steps for simple changes
- replace architecture decisions
- replace container or domain documentation

## Current Project Assumptions

- Docker is the runtime boundary.
- The user controls operational execution.
- The agent should prefer repository changes over runtime actions.
- Documentation should remain concise, navigable, and non-duplicative.
