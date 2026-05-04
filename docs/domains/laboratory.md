# Laboratory Domain

## Scope

Covers diagnosis, repair workflow, evidence, status transitions, and technical handling of equipment under review.

## Current Intent

- Laboratory work should be traceable and operationally distinct from standard asset assignment flows.
- Laboratory actas move through three explicit phases:
  - reception
  - analysis / processing
  - closure
- `reason` records the main intake cause. `requested_actions` records one or more technical actions to execute; these catalogs must stay separate so operators do not choose the same value twice for different meanings.
- The laboratory closure ticket in iTop is an activity record only. It may create a `UserRequest`, attach generated PDFs, and link the CI to the ticket, but it must not modify CI status, assignment, or location.
- If closure requires a CI status change, the Hub must create a linked normalization acta. The normalization module owns the later CMDB mutation.

## Notes

- Keep status models explicit.
- Prefer auditable transitions over free-form text state changes.
- Use `Sin modificar CMDB` / `no_change` when the laboratory closure does not require normalization.
- Laboratory closure lists native iTop CI status values and the Hub only adds `no_change`; it must not maintain a parallel local status catalog for CMDB derivation.
- If iTop exposes `obsolete`, that native value covers obsoleto/baja; the Hub must not add a separate local baja status.
- `normalization_act_code` links the laboratory record to the generated normalization acta.
