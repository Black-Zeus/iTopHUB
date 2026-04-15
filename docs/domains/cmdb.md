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
- The visibility of assets in state `Obsoleto` is controlled from `Configuracion > CMDB` and must be applied consistently in `Activos` and in the CMDB objects shown from `Personas`.
- The visibility of assets in state `Implementation` must also be controlled from `Configuracion > CMDB`, because those objects are treated as non-productive inventory and should follow the same cross-module rule.
- Asset detail should be read from iTop at query time instead of relying on local placeholder inventories.
