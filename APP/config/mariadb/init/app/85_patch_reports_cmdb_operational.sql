-- PATCH: Informes CMDB operativos sobre API iTop/OQL controlado
--   * Reemplaza reportes CMDB criticos por servicios backend optimizados.
--   * Agrega listado de activos con responsable actual.
--   * Agrega vida util y garantia con calculos backend sobre fechas reales iTop.

SET NAMES utf8mb4;
START TRANSACTION;

-- -------------------------------------------------------
-- assets_with_responsibles [Inventario / itop_service]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_with_responsibles', 'Activos asociados a responsables', 'Lista activos CMDB con responsable actual, clase, estado, locacion y garantia, usando datos vigentes desde iTop.', 'Inventario', 'base', 'active', 1, 'system')
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
VALUES (@rd_assets_resp, 1, 'active', '{"id":"assets_with_responsibles","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Activos asociados a responsables","description":"Lista activos CMDB con responsable actual, clase, estado, locacion y garantia, usando datos vigentes desde iTop.","category":"Inventario","tags":["itop","cmdb","activos","responsables","asignacion"],"available":true},"source":{"mode":"itop_service","engine":"itop","service_key":"assets_with_responsibles","alias":"assets"},"filters":[{"name":"finalclass","label":"Tipo de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"cmdb_enabled_asset_types"}},{"name":"status","label":"Estado CMDB","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"itop_asset_states"}},{"name":"responsible","label":"Responsable","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre del responsable","apply_when":"has_value"},{"name":"location","label":"Locacion","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Sede, bodega o ubicacion","apply_when":"has_value"},{"name":"asset_query","label":"Activo","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Codigo, nombre o serie","apply_when":"has_value"}],"columns":[{"field":"codigo","label":"Codigo","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"nombre","label":"Nombre CMDB","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"clase","label":"Clase","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":40,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"responsable","label":"Responsable","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"locacion","label":"Locacion","order":60,"visible":true,"export":true,"format":"text","align":"left"},{"field":"marca","label":"Marca","order":70,"visible":true,"export":true,"format":"text","align":"left"},{"field":"modelo","label":"Modelo","order":80,"visible":true,"export":true,"format":"text","align":"left"},{"field":"serie","label":"Serie","order":90,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fin_garantia","label":"Fin garantia","order":100,"visible":true,"export":true,"format":"date","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"activos_responsables_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Nuevo reporte CMDB operativo con responsables vigentes desde iTop', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- assets_by_cmdb_status v2 [Inventario / itop_service]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_by_cmdb_status', 'Activos por clase y estado CMDB', 'Agrupa inventario CMDB por clase y estado, mostrando totales con y sin responsable vigente.', 'Inventario', 'base', 'active', 2, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd_status = LAST_INSERT_ID();
UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_status AND status = 'active';

INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd_status, 2, 'active', '{"id":"assets_by_cmdb_status","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Activos por clase y estado CMDB","description":"Agrupa inventario CMDB por clase y estado, mostrando totales con y sin responsable vigente.","category":"Inventario","tags":["itop","cmdb","activos","estado","agrupacion"],"available":true},"source":{"mode":"itop_service","engine":"itop","service_key":"assets_grouped_by_class_status","alias":"assets"},"filters":[{"name":"finalclass","label":"Tipo de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"cmdb_enabled_asset_types"}},{"name":"status","label":"Estado CMDB","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"itop_asset_states"}},{"name":"location","label":"Locacion","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Filtrar por ubicacion","apply_when":"has_value"}],"columns":[{"field":"clase","label":"Clase","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":20,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"cantidad","label":"Cantidad","order":30,"visible":true,"export":true,"format":"number","align":"right"},{"field":"con_responsable","label":"Con responsable","order":40,"visible":true,"export":true,"format":"number","align":"right"},{"field":"sin_responsable","label":"Sin responsable","order":50,"visible":true,"export":true,"format":"number","align":"right"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"activos_clase_estado_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Optimiza agrupacion CMDB en backend y evita OQL plano con campos calculados', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- assets_by_location v2 [Inventario / itop_service]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_by_location', 'Activos agrupados por locacion', 'Agrupa inventario CMDB por locacion y clase, separando produccion, stock y otros estados.', 'Inventario', 'base', 'active', 2, 'system')
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
WHERE report_definition_id = @rd_location AND status = 'active';

INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd_location, 2, 'active', '{"id":"assets_by_location","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Activos agrupados por locacion","description":"Agrupa inventario CMDB por locacion y clase, separando produccion, stock y otros estados.","category":"Inventario","tags":["itop","cmdb","locacion","agrupacion"],"available":true},"source":{"mode":"itop_service","engine":"itop","service_key":"assets_grouped_by_location","alias":"assets"},"filters":[{"name":"location","label":"Locacion","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Sede, bodega o ubicacion","apply_when":"has_value"},{"name":"finalclass","label":"Tipo de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"cmdb_enabled_asset_types"}},{"name":"status","label":"Estado CMDB","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"itop_asset_states"}}],"columns":[{"field":"locacion","label":"Locacion","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"clase","label":"Clase","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"cantidad","label":"Cantidad","order":30,"visible":true,"export":true,"format":"number","align":"right"},{"field":"produccion","label":"Produccion","order":40,"visible":true,"export":true,"format":"number","align":"right"},{"field":"stock","label":"Stock","order":50,"visible":true,"export":true,"format":"number","align":"right"},{"field":"otros_estados","label":"Otros estados","order":60,"visible":true,"export":true,"format":"number","align":"right"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"activos_locacion_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Optimiza agrupacion territorial con post-proceso backend', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- assets_near_replacement v2 [Renovacion / itop_service]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_near_replacement', 'Vida util y garantia de activos', 'Filtra equipos por tiempo en produccion y garantia por expirar usando fechas vigentes del CMDB iTop.', 'Renovacion', 'base', 'active', 2, 'system')
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
VALUES (@rd_lifecycle, 2, 'active', '{"id":"assets_near_replacement","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Vida util y garantia de activos","description":"Filtra equipos por tiempo en produccion y garantia por expirar usando fechas vigentes del CMDB iTop.","category":"Renovacion","tags":["itop","cmdb","vida-util","garantia","renovacion"],"available":true},"source":{"mode":"itop_service","engine":"itop","service_key":"asset_lifecycle_and_warranty","alias":"assets"},"filters":[{"name":"finalclass","label":"Tipo de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"cmdb_enabled_asset_types"}},{"name":"status","label":"Estado CMDB","type":"select","enabled":true,"required":false,"default":"production","apply_when":"has_value","options_source":{"mode":"local","source":"itop_asset_states"}},{"name":"min_production_months","label":"Minimo meses en produccion","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Ej: 36","apply_when":"has_value"},{"name":"warranty_days","label":"Garantia vence en dias","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Ej: 60","apply_when":"has_value"},{"name":"responsible","label":"Responsable","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre del responsable","apply_when":"has_value"},{"name":"location","label":"Locacion","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Filtrar por ubicacion","apply_when":"has_value"}],"columns":[{"field":"codigo","label":"Codigo","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"clase","label":"Clase","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":30,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"responsable","label":"Responsable","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"locacion","label":"Locacion","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"marca","label":"Marca","order":60,"visible":true,"export":true,"format":"text","align":"left"},{"field":"modelo","label":"Modelo","order":70,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha_produccion","label":"Fecha produccion","order":80,"visible":true,"export":true,"format":"date","align":"left"},{"field":"meses_en_produccion","label":"Meses produccion","order":90,"visible":true,"export":true,"format":"number","align":"right"},{"field":"fin_garantia","label":"Fin garantia","order":100,"visible":true,"export":true,"format":"date","align":"left"},{"field":"dias_garantia","label":"Dias garantia","order":110,"visible":true,"export":true,"format":"number","align":"right"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"vida_util_garantia_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Agrega calculo de vida util y garantia con fechas reales desde iTop', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- assets_missing_user_or_location v2 [Calidad CMDB / itop_service]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_missing_user_or_location', 'Activos sin responsable o locacion', 'Detecta activos CMDB sin responsable vigente o sin locacion, usando relaciones reales de contactos desde iTop.', 'Calidad CMDB', 'base', 'active', 2, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd_quality = LAST_INSERT_ID();
UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_quality AND status = 'active';

INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd_quality, 2, 'active', '{"id":"assets_missing_user_or_location","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Activos sin responsable o locacion","description":"Detecta activos CMDB sin responsable vigente o sin locacion, usando relaciones reales de contactos desde iTop.","category":"Calidad CMDB","tags":["itop","cmdb","calidad","responsable","locacion"],"available":true},"source":{"mode":"itop_service","engine":"itop","service_key":"assets_missing_user_or_location","alias":"assets"},"filters":[{"name":"finalclass","label":"Tipo de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"cmdb_enabled_asset_types"}},{"name":"status","label":"Estado CMDB","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"itop_asset_states"}},{"name":"asset_query","label":"Activo","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Codigo, nombre o serie","apply_when":"has_value"}],"columns":[{"field":"codigo","label":"Codigo","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"nombre","label":"Nombre CMDB","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"clase","label":"Clase","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":40,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"problema","label":"Problema","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"responsable","label":"Responsable","order":60,"visible":true,"export":true,"format":"text","align":"left"},{"field":"locacion","label":"Locacion","order":70,"visible":true,"export":true,"format":"text","align":"left"},{"field":"serie","label":"Serie","order":80,"visible":true,"export":true,"format":"text","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"activos_sin_responsable_locacion_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Corrige reporte de calidad usando relaciones reales desde iTop', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

COMMIT;
