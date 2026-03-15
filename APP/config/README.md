# Configuracion Persistente

Esta carpeta contiene la configuracion persistente utilizada por los contenedores.

## Uso

- `mariadb/`: bootstrap e inicializacion de base de datos
- `redis/`: configuracion del servidor Redis
- `nginx/`: configuracion del reverse proxy del stack
- `worker/`: archivos temporales o de soporte del worker

El objetivo es separar claramente:

- `APP/`: codigo fuente
- `APP/data/`: datos persistentes de runtime
- `APP/logs/`: logs persistentes
- `APP/config/`: configuracion persistente de los servicios
