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
        'Entrega notebook corporativa',
        'Lista para documentar accesorios entregados, estado visual y validaciones clave al momento de la asignacion.',
        'active',
        NULL,
        10
    ),
    (
        'handover',
        'Entrega monitor y perifericos',
        'Checklist resumido para asignacion de monitores, docks y perifericos asociados.',
        'inactive',
        NULL,
        20
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
    UNION ALL SELECT 'handover', 'Entrega notebook corporativa', 'Activo principal', 'Confirma que el equipo entregado corresponde al registro documentado.', 'check', NULL, NULL, 10
    UNION ALL SELECT 'handover', 'Entrega notebook corporativa', 'Accesorios entregados', 'Resume accesorios asociados a la entrega del activo.', 'text_area', NULL, NULL, 20
    UNION ALL SELECT 'handover', 'Entrega notebook corporativa', 'Conformidad', 'Permite identificar si la entrega quedo conforme o con observaciones.', 'radio', 'Conforme', 'Con observaciones', 30
    UNION ALL SELECT 'handover', 'Entrega monitor y perifericos', 'Cableado', 'Valida presencia de cable de energia y video.', 'check', NULL, NULL, 10
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
