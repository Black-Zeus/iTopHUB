# iTop Container

## Role

Runs the iTop platform used as the ITSM/CMDB base of the solution.

## Runtime

- Service name: `itop`
- Main port in dev: `ITOP_PORT -> 80`
- Data volume: `${PROJECT_NAME}_itop_data`
- Logs mount: `APP/logs/<env>/itop`
- Shared MariaDB server with dedicated application database name: `ITOP_DB_NAME`

## Current Intent

- iTop is a platform dependency, not the place for all custom business logic.
- The custom Hub should sit beside it, not inside it unless extension work is truly needed.
- In `dev`, it is exposed behind `nginx` as a temporary local dependency.
- In `qa` and `prd`, the target is the original iTop site, not a local iTop container.
- The current image is a pinned PHP/Apache runtime prepared for manual iTop installation, not an official Combodo image.

## Notes

- Uses non-root database credentials.
- The container is intentionally version-pinned and does not use `latest`.
- If the named Docker volume is empty, the container can auto-bootstrap iTop `3.2.2-1`.
- If the automatic bootstrap fails, the container creates a minimal PHP landing page so the service can start cleanly.
- A read-only installer toolbox is mounted from `APP/config/itop-installer` into `/opt/itop-installer`.
- Manual bootstrap of iTop files can be triggered with `sh /opt/itop-installer/install_itop.sh`.
- The PHP runtime includes `apcu` and an explicit writable `session.save_path` to keep the installation wizard clean.
- The image also includes the MariaDB client so iTop scheduled/manual backups can execute `mysqldump` from inside the `itop` container.
