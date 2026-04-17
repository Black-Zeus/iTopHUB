#!/bin/sh
set -eu

APP_RUNTIME_USER="${APP_RUNTIME_USER:-appuser}"
APP_RUNTIME_GROUP="${APP_RUNTIME_GROUP:-appuser}"

ensure_owned_dir() {
  target_dir="$1"

  mkdir -p "${target_dir}"
  chown "${APP_RUNTIME_USER}:${APP_RUNTIME_GROUP}" "${target_dir}"
  chmod u+rwx "${target_dir}"
}

if [ "$(id -u)" -eq 0 ]; then
  ensure_owned_dir /app/data
  ensure_owned_dir /var/log/app

  for writable_dir in \
    /app/data/handover_documents \
    /app/data/handover_evidence \
    /app/data/settings_assets
  do
    ensure_owned_dir "${writable_dir}"
  done

  exec gosu "${APP_RUNTIME_USER}:${APP_RUNTIME_GROUP}" "$@"
fi

exec "$@"
