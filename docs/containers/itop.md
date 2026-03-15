# iTop Container

## Role

Runs the iTop platform used as the ITSM/CMDB base of the solution.

## Runtime

- Service name: `itop`
- Main port in dev: `ITOP_PORT -> 80`
- Volume mount: `APP/volumes/itop`
- Logs mount: `APP/logs/itop`
- Shared MariaDB server with dedicated application database name: `ITOP_DB_NAME`

## Current Intent

- iTop is a platform dependency, not the place for all custom business logic.
- The custom Hub should sit beside it, not inside it unless extension work is truly needed.

## Notes

- Uses non-root database credentials.
- Image/base behavior may evolve once the exact iTop delivery model is finalized.
