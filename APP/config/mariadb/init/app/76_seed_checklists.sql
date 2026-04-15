UPDATE hub_checklist_templates
SET
    name = 'Entrega laptop corporativo',
    description = 'Checklist breve para preparar la entrega de notebooks, validando condicion de salida, estado visual y accesorios base.',
    status = 'active',
    cmdb_class_label = 'Laptop (Laptop)',
    sort_order = 10
WHERE module_code = 'handover'
  AND name = 'Entrega notebook corporativa'
  AND NOT EXISTS (
        SELECT 1
        FROM hub_checklist_templates existing
        WHERE existing.module_code = 'handover'
          AND existing.name = 'Entrega laptop corporativo'
    );

UPDATE hub_checklist_templates
SET status = 'inactive'
WHERE module_code = 'handover'
  AND name = 'Entrega monitor y perifericos';

INSERT INTO hub_checklist_templates (module_code, name, description, status, cmdb_class_label, sort_order)
VALUES
    (
        'lab',
        'Checklist notebook estandar',
        'Plantilla base para recepcion, diagnostico y cierre tecnico de equipos portatiles corporativos.',
        'active',
        'Laptop (Laptop)',
        10
    ),
    (
        'lab',
        'Checklist desktop corporativo',
        'Lista enfocada en validacion fisica, encendido, puertos y perifericos de puesto fijo.',
        'active',
        'Desktop (PC)',
        20
    ),
    (
        'handover',
        'Entrega laptop corporativo',
        'Checklist breve para preparar la entrega de notebooks, validando condicion de salida, estado visual y accesorios base.',
        'active',
        'Laptop (Laptop)',
        10
    ),
    (
        'handover',
        'Entrega desktop corporativo',
        'Checklist breve para preparar puestos desktop, considerando presentacion fisica y elementos base de uso.',
        'active',
        'Desktop (PC)',
        20
    ),
    (
        'handover',
        'Entrega tableta corporativa',
        'Checklist breve para preparar tabletas, validando estado visual y accesorios minimos de salida.',
        'active',
        'Tableta (Tablet)',
        30
    ),
    (
        'handover',
        'Entrega celular corporativo',
        'Checklist breve para entrega de telefonia movil, con foco en condicion fisica y accesorios asociados.',
        'active',
        'Celular (MobilePhone)',
        40
    ),
    (
        'handover',
        'Entrega impresora operativa',
        'Checklist breve para entregar impresoras o equipos de impresion con sus accesorios esenciales.',
        'active',
        'Impresora (Printer)',
        50
    ),
    (
        'handover',
        'Entrega periferico operativo',
        'Checklist breve para perifericos y accesorios, validando integridad fisica y elementos asociados.',
        'active',
        'Periferico (Peripheral)',
        60
    ),
    (
        'reassignment',
        'Reasignacion notebook corporativa',
        'Lista para validar devolucion del usuario origen, estado del activo y conformidad del nuevo custodio.',
        'active',
        NULL,
        10
    ),
    (
        'reassignment',
        'Reasignacion perifericos',
        'Checklist resumido para transferencias de docking, monitor y accesorios operativos.',
        'inactive',
        NULL,
        20
    ),
    (
        'reception',
        'Recepcion usuario final',
        'Plantilla para registrar devolucion de equipo, faltantes visibles y estado recibido.',
        'active',
        NULL,
        10
    ),
    (
        'reception',
        'Recepcion rapida',
        'Version resumida para ingresos operativos de baja complejidad.',
        'inactive',
        NULL,
        20
    )
ON DUPLICATE KEY UPDATE
    description = VALUES(description),
    status = VALUES(status),
    cmdb_class_label = VALUES(cmdb_class_label),
    sort_order = VALUES(sort_order);

UPDATE hub_checklist_items i
JOIN hub_checklist_templates t
    ON t.id = i.template_id
JOIN (
    SELECT 'handover' AS module_code, 'Entrega laptop corporativo' AS template_name, 10 AS sort_order, 'Condicion de salida' AS name, 'Permite distinguir si la entrega corresponde a equipo nuevo o refaccionado/spare.' AS description, 'radio' AS input_type, 'Nuevo' AS option_a, 'Refaccionado o spare' AS option_b
    UNION ALL SELECT 'handover', 'Entrega laptop corporativo', 20, 'Estado visual', 'Valida carcasa, pantalla y tapas sin rayaduras o golpes relevantes.', 'radio', 'Conforme', 'Con detalle'
    UNION ALL SELECT 'handover', 'Entrega laptop corporativo', 30, 'Limpieza para entrega', 'Confirma que el equipo fue preparado en condiciones adecuadas de limpieza y presentacion.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega laptop corporativo', 40, 'Cargador incluido', 'Confirma si el cargador forma parte de la entrega del equipo.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega laptop corporativo', 50, 'Adaptador de red incluido', 'Confirma si el adaptador de red propio del equipo forma parte de esta entrega.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega laptop corporativo', 60, 'Observaciones de preparacion', 'Resume detalles de entrega, marcas menores o elementos adicionales incluidos.', 'text_area', NULL, NULL
    UNION ALL SELECT 'handover', 'Entrega desktop corporativo', 10, 'Condicion de salida', 'Permite distinguir si la entrega corresponde a equipo nuevo o refaccionado/spare.', 'radio', 'Nuevo', 'Refaccionado o spare'
    UNION ALL SELECT 'handover', 'Entrega desktop corporativo', 20, 'Estado visual', 'Valida gabinete y piezas visibles sin rayaduras o golpes relevantes.', 'radio', 'Conforme', 'Con detalle'
    UNION ALL SELECT 'handover', 'Entrega desktop corporativo', 30, 'Limpieza para entrega', 'Confirma que el equipo fue preparado en condiciones adecuadas de limpieza y presentacion.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega desktop corporativo', 40, 'Cableado base incluido', 'Confirma si se entrega con cable de poder y cable de video.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega desktop corporativo', 50, 'Teclado y mouse incluidos', 'Confirma si el puesto considera los perifericos base de usuario.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega desktop corporativo', 60, 'Observaciones de preparacion', 'Resume condicion del puesto o accesorios adicionales preparados.', 'text_area', NULL, NULL
    UNION ALL SELECT 'handover', 'Entrega tableta corporativa', 10, 'Condicion de salida', 'Permite distinguir si la entrega corresponde a equipo nuevo o refaccionado/spare.', 'radio', 'Nuevo', 'Refaccionado o spare'
    UNION ALL SELECT 'handover', 'Entrega tableta corporativa', 20, 'Estado visual', 'Valida pantalla y carcasa sin rayaduras, quiebres o golpes visibles.', 'radio', 'Conforme', 'Con detalle'
    UNION ALL SELECT 'handover', 'Entrega tableta corporativa', 30, 'Limpieza para entrega', 'Confirma que el equipo fue preparado en condiciones adecuadas de limpieza y presentacion.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega tableta corporativa', 40, 'Cargador incluido', 'Confirma si el cargador forma parte de la entrega del equipo.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega tableta corporativa', 50, 'Funda o protector incluido', 'Confirma si la tableta se entrega con funda o protector asociado.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega tableta corporativa', 60, 'Observaciones de preparacion', 'Resume detalles de estado o accesorios complementarios.', 'text_area', NULL, NULL
    UNION ALL SELECT 'handover', 'Entrega celular corporativo', 10, 'Condicion de salida', 'Permite distinguir si la entrega corresponde a equipo nuevo o refaccionado/spare.', 'radio', 'Nuevo', 'Refaccionado o spare'
    UNION ALL SELECT 'handover', 'Entrega celular corporativo', 20, 'Estado visual', 'Valida pantalla, carcasa y tapas sin rayaduras o golpes relevantes.', 'radio', 'Conforme', 'Con detalle'
    UNION ALL SELECT 'handover', 'Entrega celular corporativo', 30, 'Limpieza para entrega', 'Confirma que el equipo fue preparado en condiciones adecuadas de limpieza y presentacion.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega celular corporativo', 40, 'Cargador incluido', 'Confirma si el cargador forma parte de la entrega del equipo.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega celular corporativo', 50, 'Funda o protector incluido', 'Confirma si el equipo se entrega con funda o protector asociado.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega celular corporativo', 60, 'Observaciones de preparacion', 'Resume detalles de condicion, linea o accesorios adicionales.', 'text_area', NULL, NULL
    UNION ALL SELECT 'handover', 'Entrega impresora operativa', 10, 'Condicion de salida', 'Permite distinguir si la entrega corresponde a equipo nuevo o refaccionado/spare.', 'radio', 'Nuevo', 'Refaccionado o spare'
    UNION ALL SELECT 'handover', 'Entrega impresora operativa', 20, 'Estado visual', 'Valida bandejas, carcasa y tapas sin golpes, rayaduras severas o piezas sueltas.', 'radio', 'Conforme', 'Con detalle'
    UNION ALL SELECT 'handover', 'Entrega impresora operativa', 30, 'Limpieza para entrega', 'Confirma que el equipo fue preparado en condiciones adecuadas de limpieza y presentacion.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega impresora operativa', 40, 'Cableado base incluido', 'Confirma si se entrega con cable de poder y conexion necesarios.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega impresora operativa', 50, 'Consumible inicial disponible', 'Confirma si toner, tinta o consumible base acompana la entrega.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega impresora operativa', 60, 'Observaciones de preparacion', 'Resume estado, consumibles o detalles relevantes de salida.', 'text_area', NULL, NULL
    UNION ALL SELECT 'handover', 'Entrega periferico operativo', 10, 'Condicion de salida', 'Permite distinguir si la entrega corresponde a equipo nuevo o refaccionado/spare.', 'radio', 'Nuevo', 'Refaccionado o spare'
    UNION ALL SELECT 'handover', 'Entrega periferico operativo', 20, 'Estado visual', 'Valida superficie, conectores y estructura sin golpes o rayaduras relevantes.', 'radio', 'Conforme', 'Con detalle'
    UNION ALL SELECT 'handover', 'Entrega periferico operativo', 30, 'Limpieza para entrega', 'Confirma que el equipo fue preparado en condiciones adecuadas de limpieza y presentacion.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega periferico operativo', 40, 'Cable o adaptador incluido', 'Confirma si el periferico se entrega con el cableado o adaptador necesario para uso.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega periferico operativo', 50, 'Accesorio principal incluido', 'Confirma si el periferico considera su accesorio principal de uso en esta entrega.', 'radio', 'Si', 'No'
    UNION ALL SELECT 'handover', 'Entrega periferico operativo', 60, 'Observaciones de preparacion', 'Resume condicion fisica o elementos complementarios preparados.', 'text_area', NULL, NULL
) seed
    ON seed.module_code = t.module_code
   AND seed.template_name = t.name
   AND seed.sort_order = i.sort_order
SET
    i.name = seed.name,
    i.description = seed.description,
    i.input_type = seed.input_type,
    i.option_a = seed.option_a,
    i.option_b = seed.option_b
WHERE t.module_code = 'handover';

INSERT INTO hub_checklist_items (template_id, name, description, input_type, option_a, option_b, sort_order)
SELECT t.id, seed.name, seed.description, seed.input_type, seed.option_a, seed.option_b, seed.sort_order
FROM hub_checklist_templates t
JOIN (
    SELECT 'lab' AS module_code, 'Checklist notebook estandar' AS template_name, 'Carcasa' AS name, 'Valida golpes, fisuras o piezas faltantes en la estructura externa.' AS description, 'check' AS input_type, NULL AS option_a, NULL AS option_b, 10 AS sort_order
    UNION ALL SELECT 'lab', 'Checklist notebook estandar', 'Diagnostico inicial', 'Permite registrar un diagnostico tecnico breve del equipo.', 'text_area', NULL, NULL, 20
    UNION ALL SELECT 'lab', 'Checklist notebook estandar', 'Serie validada', 'Solicita confirmar la serie fisica observada en el equipo.', 'input_text', NULL, NULL, 30
    UNION ALL SELECT 'lab', 'Checklist notebook estandar', 'Estado operativo', 'Permite indicar si el equipo quedo operativo luego de la revision.', 'radio', 'Operativo', 'No operativo', 40
    UNION ALL SELECT 'lab', 'Checklist desktop corporativo', 'Encendido', 'Confirma arranque basico y operacion general del equipo.', 'check', NULL, NULL, 10
    UNION ALL SELECT 'lab', 'Checklist desktop corporativo', 'Observacion tecnica', 'Permite registrar una observacion breve del puesto.', 'text_area', NULL, NULL, 20
    UNION ALL SELECT 'handover', 'Entrega laptop corporativo', 'Condicion de salida', 'Permite distinguir si la entrega corresponde a equipo nuevo o refaccionado/spare.', 'radio', 'Nuevo', 'Refaccionado o spare', 10
    UNION ALL SELECT 'handover', 'Entrega laptop corporativo', 'Estado visual', 'Valida carcasa, pantalla y tapas sin rayaduras o golpes relevantes.', 'radio', 'Conforme', 'Con detalle', 20
    UNION ALL SELECT 'handover', 'Entrega laptop corporativo', 'Limpieza para entrega', 'Confirma que el equipo fue preparado en condiciones adecuadas de limpieza y presentacion.', 'radio', 'Si', 'No', 30
    UNION ALL SELECT 'handover', 'Entrega laptop corporativo', 'Cargador incluido', 'Confirma si el cargador forma parte de la entrega del equipo.', 'radio', 'Si', 'No', 40
    UNION ALL SELECT 'handover', 'Entrega laptop corporativo', 'Adaptador de red incluido', 'Confirma si el adaptador de red propio del equipo forma parte de esta entrega.', 'radio', 'Si', 'No', 50
    UNION ALL SELECT 'handover', 'Entrega laptop corporativo', 'Observaciones de preparacion', 'Resume detalles de entrega, marcas menores o elementos adicionales incluidos.', 'text_area', NULL, NULL, 60
    UNION ALL SELECT 'handover', 'Entrega desktop corporativo', 'Condicion de salida', 'Permite distinguir si la entrega corresponde a equipo nuevo o refaccionado/spare.', 'radio', 'Nuevo', 'Refaccionado o spare', 10
    UNION ALL SELECT 'handover', 'Entrega desktop corporativo', 'Estado visual', 'Valida gabinete y piezas visibles sin rayaduras o golpes relevantes.', 'radio', 'Conforme', 'Con detalle', 20
    UNION ALL SELECT 'handover', 'Entrega desktop corporativo', 'Limpieza para entrega', 'Confirma que el equipo fue preparado en condiciones adecuadas de limpieza y presentacion.', 'radio', 'Si', 'No', 30
    UNION ALL SELECT 'handover', 'Entrega desktop corporativo', 'Cableado base incluido', 'Confirma si se entrega con cable de poder y cable de video.', 'radio', 'Si', 'No', 40
    UNION ALL SELECT 'handover', 'Entrega desktop corporativo', 'Teclado y mouse incluidos', 'Confirma si el puesto considera los perifericos base de usuario.', 'radio', 'Si', 'No', 50
    UNION ALL SELECT 'handover', 'Entrega desktop corporativo', 'Observaciones de preparacion', 'Resume condicion del puesto o accesorios adicionales preparados.', 'text_area', NULL, NULL, 60
    UNION ALL SELECT 'handover', 'Entrega tableta corporativa', 'Condicion de salida', 'Permite distinguir si la entrega corresponde a equipo nuevo o refaccionado/spare.', 'radio', 'Nuevo', 'Refaccionado o spare', 10
    UNION ALL SELECT 'handover', 'Entrega tableta corporativa', 'Estado visual', 'Valida pantalla y carcasa sin rayaduras, quiebres o golpes visibles.', 'radio', 'Conforme', 'Con detalle', 20
    UNION ALL SELECT 'handover', 'Entrega tableta corporativa', 'Limpieza para entrega', 'Confirma que el equipo fue preparado en condiciones adecuadas de limpieza y presentacion.', 'radio', 'Si', 'No', 30
    UNION ALL SELECT 'handover', 'Entrega tableta corporativa', 'Cargador incluido', 'Confirma si el cargador forma parte de la entrega del equipo.', 'radio', 'Si', 'No', 40
    UNION ALL SELECT 'handover', 'Entrega tableta corporativa', 'Funda o protector incluido', 'Confirma si la tableta se entrega con funda o protector asociado.', 'radio', 'Si', 'No', 50
    UNION ALL SELECT 'handover', 'Entrega tableta corporativa', 'Observaciones de preparacion', 'Resume detalles de estado o accesorios complementarios.', 'text_area', NULL, NULL, 60
    UNION ALL SELECT 'handover', 'Entrega celular corporativo', 'Condicion de salida', 'Permite distinguir si la entrega corresponde a equipo nuevo o refaccionado/spare.', 'radio', 'Nuevo', 'Refaccionado o spare', 10
    UNION ALL SELECT 'handover', 'Entrega celular corporativo', 'Estado visual', 'Valida pantalla, carcasa y tapas sin rayaduras o golpes relevantes.', 'radio', 'Conforme', 'Con detalle', 20
    UNION ALL SELECT 'handover', 'Entrega celular corporativo', 'Limpieza para entrega', 'Confirma que el equipo fue preparado en condiciones adecuadas de limpieza y presentacion.', 'radio', 'Si', 'No', 30
    UNION ALL SELECT 'handover', 'Entrega celular corporativo', 'Cargador incluido', 'Confirma si el cargador forma parte de la entrega del equipo.', 'radio', 'Si', 'No', 40
    UNION ALL SELECT 'handover', 'Entrega celular corporativo', 'Funda o protector incluido', 'Confirma si el equipo se entrega con funda o protector asociado.', 'radio', 'Si', 'No', 50
    UNION ALL SELECT 'handover', 'Entrega celular corporativo', 'Observaciones de preparacion', 'Resume detalles de condicion, linea o accesorios adicionales.', 'text_area', NULL, NULL, 60
    UNION ALL SELECT 'handover', 'Entrega impresora operativa', 'Condicion de salida', 'Permite distinguir si la entrega corresponde a equipo nuevo o refaccionado/spare.', 'radio', 'Nuevo', 'Refaccionado o spare', 10
    UNION ALL SELECT 'handover', 'Entrega impresora operativa', 'Estado visual', 'Valida bandejas, carcasa y tapas sin golpes, rayaduras severas o piezas sueltas.', 'radio', 'Conforme', 'Con detalle', 20
    UNION ALL SELECT 'handover', 'Entrega impresora operativa', 'Limpieza para entrega', 'Confirma que el equipo fue preparado en condiciones adecuadas de limpieza y presentacion.', 'radio', 'Si', 'No', 30
    UNION ALL SELECT 'handover', 'Entrega impresora operativa', 'Cableado base incluido', 'Confirma si se entrega con cable de poder y conexion necesarios.', 'radio', 'Si', 'No', 40
    UNION ALL SELECT 'handover', 'Entrega impresora operativa', 'Consumible inicial disponible', 'Confirma si toner, tinta o consumible base acompana la entrega.', 'radio', 'Si', 'No', 50
    UNION ALL SELECT 'handover', 'Entrega impresora operativa', 'Observaciones de preparacion', 'Resume estado, consumibles o detalles relevantes de salida.', 'text_area', NULL, NULL, 60
    UNION ALL SELECT 'handover', 'Entrega periferico operativo', 'Condicion de salida', 'Permite distinguir si la entrega corresponde a equipo nuevo o refaccionado/spare.', 'radio', 'Nuevo', 'Refaccionado o spare', 10
    UNION ALL SELECT 'handover', 'Entrega periferico operativo', 'Estado visual', 'Valida superficie, conectores y estructura sin golpes o rayaduras relevantes.', 'radio', 'Conforme', 'Con detalle', 20
    UNION ALL SELECT 'handover', 'Entrega periferico operativo', 'Limpieza para entrega', 'Confirma que el equipo fue preparado en condiciones adecuadas de limpieza y presentacion.', 'radio', 'Si', 'No', 30
    UNION ALL SELECT 'handover', 'Entrega periferico operativo', 'Cable o adaptador incluido', 'Confirma si el periferico se entrega con el cableado o adaptador necesario para uso.', 'radio', 'Si', 'No', 40
    UNION ALL SELECT 'handover', 'Entrega periferico operativo', 'Accesorio principal incluido', 'Confirma si el periferico considera su accesorio principal de uso en esta entrega.', 'radio', 'Si', 'No', 50
    UNION ALL SELECT 'handover', 'Entrega periferico operativo', 'Observaciones de preparacion', 'Resume condicion fisica o elementos complementarios preparados.', 'text_area', NULL, NULL, 60
    UNION ALL SELECT 'reassignment', 'Reasignacion notebook corporativa', 'Usuario origen validado', 'Confirma identidad y devolucion del custodio saliente.', 'check', NULL, NULL, 10
    UNION ALL SELECT 'reassignment', 'Reasignacion notebook corporativa', 'Estado del activo', 'Resume observaciones visibles previo al traspaso.', 'text_area', NULL, NULL, 20
    UNION ALL SELECT 'reassignment', 'Reasignacion notebook corporativa', 'Resultado del traspaso', 'Permite indicar si la reasignacion quedo conforme o con observaciones.', 'radio', 'Conforme', 'Observada', 30
    UNION ALL SELECT 'reassignment', 'Reasignacion perifericos', 'Accesorios completos', 'Valida presencia de cables y piezas asociadas al periferico.', 'check', NULL, NULL, 10
    UNION ALL SELECT 'reception', 'Recepcion usuario final', 'Equipo recibido', 'Confirma codigo y coincidencia con el activo esperado.', 'check', NULL, NULL, 10
    UNION ALL SELECT 'reception', 'Recepcion usuario final', 'Observaciones de recepcion', 'Permite documentar danos, faltantes o comentarios del receptor.', 'text_area', NULL, NULL, 20
    UNION ALL SELECT 'reception', 'Recepcion usuario final', 'Estado general', 'Determina si el activo ingresa completo o con observaciones.', 'radio', 'Completo', 'Con observaciones', 30
    UNION ALL SELECT 'reception', 'Recepcion rapida', 'Activo identificado', 'Verifica serie o codigo visible.', 'input_text', NULL, NULL, 10
) seed
    ON seed.module_code = t.module_code
   AND seed.template_name = t.name
LEFT JOIN hub_checklist_items existing
    ON existing.template_id = t.id
   AND existing.name = seed.name
WHERE existing.id IS NULL;
