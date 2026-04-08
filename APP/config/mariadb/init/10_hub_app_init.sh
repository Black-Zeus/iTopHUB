#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_INIT_DIR="${SCRIPT_DIR}/app"

for sql_file in \
  "${APP_INIT_DIR}/10_schema_core.sql" \
  "${APP_INIT_DIR}/20_schema_alter.sql" \
  "${APP_INIT_DIR}/30_schema_indexes.sql" \
  "${APP_INIT_DIR}/40_triggers.sql" \
  "${APP_INIT_DIR}/70_seed_core.sql" \
  "${APP_INIT_DIR}/80_seed_catalog.sql" \
  "${APP_INIT_DIR}/90_postamble.sql"
do
  mariadb -u root -p"${MARIADB_ROOT_PASSWORD}" "${APP_DB_NAME}" < "${sql_file}"
done
