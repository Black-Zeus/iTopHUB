# iTop Installer

Este directorio se monta dentro del contenedor `itop` en modo solo lectura:

- `/opt/itop-installer`

Objetivo:

- descargar iTop bajo demanda
- poblar `/var/www/html` sin guardar toda la estructura del producto en Git
- mantener la llamada manual y explicita

Comando de uso:

```sh
sh /opt/itop-installer/install_itop.sh
```

Variables soportadas:

- `ITOP_PACKAGE_VERSION=3.2.2-1`
- `ITOP_PACKAGE_URL=` para forzar una URL directa
- `ITOP_INSTALL_FORCE=0`

Comportamiento:

- si `ITOP_PACKAGE_URL` esta vacia, el script intenta localizar el zip de la version fija en SourceForge
- descarga el paquete
- extrae el contenido
- sincroniza los archivos dentro de `/var/www/html`
- no corre el instalador web ni modifica la base automaticamente

Esto evita subir a GitHub el codigo completo de iTop y deja la instalacion repetible.
