# MariaDB Container

## Role

Provides the relational database server shared by the custom backend and iTop, using separate databases on the same MariaDB instance.

## Runtime

- Service name: `mariadb`
- Main port in dev: `MARIADB_PORT -> 3306`
- Data volume in dev: `${PROJECT_NAME}_mariadb_data`
- Init scripts: `APP/config/mariadb/init`
- Logs mount: `APP/logs/<env>/mariadb`

## Security Rules

- Root is only for bootstrap and maintenance.
- Application services must not connect as root.
- Keep privileges scoped to the required databases.

## Init Convention

- Bootstrap files and SQL migrations are ordered lexicographically.
- Current folder uses decadal blocks: `00`, `10`, `20`, `30`, `40`, `70`, `80`, `90`.

## Notes

- If a task touches schemas, grants, seeds, or indexes, start here.
- `APP_DB_NAME` stores Hub auth metadata separately from `ITOP_DB_NAME`.
- Personal iTop tokens for Hub users are persisted encrypted in `hub_user_auth`; Redis only keeps short-lived runtime cache.
- Functional settings panels are persisted in `hub_settings_panels`.
- Synchronization task definitions for the settings module are persisted in `hub_sync_tasks`.
- The helper script `APP/config/mariadb/reset_hub_db.sh` is mounted in the container at `/opt/mariadb-tools/reset_hub_db.sh` for manual Hub DB recreation without deleting the MariaDB volume.
