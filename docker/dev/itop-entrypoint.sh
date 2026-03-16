#!/bin/sh
set -eu

TARGET_DIR="/var/www/html"
INDEX_FILE="${TARGET_DIR}/index.php"
HTACCESS_FILE="${TARGET_DIR}/.htaccess"
WEB_ROOT_DIR="${TARGET_DIR}/web"
AUTO_INSTALL_IF_EMPTY="${ITOP_AUTO_INSTALL_IF_EMPTY:-1}"

configure_apache_document_root() {
  local document_root="$1"

  sed -ri 's!(/var/www/html)(/web)*!'"${document_root}"'!g' /etc/apache2/sites-available/000-default.conf /etc/apache2/apache2.conf
  printf '%s\n' "export APACHE_DOCUMENT_ROOT=${document_root}" > /etc/apache2/envvars.docker
}

create_placeholder() {
  cat > "${INDEX_FILE}" <<'PHP'
<?php
declare(strict_types=1);

$checks = [
    'mysqli' => extension_loaded('mysqli'),
    'pdo_mysql' => extension_loaded('pdo_mysql'),
    'mbstring' => extension_loaded('mbstring'),
    'xml' => extension_loaded('xml'),
    'soap' => extension_loaded('soap'),
    'zip' => extension_loaded('zip'),
    'gd' => extension_loaded('gd'),
    'intl' => extension_loaded('intl'),
    'ldap' => extension_loaded('ldap'),
];
?>
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>iTop PHP Runtime Ready</title>
    <style>
      body { font-family: Arial, sans-serif; background:#0c1720; color:#ecf7fb; margin:0; padding:32px; }
      main { max-width: 900px; margin: 0 auto; background:#122330; border:1px solid #2a475d; border-radius:16px; padding:32px; }
      h1 { margin-top:0; }
      code { color:#8ce7ff; }
      ul { line-height:1.8; }
      .ok { color:#7dffb3; }
    </style>
  </head>
  <body>
    <main>
      <h1>Runtime PHP listo para iTop</h1>
      <p>El contenedor esta levantado con Apache y extensiones PHP base para instalar iTop manualmente y luego versionarlo para automatizacion.</p>
      <p>DocumentRoot actual: <code>/var/www/html</code></p>
      <h2>Extensiones cargadas</h2>
      <ul>
        <?php foreach ($checks as $ext => $loaded): ?>
          <li><span class="ok"><?php echo $loaded ? 'OK' : 'FALTA'; ?></span> <?php echo htmlspecialchars($ext, ENT_QUOTES, 'UTF-8'); ?></li>
        <?php endforeach; ?>
      </ul>
    </main>
  </body>
</html>
PHP

  cat > "${HTACCESS_FILE}" <<'HTACCESS'
DirectoryIndex index.php
HTACCESS

  chown -R www-data:www-data "${TARGET_DIR}"
}

auto_install_if_needed() {
  if [ "${AUTO_INSTALL_IF_EMPTY}" != "1" ]; then
    return 0
  fi

  if [ ! -x /opt/itop-installer/install_itop.sh ] && [ ! -f /opt/itop-installer/install_itop.sh ]; then
    return 0
  fi

  printf '%s\n' '[itop-entrypoint] volumen iTop vacio detectado, iniciando bootstrap automatico'
  if sh /opt/itop-installer/install_itop.sh; then
    printf '%s\n' '[itop-entrypoint] bootstrap automatico de iTop completado'
  else
    printf '%s\n' '[itop-entrypoint] no se pudo completar el bootstrap automatico; se usara landing minima'
  fi
}

mkdir -p "${TARGET_DIR}"

HAS_REAL_CONTENT="$(find "${TARGET_DIR}" -mindepth 1 -maxdepth 1 ! -name '.gitkeep' ! -name '.gitignore' 2>/dev/null | head -n 1 || true)"

if [ -z "${HAS_REAL_CONTENT}" ]; then
  auto_install_if_needed
  HAS_REAL_CONTENT="$(find "${TARGET_DIR}" -mindepth 1 -maxdepth 1 ! -name '.gitkeep' ! -name '.gitignore' 2>/dev/null | head -n 1 || true)"
fi

if [ ! -f "${INDEX_FILE}" ] && [ -z "${HAS_REAL_CONTENT}" ]; then
  create_placeholder
fi

if [ -f "${WEB_ROOT_DIR}/index.php" ]; then
  configure_apache_document_root "${WEB_ROOT_DIR}"
else
  configure_apache_document_root "${TARGET_DIR}"
fi

exec docker-php-entrypoint "$@"
