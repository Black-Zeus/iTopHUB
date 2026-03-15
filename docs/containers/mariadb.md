# MariaDB Container

## Role

Provides the relational database server shared by the custom backend and iTop, using separate databases on the same MariaDB instance.

## Runtime

- Service name: `mariadb`
- Main port in dev: `MARIADB_PORT -> 3306`
- Data mount: `APP/data/<env>/mariadb_data`
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
