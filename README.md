# iTop Hub

`iTop Hub` es un sistema complementario a iTop orientado a expandir las capacidades operativas de gestión sobre la CMDB, sin modificar el core de iTop ni alterar sus schemas base.

La idea del proyecto es agregar una capa funcional adicional para resolver necesidades operativas que normalmente no conviene implementar dentro del core del sistema, preservando estabilidad, mantenibilidad y compatibilidad futura con la plataforma principal.

## Estado actual

La fase activa hoy es `dev`, usando [docker-compose-dev.yml](/home/vsoto/Proyectos/itopHub/docker-compose-dev.yml) como stack principal.

Servicios considerados en esta etapa:

- `itop`
- `frontend`
- `backend`
- `worker`
- `pdf-worker`
- `mariadb`
- `redis`
- `mailpit`
- `gotenberg`

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

## Estructura principal

- [APP](/home/vsoto/Proyectos/itopHub/APP): código montado, datos persistentes y logs por entorno.
- [Data/dokerFile](/home/vsoto/Proyectos/itopHub/Data/dokerFile): Dockerfiles del proyecto.
- [docs](/home/vsoto/Proyectos/itopHub/docs): documentación por contenedor, dominio y operación.
- [Draft](/home/vsoto/Proyectos/itopHub/Draft): maqueta base de referencia visual.

## Gobernanza del proyecto

- [AGENTS.md](/home/vsoto/Proyectos/itopHub/AGENTS.md): reglas generales de trabajo, convenciones, buenas prácticas y criterios técnicos.
- [REGENERATE.md](/home/vsoto/Proyectos/itopHub/REGENERATE.md): guía para regenerar o extender documentación y reglas sin duplicaciones ni contradicciones.
- [docs/README.md](/home/vsoto/Proyectos/itopHub/docs/README.md): índice general de documentación.

## Operación

La operación de runtime está pensada para ser gestionada por el usuario mediante `docker_tools_v2.sh`.
El repositorio debe quedar preparado mediante archivos, configuración y documentación, evitando depender de ejecuciones manuales ad hoc desde el host.

## Variables de entorno

- [.env](/home/vsoto/Proyectos/itopHub/.env): valores comunes.
- [.env.dev](/home/vsoto/Proyectos/itopHub/.env.dev): sobrescrituras de desarrollo.
- [.env.qa](/home/vsoto/Proyectos/itopHub/.env.qa): sobrescrituras de QA.
- [.env.prd](/home/vsoto/Proyectos/itopHub/.env.prd): sobrescrituras de producción.

## Base de datos

La inicialización de MariaDB se organiza en bloques dentro de [APP/data/settings/mariadb/init](/home/vsoto/Proyectos/itopHub/APP/data/settings/mariadb/init), separando bootstrap, schema, índices, seeds y postamble.

## Documentación útil

- [docs/containers/mariadb.md](/home/vsoto/Proyectos/itopHub/docs/containers/mariadb.md)
- [docs/containers/itop.md](/home/vsoto/Proyectos/itopHub/docs/containers/itop.md)
- [docs/containers/backend.md](/home/vsoto/Proyectos/itopHub/docs/containers/backend.md)
- [docs/containers/frontend.md](/home/vsoto/Proyectos/itopHub/docs/containers/frontend.md)
- [docs/domains/cmdb.md](/home/vsoto/Proyectos/itopHub/docs/domains/cmdb.md)
- [docs/operations/runtime-workflow.md](/home/vsoto/Proyectos/itopHub/docs/operations/runtime-workflow.md)
