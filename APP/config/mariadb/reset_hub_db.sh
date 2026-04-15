#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_INIT_DIR="${SCRIPT_DIR}/init/app"
HUB_USERS_TABLE="hub_users"
BACKUP_DB_NAME="${APP_DB_NAME}__reset_backup"
BACKUP_CREATED=0

run_mariadb() {
  mariadb -u root -p"${MARIADB_ROOT_PASSWORD}" "$@"
}

cleanup_backup_db() {
  if [ "${BACKUP_CREATED}" -eq 1 ]; then
    run_mariadb <<SQL
DROP DATABASE IF EXISTS \`${BACKUP_DB_NAME}\`;
SQL
  fi
}

hub_users_table_exists() {
  run_mariadb -N -B -e "SHOW TABLES FROM \`${APP_DB_NAME}\` LIKE '${HUB_USERS_TABLE}'" 2>/dev/null | grep -qx "${HUB_USERS_TABLE}"
}

confirm_hub_users_reset() {
  case "${RESET_HUB_DB_CONFIRM_USERS:-}" in
    yes|YES|true|TRUE|1)
      return 0
      ;;
    no|NO|false|FALSE|0)
      return 1
      ;;
  esac

  if [ ! -t 0 ]; then
    echo "[reset-hub-db] la tabla ${HUB_USERS_TABLE} existe; ejecuta el script en modo interactivo o define RESET_HUB_DB_CONFIRM_USERS=yes|no" >&2
    exit 1
  fi

  printf "[reset-hub-db] se encontro la tabla %s. Deseas eliminarla junto con su contenido? [y/N]: " "${HUB_USERS_TABLE}" >&2
  read -r answer || answer=""

  case "${answer}" in
    y|Y|yes|YES|s|S|si|SI)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

preserve_hub_users_backup() {
  echo "[reset-hub-db] respaldando ${HUB_USERS_TABLE} antes del reset"
  run_mariadb <<SQL
DROP DATABASE IF EXISTS \`${BACKUP_DB_NAME}\`;
CREATE DATABASE \`${BACKUP_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE \`${BACKUP_DB_NAME}\`.\`${HUB_USERS_TABLE}\` LIKE \`${APP_DB_NAME}\`.\`${HUB_USERS_TABLE}\`;
INSERT INTO \`${BACKUP_DB_NAME}\`.\`${HUB_USERS_TABLE}\`
SELECT * FROM \`${APP_DB_NAME}\`.\`${HUB_USERS_TABLE}\`;
SQL
  BACKUP_CREATED=1
}

restore_hub_users_backup() {
  echo "[reset-hub-db] restaurando ${HUB_USERS_TABLE}"
  run_mariadb <<SQL
DELETE FROM \`${APP_DB_NAME}\`.\`${HUB_USERS_TABLE}\`;
INSERT INTO \`${APP_DB_NAME}\`.\`${HUB_USERS_TABLE}\`
SELECT * FROM \`${BACKUP_DB_NAME}\`.\`${HUB_USERS_TABLE}\`;
SET @hub_users_next_id := (
  SELECT COALESCE(MAX(id), 0) + 1
  FROM \`${APP_DB_NAME}\`.\`${HUB_USERS_TABLE}\`
);
SET @hub_users_auto_sql := CONCAT(
  'ALTER TABLE \`${APP_DB_NAME}\`.\`${HUB_USERS_TABLE}\` AUTO_INCREMENT = ',
  @hub_users_next_id
);
PREPARE hub_users_auto_stmt FROM @hub_users_auto_sql;
EXECUTE hub_users_auto_stmt;
DEALLOCATE PREPARE hub_users_auto_stmt;
SQL
}

trap cleanup_backup_db EXIT INT TERM

PRESERVE_HUB_USERS=0

if hub_users_table_exists; then
  if confirm_hub_users_reset; then
    echo "[reset-hub-db] se eliminara ${HUB_USERS_TABLE} junto con el resto de la base"
  else
    PRESERVE_HUB_USERS=1
    preserve_hub_users_backup
  fi
fi

echo "[reset-hub-db] recreando base ${APP_DB_NAME}"

run_mariadb <<SQL
DROP DATABASE IF EXISTS \`${APP_DB_NAME}\`;
CREATE DATABASE \`${APP_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`${APP_DB_NAME}\`.* TO '${MARIADB_USER}'@'%';
FLUSH PRIVILEGES;
SQL

for sql_file in "${APP_INIT_DIR}"/*.sql; do
  echo "[reset-hub-db] aplicando ${sql_file##*/}"
  run_mariadb "${APP_DB_NAME}" < "${sql_file}"
done

if [ "${PRESERVE_HUB_USERS}" -eq 1 ]; then
  restore_hub_users_backup
fi

echo "[reset-hub-db] base ${APP_DB_NAME} lista"
