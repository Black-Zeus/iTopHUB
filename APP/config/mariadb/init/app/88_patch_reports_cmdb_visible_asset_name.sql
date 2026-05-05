-- PATCH: Estandariza columnas visibles CMDB en informes
--   * Oculta/remueve columnas Codigo en informes operativos.
--   * Usa CMDB o Nombre activo como identificador visible.

SET NAMES utf8mb4;
START TRANSACTION;

-- -------------------------------------------------------
-- assets_missing_user_or_location v3
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_missing_user_or_location', 'Activos sin responsable o locacion', 'Detecta activos CMDB sin responsable vigente o sin locacion, usando relaciones reales de contactos desde iTop.', 'Calidad CMDB', 'base', 'active', 3, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd_missing = LAST_INSERT_ID();
UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_missing AND status = 'active';

INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
SELECT
    @rd_missing,
    3,
    'active',
    JSON_SET(
        definition_json,
        '$.version', 3,
        '$.columns', JSON_ARRAY(
            JSON_OBJECT('field', 'clase', 'label', 'Clase', 'order', 10, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'nombre', 'label', 'CMDB', 'order', 20, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'estado', 'label', 'Estado', 'order', 30, 'visible', true, 'export', true, 'format', 'badge', 'align', 'left'),
            JSON_OBJECT('field', 'problema', 'label', 'Motivo', 'order', 40, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'responsable', 'label', 'Responsable', 'order', 50, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'locacion', 'label', 'Locacion', 'order', 60, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'serie', 'label', 'Serie', 'order', 70, 'visible', true, 'export', true, 'format', 'text', 'align', 'left')
        )
    ),
    'Ajusta orden de columnas y reemplaza Codigo por CMDB visible',
    'system',
    NOW()
FROM hub_report_definition_versions
WHERE report_definition_id = @rd_missing AND version = 2
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- assets_with_responsibles v2
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_with_responsibles', 'Activos asociados a responsables', 'Lista activos CMDB con responsable actual, clase, estado, locacion y garantia, usando datos vigentes desde iTop.', 'Inventario', 'base', 'active', 2, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd_assets_resp = LAST_INSERT_ID();
UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_assets_resp AND status = 'active';

INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
SELECT
    @rd_assets_resp,
    2,
    'active',
    JSON_SET(
        definition_json,
        '$.version', 2,
        '$.columns', JSON_ARRAY(
            JSON_OBJECT('field', 'nombre', 'label', 'CMDB', 'order', 10, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'clase', 'label', 'Clase', 'order', 20, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'estado', 'label', 'Estado', 'order', 30, 'visible', true, 'export', true, 'format', 'badge', 'align', 'left'),
            JSON_OBJECT('field', 'responsable', 'label', 'Responsable', 'order', 40, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'locacion', 'label', 'Locacion', 'order', 50, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'marca', 'label', 'Marca', 'order', 60, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'modelo', 'label', 'Modelo', 'order', 70, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'serie', 'label', 'Serie', 'order', 80, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'fin_garantia', 'label', 'Fin garantia', 'order', 90, 'visible', true, 'export', true, 'format', 'date', 'align', 'left')
        )
    ),
    'Reemplaza Codigo por CMDB visible',
    'system',
    NOW()
FROM hub_report_definition_versions
WHERE report_definition_id = @rd_assets_resp AND version = 1
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- assets_near_replacement v3
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_near_replacement', 'Vida util y garantia de activos', 'Filtra equipos por tiempo en produccion y garantia por expirar usando fechas vigentes del CMDB iTop.', 'Renovacion', 'base', 'active', 3, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd_lifecycle = LAST_INSERT_ID();
UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_lifecycle AND status = 'active';

INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
SELECT
    @rd_lifecycle,
    3,
    'active',
    JSON_SET(
        definition_json,
        '$.version', 3,
        '$.columns', JSON_ARRAY(
            JSON_OBJECT('field', 'nombre', 'label', 'CMDB', 'order', 10, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'clase', 'label', 'Clase', 'order', 20, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'estado', 'label', 'Estado', 'order', 30, 'visible', true, 'export', true, 'format', 'badge', 'align', 'left'),
            JSON_OBJECT('field', 'responsable', 'label', 'Responsable', 'order', 40, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'locacion', 'label', 'Locacion', 'order', 50, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'marca', 'label', 'Marca', 'order', 60, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'modelo', 'label', 'Modelo', 'order', 70, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'fecha_produccion', 'label', 'Fecha produccion', 'order', 80, 'visible', true, 'export', true, 'format', 'date', 'align', 'left'),
            JSON_OBJECT('field', 'meses_en_produccion', 'label', 'Meses produccion', 'order', 90, 'visible', true, 'export', true, 'format', 'number', 'align', 'right'),
            JSON_OBJECT('field', 'fin_garantia', 'label', 'Fin garantia', 'order', 100, 'visible', true, 'export', true, 'format', 'date', 'align', 'left'),
            JSON_OBJECT('field', 'dias_garantia', 'label', 'Dias garantia', 'order', 110, 'visible', true, 'export', true, 'format', 'number', 'align', 'right')
        )
    ),
    'Reemplaza Codigo por CMDB visible',
    'system',
    NOW()
FROM hub_report_definition_versions
WHERE report_definition_id = @rd_lifecycle AND version = 2
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- non_standard_models v3
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('non_standard_models', 'Modelos fuera de estandar', 'Detecta activos con modelo faltante o marcado como legacy/EOL en CMDB.', 'Renovacion', 'base', 'active', 3, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd_non_standard = LAST_INSERT_ID();
UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_non_standard AND status = 'active';

INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
SELECT
    @rd_non_standard,
    3,
    'active',
    JSON_SET(
        definition_json,
        '$.version', 3,
        '$.columns', JSON_ARRAY(
            JSON_OBJECT('field', 'nombre', 'label', 'CMDB', 'order', 10, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'clase', 'label', 'Clase', 'order', 20, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'marca', 'label', 'Marca', 'order', 30, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'modelo', 'label', 'Modelo', 'order', 40, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'motivo', 'label', 'Motivo', 'order', 50, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'responsable', 'label', 'Responsable', 'order', 60, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'locacion', 'label', 'Locacion', 'order', 70, 'visible', true, 'export', true, 'format', 'text', 'align', 'left'),
            JSON_OBJECT('field', 'estado', 'label', 'Estado', 'order', 80, 'visible', true, 'export', true, 'format', 'badge', 'align', 'left')
        )
    ),
    'Reemplaza Codigo por CMDB visible',
    'system',
    NOW()
FROM hub_report_definition_versions
WHERE report_definition_id = @rd_non_standard AND version = 2
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- available_stock_by_asset_type v3
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('available_stock_by_asset_type', 'Stock disponible por tipo de activo', 'Muestra los activos disponibles en stock, segmentados por familia, modelo y estado operativo para acelerar nuevas asignaciones.', 'Inventario', 'base', 'active', 3, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd_stock = LAST_INSERT_ID();
UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_stock AND status = 'active';

INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
SELECT
    @rd_stock,
    3,
    'active',
    JSON_SET(
        definition_json,
        '$.version', 3,
        '$.columns[0].label', 'CMDB'
    ),
    'Renombra Codigo como CMDB visible',
    'system',
    NOW()
FROM hub_report_definition_versions
WHERE report_definition_id = @rd_stock AND version = 2
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

COMMIT;
