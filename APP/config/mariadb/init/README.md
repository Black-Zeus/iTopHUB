# MariaDB Init Convention

This folder is executed in lexicographic order by the MariaDB entrypoint.

## Order by blocks

- `00_bootstrap_databases.sh`: creates the app and iTop databases using environment variables.
- `00_preamble.sql`: reserved SQL slot before the schema blocks.
- `10_schema_core.sql`: base schema.
- `20_schema_alter.sql`: schema changes after base creation.
- `30_schema_indexes.sql`: indexes and performance objects.
- `40_triggers.sql`: triggers and related automation.
- `70_seed_core.sql`: mandatory seed data.
- `80_seed_catalog.sql`: support or extended seed data.
- `90_postamble.sql`: final SQL tasks.

## Suggested grouping

- `00-09`: bootstrap and preamble.
- `10-19`: base schema.
- `20-29`: schema alters.
- `30-39`: indexes and performance.
- `40-49`: triggers, procedures, events.
- `50-69`: reserved for views, functions, or project-specific migrations.
- `70-89`: seeds and catalogs.
- `90-99`: postamble and validations.

`00_bootstrap_databases.sh` stays as shell because the database names come from environment variables. Everything else follows the decadal grouping so you can grow the folder without losing order.

## Security note

- Root is used only during MariaDB bootstrap to create databases and grants.
- Application containers should connect with non-root database credentials.
- Our custom app containers run as non-root users after image preparation.
