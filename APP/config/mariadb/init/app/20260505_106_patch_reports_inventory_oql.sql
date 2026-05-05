-- ============================================================
-- Patch 78: Correccion de definiciones OQL de reportes inventario
-- ============================================================

SET NAMES utf8mb4;
START TRANSACTION;

-- -------------------------------------------------------
-- 1. assets_by_cmdb_status
-- -------------------------------------------------------
SET @rd_assets_by_cmdb_status = (
    SELECT id
    FROM hub_report_definitions
    WHERE report_code = 'assets_by_cmdb_status'
    LIMIT 1
);

INSERT INTO hub_report_definition_versions (
    report_definition_id,
    version,
    status,
    definition_json,
    change_reason,
    created_by,
    activated_at
)
SELECT
    @rd_assets_by_cmdb_status,
    2,
    'active',
    JSON_SET(
        definition_json,
        '$.version', 2,
        '$.status', 'active',
        '$.source.query.base_statement', 'SELECT PhysicalDevice',
        '$.source.query.output_fields', 'id,name,friendlyname,asset_number,status,finalclass,location_id_friendlyname'
    ),
    'Correccion OQL para ejecutar contra PhysicalDevice y resolver usuario asignado con relacion reutilizable.',
    'system',
    NOW()
FROM hub_report_definition_versions
WHERE report_definition_id = @rd_assets_by_cmdb_status
  AND version = 1
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_assets_by_cmdb_status
  AND version <> 2
  AND status IN ('active', 'rollback');

UPDATE hub_report_definition_versions
SET status = 'active', activated_at = NOW()
WHERE report_definition_id = @rd_assets_by_cmdb_status
  AND version = 2;

UPDATE hub_report_definitions
SET current_version = 2, status = 'active', updated_by = 'system'
WHERE id = @rd_assets_by_cmdb_status;

-- -------------------------------------------------------
-- 2. available_stock_by_asset_type
-- -------------------------------------------------------
SET @rd_available_stock_by_asset_type = (
    SELECT id
    FROM hub_report_definitions
    WHERE report_code = 'available_stock_by_asset_type'
    LIMIT 1
);

INSERT INTO hub_report_definition_versions (
    report_definition_id,
    version,
    status,
    definition_json,
    change_reason,
    created_by,
    activated_at
)
SELECT
    @rd_available_stock_by_asset_type,
    2,
    'active',
    JSON_SET(
        definition_json,
        '$.version', 2,
        '$.status', 'active',
        '$.source.query.base_statement', 'SELECT PhysicalDevice WHERE status = ''stock''',
        '$.source.query.output_fields', 'id,name,friendlyname,asset_number,status,finalclass,location_id_friendlyname'
    ),
    'Correccion OQL para ejecutar reportes de stock sobre PhysicalDevice y evitar atributos no validos.',
    'system',
    NOW()
FROM hub_report_definition_versions
WHERE report_definition_id = @rd_available_stock_by_asset_type
  AND version = 1
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_available_stock_by_asset_type
  AND version <> 2
  AND status IN ('active', 'rollback');

UPDATE hub_report_definition_versions
SET status = 'active', activated_at = NOW()
WHERE report_definition_id = @rd_available_stock_by_asset_type
  AND version = 2;

UPDATE hub_report_definitions
SET current_version = 2, status = 'active', updated_by = 'system'
WHERE id = @rd_available_stock_by_asset_type;

-- -------------------------------------------------------
-- 3. assets_by_location
-- -------------------------------------------------------
SET @rd_assets_by_location = (
    SELECT id
    FROM hub_report_definitions
    WHERE report_code = 'assets_by_location'
    LIMIT 1
);

INSERT INTO hub_report_definition_versions (
    report_definition_id,
    version,
    status,
    definition_json,
    change_reason,
    created_by,
    activated_at
)
SELECT
    @rd_assets_by_location,
    2,
    'active',
    JSON_SET(
        definition_json,
        '$.version', 2,
        '$.status', 'active',
        '$.source.query.base_statement', 'SELECT PhysicalDevice',
        '$.source.query.output_fields', 'id,name,friendlyname,asset_number,status,finalclass,location_id_friendlyname'
    ),
    'Correccion OQL para ejecutar por ubicacion sobre PhysicalDevice y obtener columnas validas.',
    'system',
    NOW()
FROM hub_report_definition_versions
WHERE report_definition_id = @rd_assets_by_location
  AND version = 1
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_assets_by_location
  AND version <> 2
  AND status IN ('active', 'rollback');

UPDATE hub_report_definition_versions
SET status = 'active', activated_at = NOW()
WHERE report_definition_id = @rd_assets_by_location
  AND version = 2;

UPDATE hub_report_definitions
SET current_version = 2, status = 'active', updated_by = 'system'
WHERE id = @rd_assets_by_location;

-- -------------------------------------------------------
-- 4. assets_near_replacement
-- -------------------------------------------------------
SET @rd_assets_near_replacement = (
    SELECT id
    FROM hub_report_definitions
    WHERE report_code = 'assets_near_replacement'
    LIMIT 1
);

INSERT INTO hub_report_definition_versions (
    report_definition_id,
    version,
    status,
    definition_json,
    change_reason,
    created_by,
    activated_at
)
SELECT
    @rd_assets_near_replacement,
    2,
    'active',
    JSON_SET(
        definition_json,
        '$.version', 2,
        '$.status', 'active',
        '$.source.query.output_fields', 'id,name,friendlyname,asset_number,status,finalclass,brand_id_friendlyname,model_id_friendlyname,move2production'
    ),
    'Correccion OQL para remover atributos de usuario no expuestos directamente por PhysicalDevice.',
    'system',
    NOW()
FROM hub_report_definition_versions
WHERE report_definition_id = @rd_assets_near_replacement
  AND version = 1
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_assets_near_replacement
  AND version <> 2
  AND status IN ('active', 'rollback');

UPDATE hub_report_definition_versions
SET status = 'active', activated_at = NOW()
WHERE report_definition_id = @rd_assets_near_replacement
  AND version = 2;

UPDATE hub_report_definitions
SET current_version = 2, status = 'active', updated_by = 'system'
WHERE id = @rd_assets_near_replacement;

COMMIT;
