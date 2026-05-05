-- PATCH: Ajusta orden de columnas en Activos por locacion
--   * Primero Locacion, luego Clase.

SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_by_location', 'Activos por locacion', 'Lista activos CMDB por locacion con clase, estado, responsable y serie, usando datos vigentes desde iTop.', 'Inventario', 'base', 'active', 4, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd_location = LAST_INSERT_ID();

UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_location
  AND status = 'active';

INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
SELECT
    @rd_location,
    4,
    'active',
    JSON_SET(
        definition_json,
        '$.version', 4,
        '$.columns', JSON_ARRAY(
            JSON_OBJECT('field', 'locacion', 'label', 'Locacion', 'order', 10, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'clase', 'label', 'Clase', 'order', 20, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'nombre', 'label', 'CMDB', 'order', 30, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'estado', 'label', 'Estado', 'order', 40, 'visible', true, 'export', true, 'format', 'badge', 'align', 'left'),
            JSON_OBJECT('field', 'responsable', 'label', 'Responsable', 'order', 50, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'serie', 'label', 'Serie', 'order', 60, 'visible', true, 'export', true, 'format', 'text', 'align', 'left')
        )
    ),
    'Ajusta orden de columnas: Locacion antes de Clase',
    'system',
    NOW()
FROM hub_report_definition_versions
WHERE report_definition_id = @rd_location
  AND version = 3
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

COMMIT;
