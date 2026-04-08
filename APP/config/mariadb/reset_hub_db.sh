#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_INIT_DIR="${SCRIPT_DIR}/init/app"

echo "[reset-hub-db] recreando base ${APP_DB_NAME}"

mariadb -u root -p"${MARIADB_ROOT_PASSWORD}" <<SQL
DROP DATABASE IF EXISTS \`${APP_DB_NAME}\`;
CREATE DATABASE \`${APP_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`${APP_DB_NAME}\`.* TO '${MARIADB_USER}'@'%';
FLUSH PRIVILEGES;
SQL

for sql_file in \
  "${APP_INIT_DIR}/10_schema_core.sql" \
  "${APP_INIT_DIR}/20_schema_alter.sql" \
  "${APP_INIT_DIR}/30_schema_indexes.sql" \
  "${APP_INIT_DIR}/40_triggers.sql" \
  "${APP_INIT_DIR}/70_seed_core.sql" \
  "${APP_INIT_DIR}/80_seed_catalog.sql" \
  "${APP_INIT_DIR}/90_postamble.sql"
do
  echo "[reset-hub-db] aplicando ${sql_file##*/}"
  mariadb -u root -p"${MARIADB_ROOT_PASSWORD}" "${APP_DB_NAME}" < "${sql_file}"
done

echo "[reset-hub-db] base ${APP_DB_NAME} lista"
