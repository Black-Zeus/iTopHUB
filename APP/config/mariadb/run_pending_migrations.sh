#!/bin/sh
set -eu

# Aplica, en orden, todas las migraciones de init/app/ cuyo prefijo de fecha
# (YYYYMMDD) sea mayor o igual a la fecha indicada. Pensado para bases ya
# existentes, donde docker-entrypoint-initdb.d ya no vuelve a ejecutarse.
#
# Uso:
#   sh run_pending_migrations.sh <YYYYMMDD>
#
# Ejemplo (desde dentro del contenedor mysql, donde este directorio esta
# montado en /opt/mariadb-tools):
#   docker compose exec mysql sh /opt/mariadb-tools/run_pending_migrations.sh 20260714

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_INIT_DIR="${SCRIPT_DIR}/init/app"
DB_CLIENT="${DB_CLIENT:-mysql}"

if ! command -v "${DB_CLIENT}" >/dev/null 2>&1; then
  DB_CLIENT="mariadb"
fi

usage() {
  echo "Uso: $0 <YYYYMMDD>" >&2
  echo "Ejecuta, en orden, las migraciones de ${APP_INIT_DIR} con fecha >= YYYYMMDD." >&2
}

if [ "$#" -ne 1 ]; then
  usage
  exit 1
fi

FROM_DATE="$1"

case "${FROM_DATE}" in
  [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;;
  *)
    echo "[run-pending-migrations] fecha invalida: '${FROM_DATE}' (formato esperado YYYYMMDD)" >&2
    exit 1
    ;;
esac

run_mariadb() {
  "${DB_CLIENT}" -u root -p"${MARIADB_ROOT_PASSWORD}" "$@"
}

MIGRATIONS=""
for sql_file in "${APP_INIT_DIR}"/*.sql; do
  [ -f "${sql_file}" ] || continue
  file_name="${sql_file##*/}"
  file_date="${file_name%%_*}"
  case "${file_date}" in
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;;
    *)
      echo "[run-pending-migrations] omitido (sin prefijo de fecha valido): ${file_name}" >&2
      continue
      ;;
  esac
  if [ "${file_date}" -ge "${FROM_DATE}" ]; then
    MIGRATIONS="${MIGRATIONS} ${sql_file}"
  fi
done

if [ -z "${MIGRATIONS}" ]; then
  echo "[run-pending-migrations] no hay migraciones con fecha >= ${FROM_DATE}"
  exit 0
fi

echo "[run-pending-migrations] se aplicaran sobre '${APP_DB_NAME}' (en orden):"
for sql_file in ${MIGRATIONS}; do
  echo "  - ${sql_file##*/}"
done

for sql_file in ${MIGRATIONS}; do
  echo "[run-pending-migrations] aplicando ${sql_file##*/}"
  run_mariadb "${APP_DB_NAME}" < "${sql_file}"
done

echo "[run-pending-migrations] listo."
