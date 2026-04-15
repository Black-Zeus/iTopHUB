# MariaDB Init Convention

This folder is executed in lexicographic order by the MariaDB entrypoint.

## Order by blocks

- `00_bootstrap_databases.sh`: creates the app and iTop databases using environment variables.
- `00_preamble.sql`: reserved SQL slot before the schema blocks.
- `10_hub_app_init.sh`: applies the Hub schema and seeds explicitly to `APP_DB_NAME`.

The SQL source files for the Hub now live under `APP/config/mariadb/init/app/`.

Important:

- These init scripts provision the Hub database structure in `APP_DB_NAME`.
- They do not create or normalize the internal iTop application schema inside `ITOP_DB_NAME`.
- If a backend query fails against an iTop table, the fix usually belongs to the iTop installation/version or to the backend integration query, not to the Hub init SQL block set.

## Suggested grouping

- `00-09`: bootstrap and preamble.
- `10-19`: base schema.
- `20-29`: schema alters.
- `26_schema_checklists.sql`: schema for checklist templates and their configurable items.
- `27_schema_handover.sql`: schema for handover documents, item snapshots, and checklist answers.
- `30-39`: indexes and performance.
- `40-49`: triggers, procedures, events.
- `50-69`: reserved for views, functions, or project-specific migrations.
- `70-89`: seeds and catalogs.
- `76_seed_checklists.sql`: default administration checklist templates aligned with the current frontend mockup.
- `90-99`: postamble and validations.

`00_bootstrap_databases.sh` stays as shell because the database names come from environment variables. `10_hub_app_init.sh` also stays as shell so the Hub SQL can run explicitly against `APP_DB_NAME` and never depend on the MariaDB default database context.

## Manual recovery

- `APP/config/mariadb/reset_hub_db.sh`: recreates only `APP_DB_NAME` and reapplies the Hub SQL blocks. Use this only when the MariaDB volume already exists and you need to rebuild the Hub database manually without touching `ITOP_DB_NAME`.

## Security note

- Root is used only during MariaDB bootstrap to create databases and grants.
- Application containers should connect with non-root database credentials.
- Our custom app containers run as non-root users after image preparation.
