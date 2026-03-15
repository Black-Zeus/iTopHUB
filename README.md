# iTop Hub

`iTop Hub` es un sistema complementario a iTop orientado a expandir las capacidades operativas de gestión sobre la CMDB, sin modificar el core de iTop ni alterar sus schemas base.

La idea del proyecto es agregar una capa funcional adicional para resolver necesidades operativas que normalmente no conviene implementar dentro del core del sistema, preservando estabilidad, mantenibilidad y compatibilidad futura con la plataforma principal.

## Estado actual

La fase activa hoy es `dev`, usando [docker-compose-dev.yml](/docker-compose-dev.yml) como stack principal y fuente activa de verdad para la arquitectura Docker.

Servicios considerados en esta etapa:

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

Los archivos [docker-compose.yml](/docker-compose.yml) y [docker-compose-qa.yml](/docker-compose-qa.yml) se mantienen como scaffolds de promoción para fases posteriores.
No deben tomarse todavía como referencia funcional cerrada del proyecto hasta que se abra formalmente la etapa `qa` o `prd`.

## Objetivo del proyecto

Este proyecto busca complementar la gestión de activos y procesos asociados a la CMDB con funcionalidades adicionales, manteniendo una separación clara respecto del núcleo de iTop.

Las mejoras previstas incluyen:

- generación de actas de entrega y recepción
- generación de documentos PDF
- manejo de registros y trazabilidad de laboratorio
- sincronización con el core de la CMDB
- vistas y flujos operativos más específicos para el equipo de soporte

Todo esto se diseña bajo una restricción central:

- no modificar el core de iTop
- no modificar los schemas base del core
- no acoplar lógica operativa sensible directamente dentro de la plataforma base si puede vivir en esta capa complementaria

## Enfoque de integración

La arquitectura está pensada para convivir con iTop, no para reemplazarlo.

El Hub:

- consume y complementa información de CMDB
- agrega flujos documentales y operativos
- centraliza lógica propia en servicios desacoplados
- permite evolucionar funcionalidades sin comprometer el núcleo de la plataforma base

Este enfoque reduce riesgo de mantenimiento, evita personalizaciones invasivas y facilita futuras actualizaciones de iTop.

## Enrutamiento

`nginx` forma parte del stack para encapsular el acceso por reverse proxy y desacoplar mejor las rutas publicadas.

La configuracion actual deja preparada esta idea:

- `/` -> iTop en desarrollo
- `/api/` -> backend del Hub
- `/integration/hub/` -> frontend del Hub

En `dev`, `iTop` sigue corriendo como dependencia temporal para facilitar integracion local.
En `qa` y `prd`, la intencion es consumir el sitio original de iTop y mantener el Hub por fuera del core.

## Estructura principal

- [APP](/APP): código fuente montado en los contenedores.
- [APP/data](/APP/data): datos persistentes por entorno.
- [APP/logs](/APP/logs): logs persistentes por entorno.
- [APP/config](/APP/config): configuraciones persistentes de arranque y runtime para contenedores.
- [docker](/docker): Dockerfiles y archivos de build del proyecto.
- [docs](/docs): documentación por contenedor, dominio y operación.
- [Draft](/Draft): espacio estructurado para borradores de UI, PDF y mails previos a implementación.

## Gobernanza del proyecto

- [AGENTS.md](/AGENTS.md): reglas generales de trabajo, convenciones, buenas prácticas y criterios técnicos.
- [REGENERATE.md](/REGENERATE.md): guía para regenerar o extender documentación y reglas sin duplicaciones ni contradicciones.
- [docs/README.md](/docs/README.md): índice general de documentación.

## Operación

La operación de runtime está pensada para ser gestionada por el usuario mediante `docker_tools_v3.sh`.
El repositorio debe quedar preparado mediante archivos, configuración y documentación, evitando depender de ejecuciones manuales ad hoc desde el host.

## Levantar el proyecto

Para iniciar el stack usando tu flujo habitual:

1. Dar permisos al script si todavía no los tiene:

```bash
chmod +x docker_tools_v3.sh
```

2. Ejecutar el menú:

```bash
bash docker_tools_v3.sh
```

3. Desde el menú principal:
   `1) MANEJADOR DE CONTENEDORES`

4. Luego:
   `1) Iniciar contenedores y construir imágenes`

Con esa secuencia se levanta el proyecto usando la lógica del script y los labels `stack=${PROJECT_NAME}` definidos en el `docker-compose-dev.yml`.

Menú principal:

![Menú principal de Docker Tools](/docs/assets/principal_menu.png)

Submenú para iniciar contenedores:

![Submenú de manejo de contenedores](/docs/assets/meu_contenedores_principal.png)

## Ver logs

Para revisar logs desde el mismo flujo:

1. Ejecutar:

```bash
bash docker_tools_v3.sh
```

2. En el menú principal entrar a:
   `2) MONITOREO Y DIAGNÓSTICO`

3. En el submenú `DOCKER TOOLS - MONITOREO Y DIAGNÓSTICO` seleccionar:
   `1) Ver logs`

Ese camino usa el agrupamiento por stack que necesita `docker_tools_v3.sh`.

Submenú para revisión de logs:

![Submenú de monitoreo y diagnóstico](/docs/assets/menu_monitoreo_principal.png)

## Herramientas opcionales

Algunas herramientas auxiliares no se levantan por defecto.

- `redisinsight` vive bajo `profiles: ["tools"]` en `dev` y `qa`.
- si no activás el profile, el contenedor no aparece en estado pausado ni detenido porque directamente no forma parte del stack levantado en ese arranque.

Con Docker Compose directo, se puede levantar así:

```bash
docker compose --env-file .env --env-file .env.dev --profile tools -f docker-compose-dev.yml up -d redisinsight
```

Y para levantar todo el stack base mas herramientas:

```bash
docker compose --env-file .env --env-file .env.dev --profile tools -f docker-compose-dev.yml up -d
```

## Variables de entorno

- [.env.example](/.env.example): base común versionada.
- [.env.dev.example](/.env.dev.example): plantilla de desarrollo.
- [.env.qa.example](/.env.qa.example): plantilla de QA.
- [.env.prd.example](/.env.prd.example): plantilla de producción.

Los archivos reales `.env`, `.env.dev`, `.env.qa` y `.env.prd` no se suben al repositorio.

Para preparar un entorno local:

1. copiar `.env.example` como `.env`
2. copiar el archivo de ejemplo del entorno deseado, por ejemplo `.env.dev.example` como `.env.dev`
3. ajustar secretos, puertos y rutas según el escenario

Regla de lectura:

- `.env` contiene valores comunes.
- `.env.dev`, `.env.qa` y `.env.prd` solo contienen overrides del entorno.
- los archivos `*.example` son la fuente versionada para reconstruir el entorno local en un clon limpio.

Para la fase actual, la combinación esperada es:

```bash
docker compose --env-file .env --env-file .env.dev -f docker-compose-dev.yml config
```

Si ese comando resuelve correctamente la configuración, el bootstrap documental y de paths del entorno está completo.

## Base de datos

La inicialización de MariaDB se organiza en bloques dentro de [APP/config/mariadb/init](/APP/config/mariadb/init), separando bootstrap, schema, índices, seeds y postamble.
La base local sigue la lógica del stack actual: una instancia MariaDB compartida con bases separadas para la app (`APP_DB_NAME`) y para iTop (`ITOP_DB_NAME`) cuando aplica.

## Documentación útil

- [docs/containers/mariadb.md](/docs/containers/mariadb.md)
- [docs/containers/itop.md](/docs/containers/itop.md)
- [docs/containers/nginx.md](/docs/containers/nginx.md)
- [docs/containers/backend.md](/docs/containers/backend.md)
- [docs/containers/frontend.md](/docs/containers/frontend.md)
- [docs/domains/cmdb.md](/docs/domains/cmdb.md)
- [docs/operations/runtime-workflow.md](/docs/operations/runtime-workflow.md)
