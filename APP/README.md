# Estructura base APP

Esta carpeta sigue la convención que ya usa `docker-compose-dev.yml`.

## Estado actual

El stack activo en esta fase es:

- `nginx`
- `itop`
- `frontend`
- `backend`
- `worker`
- `pdf-worker`
- `mariadb`
- `redis`
- `mailpit`
- `gotenberg`

Las carpetas `APP/data/qa`, `APP/logs/qa`, `APP/data/prd` y `APP/logs/prd` se dejan preparadas por portabilidad, pero la referencia activa hoy sigue siendo `dev`.

## Mapa rápido

- `APP/volumes/itop`: espacio reservado para personalizaciones y artefactos de iTop.
- `APP/volumes/frontend`: código de React.
- `APP/volumes/backend/app`: código del backend Python.
- `APP/volumes/worker/app`: worker principal.
- `APP/volumes/pdf-worker/app`: worker de PDFs.
- `APP/volumes/android_app`: espacio reservado para la app Android.
- `APP/data/dev` y `APP/logs/dev`: persistencia activa de desarrollo.
- `APP/data/qa` y `APP/logs/qa`: persistencia reservada para QA.
- `APP/data/prd` y `APP/logs/prd`: persistencia reservada para PRD.
- `APP/config/`: configuraciones persistentes de MariaDB, Redis, Nginx y worker.

## Convención

- `volumes/`: código fuente vivo para desarrollo con bind mounts.
- `data/`: datos persistentes por entorno.
- `logs/`: logs persistentes por entorno.
- `APP/config/`: configuraciones de arranque y runtime compartidas.

Notas de fase:

- `nginx` es parte del stack para centralizar el reverse proxy.
- `itop` se mantiene solo como dependencia temporal en `dev`.
- `mailpit` se considera herramienta de soporte para `dev` y `qa`.

## Próxima integración sugerida

1. Inicializar React en `APP/volumes/frontend`.
2. Integrar iTop contra la base `ITOP_DB_NAME` en la misma MariaDB.
3. Crear FastAPI o Django en `APP/volumes/backend/app`.
4. Implementar colas Redis en `worker` y `pdf-worker`.
5. Definir el servicio `android_app` cuando toque containerizarlo.
