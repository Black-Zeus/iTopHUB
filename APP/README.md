# Estructura base APP

Esta carpeta sigue la convención que ya usa `docker-compose-dev.yml`.

## Estado actual

El stack activo en esta fase es:

- `itop`
- `frontend`
- `backend`
- `worker`
- `pdf-worker`
- `mariadb`
- `redis`
- `mailpit`
- `gotenberg`

## Mapa rápido

- `APP/volumes/itop`: espacio reservado para personalizaciones y artefactos de iTop.
- `APP/volumes/frontend`: código de React.
- `APP/volumes/backend/app`: código del backend Python.
- `APP/volumes/worker/app`: worker principal.
- `APP/volumes/pdf-worker/app`: worker de PDFs.
- `APP/volumes/android_app`: espacio reservado para la app Android.
- `APP/data`: persistencia y configuraciones montadas por Docker para `dev`.
- `APP/logs`: logs por servicio para `dev`.
- `APP/data-qa` y `APP/logs-qa`: paths reservados para QA.
- `APP/data-prd` y `APP/logs-prd`: paths reservados para PRD.

## Convención

- `volumes/`: código fuente vivo para desarrollo con bind mounts.
- `data/`: datos persistentes y archivos de configuración.
- `logs/`: salida persistida por contenedor.
- `data-qa` / `logs-qa`: equivalente para QA.
- `data-prd` / `logs-prd`: equivalente para PRD.

## Próxima integración sugerida

1. Inicializar React en `APP/volumes/frontend`.
2. Integrar iTop contra la base `ITOP_DB_NAME` en la misma MariaDB.
3. Crear FastAPI o Django en `APP/volumes/backend/app`.
4. Implementar colas Redis en `worker` y `pdf-worker`.
5. Definir el servicio `android_app` cuando toque containerizarlo.
