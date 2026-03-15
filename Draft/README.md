# Draft

Esta carpeta concentra borradores funcionales y visuales previos a la implementación definitiva.

Su objetivo es permitir explorar decisiones antes de moverlas a:

- `APP/volumes/` para código real
- `APP/config/` para plantillas o configuraciones persistentes
- `docs/` para reglas, flujos o decisiones consolidadas

## Regla principal

Cada draft debe dejar claro:

- qué tipo de draft es
- qué problema intenta resolver
- qué salida final espera producir
- si es solo visual, documental o cercano a implementación

## Tipos de draft

- `ui/`: pantallas, flujos visuales, experiencias de navegación, formularios
- `pdf/`: maquetas o prototipos de documentos PDF
- `mail/`: maquetas o plantillas de correos

## Estructura sugerida

- `Draft/ui/<nombre-del-draft>/`
- `Draft/pdf/<tipo-de-documento>/`
- `Draft/mail/<tipo-de-mail>/`

## Convención de nombres

- usar `kebab-case`
- un draft por carpeta
- si un draft evoluciona, mantener el mismo nombre y registrar el estado en su `README.md`

## Estado actual

- `ui/operations-hub`: mockup principal del Hub operativo
- `pdf/actas-entrega`: reservado para drafts de PDF de actas de entrega
- `pdf/actas-recepcion`: reservado para drafts de PDF de actas de recepción
- `mail/handover`: reservado para mails asociados a entregas
- `mail/reception`: reservado para mails asociados a recepciones

## Criterio para mover un draft

Un draft debe salir de esta carpeta cuando:

- ya no se está explorando, sino implementando
- la estructura o layout quedó aprobado
- se convirtió en una plantilla real del sistema
- ya existe una regla o decisión estable que corresponde documentar en `docs/`
