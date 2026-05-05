-- PATCH: Convierte Activos por locacion a listado detallado
--   * Mantiene filtros por clase, estado y locacion.
--   * Lista Clase, CMDB, Estado, Responsable, Locacion y Serie.

SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_by_location', 'Activos por locacion', 'Lista activos CMDB por locacion con clase, estado, responsable y serie, usando datos vigentes desde iTop.', 'Inventario', 'base', 'active', 3, 'system')
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
VALUES (@rd_location, 3, 'active', '{"id":"assets_by_location","version":3,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Activos por locacion","description":"Lista activos CMDB por locacion con clase, estado, responsable y serie, usando datos vigentes desde iTop.","category":"Inventario","tags":["itop","cmdb","locacion","inventario","activos"],"available":true},"source":{"mode":"itop_service","engine":"itop","service_key":"assets_by_location_detail","alias":"assets"},"filters":[{"name":"finalclass","label":"Clase","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"cmdb_enabled_asset_types"}},{"name":"status","label":"Estado","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"itop_asset_states"}},{"name":"location","label":"Locacion","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Sede, bodega o ubicacion","apply_when":"has_value"}],"columns":[{"field":"clase","label":"Clase","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"nombre","label":"CMDB","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":30,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"responsable","label":"Responsable","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"locacion","label":"Locacion","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"serie","label":"Serie","order":60,"visible":true,"export":true,"format":"text","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"activos_por_locacion_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Convierte el reporte de locacion a listado detallado filtrable', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

COMMIT;
