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
- CMDB operational reports that require responsibility, grouping, useful-life, or warranty calculations should use backend `itop_service` report sources. These services call iTop through the REST/OQL connector, then normalize relationships and dates in backend code instead of exposing fragile raw OQL definitions to the UI.
- Warranty and useful-life reports use iTop CMDB fields such as `move2production` and `end_of_warranty`; filters should remain explicit so operators can decide the lifecycle threshold, for example months in production or days until warranty expiration.
- The report catalog should resolve executable definitions by `current_version`. Historical active rows must not create duplicate cards or duplicate execution targets in the UI.
- If one configured CMDB asset class is not available in the target iTop model, report services may skip that class and continue with the rest; connection, token, SSL, and timeout failures must still surface as real iTop errors.
- `Reportes por correo` is a distinct catalog for n8n-triggered workflows. The user only starts a webhook request; n8n is responsible for the downstream email delivery and normally returns `{"message":"Workflow was started"}`.
- Report parameters are declarative and edited through the `Configuracion > Reporte Correo` parameter designer. The designer must remain generic because new n8n workflows can add future fields without schema changes.
- Parameters named `email`, `mail`, `correo`, `user_email`, `email_to`, or with `source: "user.email"` are resolved from the authenticated Hub user's profile instead of being typed manually.
- Admin users may provide copy recipients when the contract includes an `email_cc`-style parameter. The backend validates comma-separated email lists before calling n8n.
- The backend applies a short per-user/report cooldown so a user cannot request the same email report more than once within three minutes.
