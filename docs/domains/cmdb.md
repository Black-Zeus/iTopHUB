# CMDB Domain

## Scope

Covers assets, inventory records, operational status, lifecycle state, ownership, location, and CMDB synchronization with iTop.

## Current Intent

- iTop is the CMDB platform base.
- The custom Hub can expose workflows and views that are more operational than native iTop screens.
- Asset naming, identifiers, and lifecycle states should stay consistent across UI, backend, and database structures.

## Notes

- Prefer one source of truth for asset identity.
- Avoid duplicating CMDB concepts with slightly different names across modules.
- The `Activos` view in the Hub should list only the CMDB object types enabled in `Configuracion > CMDB`.
- Asset detail should be read from iTop at query time instead of relying on local placeholder inventories.
