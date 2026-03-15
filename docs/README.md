# Indice De Documentacion

Esta carpeta centraliza notas operativas y tecnicas de la arquitectura basada en Docker.

## Gobernanza

- `../AGENTS.md`
- `../REGENERATE.md`

## Contenedores

- `containers/frontend.md`
- `containers/backend.md`
- `containers/worker.md`
- `containers/pdf-worker.md`
- `containers/itop.md`
- `containers/nginx.md`
- `containers/mariadb.md`
- `containers/redis.md`
- `containers/redis.md` (incluye nota sobre `redisinsight`)
- `containers/mailpit.md`
- `containers/gotenberg.md`

## Dominios

- `domains/cmdb.md`
- `domains/handover.md`
- `domains/reception.md`
- `domains/laboratory.md`
- `domains/reporting.md`

## Operacion

- `operations/runtime-workflow.md`

## Regla De Documentacion

Cuando una decision afecta principalmente a un contenedor, documentarla primero en ese archivo de `containers/`.
Cuando una decision afecta flujos, reglas de negocio, entidades o procesos de usuario, documentarla en el dominio correspondiente.
Cuando una decision afecta limites de ejecucion, uso de entornos, bootstrap o responsabilidades operativas, documentarla en `docs/operations/`.
