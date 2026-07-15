# MariaDB Init Convention

This folder is executed in lexicographic order by the MariaDB entrypoint.

## Order by blocks

- `00_bootstrap_databases.sh`: creates the Hub app database using environment variables.
- `00_preamble.sql`: reserved SQL slot before the schema blocks.
- `10_hub_app_init.sh`: applies every Hub `.sql` block under `app/` in lexicographic order against `APP_DB_NAME`.

The SQL source files for the Hub now live under `APP/config/mariadb/init/app/`.

Important:

- These init scripts provision the Hub database structure in `APP_DB_NAME`.
- They do not create or normalize any iTop application schema. iTop is consumed as an external service through REST/OQL.
- If a backend query fails against iTop, the fix usually belongs to the external iTop installation/version or to the backend integration query, not to the Hub init SQL block set.

## File naming convention

Files under `init/app/` are named `YYYYMMDD_NNN_description.sql`:

- `YYYYMMDD` is the date the migration was written. `run_pending_migrations.sh` (see "Manual recovery" below) uses this to find everything from a given date onward.
- `NNN` is a 3-digit sequence that reserves a block per unit of work, applied in this order so far:
  - `001-099`: initial schema creation, one file per module (`001_create_core_schema.sql`, `002_create_settings_schema.sql`, `003_create_checklist_schema.sql`, `004_create_handover_schema.sql`, `005_create_reports_schema.sql`, `006_create_lab_schema.sql`).
  - `101-199`: seeds and same-day patches for that initial schema (`101_seed_core.sql` ... `113_patch_report_assets_by_location_order.sql`).
  - `2xx`, `3xx`, ...: each later addition (a new schema domain, or a patch added after go-live) claims the next free hundred-block, usually starting with a schema/seed pair (e.g. `200_create_email_reports_schema.sql` + `201_seed_email_reports_n8n.sql`) or a single patch (e.g. `300_patch_handover_unlink_contacts.sql`, `301_patch_handover_receiver_employee_number.sql`).

There's no fixed global meaning per range beyond "schema/seed comes before the patches that depend on it, within the same date." When adding a new migration, pick the date of the day you're writing it and the next free `NNN` for that date (or a fresh hundred-block if it's a new, unrelated unit of work).

`00_bootstrap_databases.sh` stays as shell because the database names come from environment variables. `10_hub_app_init.sh` also stays as shell so the Hub SQL can run explicitly against `APP_DB_NAME` and never depend on the MariaDB default database context.

## Manual recovery

- `APP/config/mariadb/reset_hub_db.sh`: recreates only `APP_DB_NAME` and reapplies the Hub SQL blocks. Use this only when the MariaDB volume already exists and you need to rebuild the Hub database manually.
- `APP/config/mariadb/run_pending_migrations.sh <YYYYMMDD>`: applies every `.sql` file under `init/app/` dated **on or after** `YYYYMMDD`, in filename order. Use this when the MariaDB volume already exists (so `docker-entrypoint-initdb.d` no longer runs automatically) and new migration files were added after the last deploy — pass the date of the oldest one you still need to apply.

  Each file's date comes from its own name, e.g. `20260714_301_patch_handover_receiver_employee_number.sql` -> `20260714`. `YYYYMMDD` is a **cutoff**, not an exact match: every file whose date is that day or later runs, in order; anything older is skipped.

  Example: if `init/app/` has `20260505_..._create_core_schema.sql`, `20260708_300_patch_handover_unlink_contacts.sql`, and `20260714_301_patch_handover_receiver_employee_number.sql`, running with `20260701` skips the May file and applies the two July ones, in that order:
  ```
  docker compose exec mysql sh /opt/mariadb-tools/run_pending_migrations.sh 20260701
  ```
  Run it from inside the `mysql` container — this folder is mounted read-only there at `/opt/mariadb-tools`. Each `.sql` file must be safe to re-run (e.g. `ADD COLUMN IF NOT EXISTS`), since the script does not track which files already ran.

## Security note

- Root is used only during MariaDB bootstrap to create databases and grants.
- Application containers should connect with non-root database credentials.
- Our custom app containers run as non-root users after image preparation.
