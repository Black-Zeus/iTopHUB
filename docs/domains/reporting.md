# Reporting Domain

## Scope

Covers dashboards, KPIs, summaries, historical views, and export/report generation.

## Current Intent

- Reporting should consolidate operational data from CMDB, handover, reception, and laboratory flows.
- Distinguish clearly between operational dashboards and formal exported documents.

## Notes

- Reuse shared query logic or service methods for KPIs rather than duplicating calculations in multiple layers.
- Laboratory reports must read from `hub_lab_records`, not from `hub_handover_documents`.
- Operational documentary reports may unify handover and laboratory sources, but the report definition should make that scope explicit.
- The base catalog includes laboratory historical reports and obsolete-derivation tracking in addition to the open queue view.
