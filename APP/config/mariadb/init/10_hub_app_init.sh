#!/bin/sh
set -eu

APP_INIT_DIR="/docker-entrypoint-initdb.d/app"
FOUND_SQL=0

for sql_file in "${APP_INIT_DIR}"/*.sql; do
  [ -f "${sql_file}" ] || continue
  FOUND_SQL=1
  mariadb -u root -p"${MARIADB_ROOT_PASSWORD}" "${APP_DB_NAME}" < "${sql_file}"
done

if [ "${FOUND_SQL}" -eq 0 ]; then
  echo "[10_hub_app_init] no se encontraron archivos SQL en ${APP_INIT_DIR}" >&2
  exit 1
fi
