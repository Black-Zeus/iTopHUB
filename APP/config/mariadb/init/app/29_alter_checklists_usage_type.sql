ALTER TABLE hub_checklist_templates
    ADD COLUMN IF NOT EXISTS usage_type VARCHAR(30) NULL AFTER module_code;

UPDATE hub_checklist_templates
SET usage_type = CASE
    WHEN module_code = 'lab' THEN 'laboratory'
    WHEN module_code = 'reception' THEN 'reception'
    WHEN module_code = 'reassignment' THEN 'reassignment'
    WHEN module_code = 'handover' AND (
        LOWER(name) LIKE 'devolucion %'
        OR LOWER(name) LIKE 'checklist devolucion%'
    ) THEN 'return'
    WHEN module_code = 'handover' AND (
        LOWER(name) LIKE 'normalizacion %'
        OR LOWER(name) LIKE 'checklist normalizacion%'
    ) THEN 'normalization'
    ELSE 'delivery'
END
WHERE usage_type IS NULL OR usage_type = '';

INSERT INTO hub_checklist_templates (
    module_code,
    usage_type,
    name,
    description,
    status,
    cmdb_class_label,
    sort_order
)
VALUES
    (
        'handover',
        'return',
        'Checklist Devolucion',
        'Checklist base para documentar devolucion, estado recibido y elementos entregados junto al activo.',
        'active',
        NULL,
        70
    ),
    (
        'handover',
        'normalization',
        'Checklist Normalizacion',
        'Checklist base reservado para el futuro flujo de normalizacion de activos.',
        'active',
        NULL,
        80
    )
ON DUPLICATE KEY UPDATE
    usage_type = VALUES(usage_type),
    description = VALUES(description),
    status = VALUES(status),
    cmdb_class_label = VALUES(cmdb_class_label),
    sort_order = VALUES(sort_order);

INSERT INTO hub_checklist_items (template_id, name, description, input_type, option_a, option_b, sort_order)
SELECT t.id, seed.name, seed.description, seed.input_type, seed.option_a, seed.option_b, seed.sort_order
FROM hub_checklist_templates t
JOIN (
    SELECT 'Checklist Devolucion' AS template_name, 'Activo identificado' AS name, 'Confirma que el activo entregado por la persona corresponde al registro esperado.' AS description, 'check' AS input_type, NULL AS option_a, NULL AS option_b, 10 AS sort_order
    UNION ALL SELECT 'Checklist Devolucion', 'Estado visual de devolucion', 'Resume si el activo se recibe conforme o con observaciones visibles.', 'radio', 'Conforme', 'Con observaciones', 20
    UNION ALL SELECT 'Checklist Devolucion', 'Accesorios recibidos', 'Permite indicar si los accesorios comprometidos fueron recibidos junto al activo.', 'radio', 'Completos', 'Incompletos', 30
    UNION ALL SELECT 'Checklist Devolucion', 'Observaciones de recepcion', 'Documenta faltantes, danos visibles o acuerdos al momento de la devolucion.', 'text_area', NULL, NULL, 40
    UNION ALL SELECT 'Checklist Normalizacion', 'Activo identificado', 'Confirma que el activo considerado para normalizacion corresponde al registro esperado.', 'check', NULL, NULL, 10
    UNION ALL SELECT 'Checklist Normalizacion', 'Observaciones de normalizacion', 'Reserva un espacio para definir alcance, criterios y observaciones del proceso futuro.', 'text_area', NULL, NULL, 20
) seed
    ON seed.template_name = t.name
LEFT JOIN hub_checklist_items existing
    ON existing.template_id = t.id
   AND existing.name = seed.name
WHERE existing.id IS NULL;
