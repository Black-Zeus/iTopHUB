#!/bin/sh
set -eu

INSTALL_ROOT="${ITOP_INSTALL_ROOT:-/var/www/html}"
WORKDIR="${ITOP_INSTALL_WORKDIR:-/tmp/itop-installer}"
PACKAGE_VERSION="${ITOP_PACKAGE_VERSION:-3.2.2-1}"
PACKAGE_URL="${ITOP_PACKAGE_URL:-}"
INSTALL_FORCE="${ITOP_INSTALL_FORCE:-0}"
SOURCEFORGE_BASE_URL="${ITOP_SOURCEFORGE_BASE_URL:-https://sourceforge.net/projects/itop/files/itop}"
DEFAULT_DOCUMENT_ROOT="/var/www/html"
ITOP_WEB_DOCUMENT_ROOT="/var/www/html/web"

log() {
  printf '%s\n' "[itop-installer] $*"
}

fail() {
  printf '%s\n' "[itop-installer] ERROR: $*" >&2
  exit 1
}

find_real_content() {
  find "${INSTALL_ROOT}" -mindepth 1 -maxdepth 1 ! -name '.gitkeep' ! -name '.gitignore' 2>/dev/null | head -n 1 || true
}

resolve_package_url() {
  version="$1"
  listing_url="${SOURCEFORGE_BASE_URL}/${version}/"
  page="$(curl -fsSL "${listing_url}")"

  direct_url="$(printf '%s' "${page}" | grep -Eo "https://downloads\\.sourceforge\\.net/project/itop/files/itop/${version}/[^\"'[:space:]]+\\.zip" | head -n 1 || true)"
  if [ -n "${direct_url}" ]; then
    printf '%s\n' "${direct_url}"
    return 0
  fi

  relative_url="$(printf '%s' "${page}" | grep -Eo "/projects/itop/files/itop/${version}/[^\"'[:space:]]+\\.zip/download[^\"'[:space:]]*" | head -n 1 || true)"
  if [ -n "${relative_url}" ]; then
    printf 'https://sourceforge.net%s\n' "${relative_url}"
    return 0
  fi

  return 1
}

ensure_target_is_safe() {
  current_content="$(find_real_content)"
  if [ -n "${current_content}" ] && [ "${INSTALL_FORCE}" != "1" ]; then
    printf '%s\n' "[itop-installer] El directorio ${INSTALL_ROOT} ya contiene archivos."
    printf '%s' "[itop-installer] Desea eliminar el contenido actual y continuar? [s/N]: "
    read -r confirmation

    case "${confirmation:-N}" in
      [sS])
        INSTALL_FORCE="1"
        ;;
      *)
        fail "Instalacion cancelada por el usuario."
        ;;
    esac
  fi
}

configure_apache_document_root() {
  document_root="$1"

  sed -ri 's!(/var/www/html)(/web)*!'"${document_root}"'!g' /etc/apache2/sites-available/000-default.conf /etc/apache2/apache2.conf
}

reload_apache_if_running() {
  if command -v apachectl >/dev/null 2>&1 && pgrep -x apache2 >/dev/null 2>&1; then
    apachectl -k graceful >/dev/null 2>&1 || true
  fi
}

main() {
  mkdir -p "${INSTALL_ROOT}" "${WORKDIR}"
  ensure_target_is_safe

  package_url="${PACKAGE_URL}"
  if [ -z "${package_url}" ]; then
    package_url="$(resolve_package_url "${PACKAGE_VERSION}")" || fail "No se pudo resolver automaticamente la URL del paquete para ${PACKAGE_VERSION}. Defina ITOP_PACKAGE_URL manualmente."
  fi

  archive_path="${WORKDIR}/itop-package.zip"
  extract_dir="${WORKDIR}/extract"

  rm -rf "${extract_dir}"
  mkdir -p "${extract_dir}"

  log "Version objetivo: ${PACKAGE_VERSION}"
  log "Descargando paquete desde ${package_url}"
  curl -fL "${package_url}" -o "${archive_path}"

  log "Extrayendo paquete"
  unzip -q "${archive_path}" -d "${extract_dir}"

  source_dir="${extract_dir}"
  first_dir="$(find "${extract_dir}" -mindepth 1 -maxdepth 1 -type d | head -n 1 || true)"
  top_level_count="$(find "${extract_dir}" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')"
  if [ "${top_level_count}" = "1" ] && [ -n "${first_dir}" ]; then
    source_dir="${first_dir}"
  fi

  log "Sincronizando archivos en ${INSTALL_ROOT}"
  rsync -a --delete --exclude='.gitkeep' --exclude='.gitignore' "${source_dir}/" "${INSTALL_ROOT}/"

  chown -R www-data:www-data "${INSTALL_ROOT}" || true

  if [ -f "${ITOP_WEB_DOCUMENT_ROOT}/index.php" ]; then
    configure_apache_document_root "${ITOP_WEB_DOCUMENT_ROOT}"
    log "DocumentRoot de Apache ajustado a ${ITOP_WEB_DOCUMENT_ROOT}"
  else
    configure_apache_document_root "${DEFAULT_DOCUMENT_ROOT}"
    log "DocumentRoot de Apache ajustado a ${DEFAULT_DOCUMENT_ROOT}"
  fi

  reload_apache_if_running

  log "Instalacion de archivos completada."
  log "Puede abrir ahora http://localhost:${ITOP_PORT:-8080} para continuar con el instalador web de iTop."
}

main "$@"
