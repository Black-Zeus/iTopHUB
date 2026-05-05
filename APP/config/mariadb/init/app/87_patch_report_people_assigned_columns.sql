-- PATCH: Ajusta columnas y filtros del informe Personas con equipo asignado
--   * Ordena columnas segun vista operativa solicitada.
--   * Agrega fechas CMDB de produccion, compra y garantia.

SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('people_with_assigned_assets', 'Personas con equipo asignado', 'Lista personas con activos CMDB asociados actualmente segun relaciones vigentes en iTop.', 'Asignacion', 'base', 'active', 3, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd_people_assets = LAST_INSERT_ID();

UPDATE hub_report_definition_versions
SET status = 'deprecated'
WHERE report_definition_id = @rd_people_assets
  AND status = 'active';

INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd_people_assets, 3, 'active', '{"id":"people_with_assigned_assets","version":3,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Personas con equipo asignado","description":"Lista personas con activos CMDB asociados actualmente segun relaciones vigentes en iTop.","category":"Asignacion","tags":["itop","cmdb","personas","activos","asignacion"],"available":true},"source":{"mode":"itop_service","engine":"itop","service_key":"people_with_assigned_assets","alias":"assets"},"filters":[{"name":"finalclass","label":"Tipo de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"cmdb_enabled_asset_types"}},{"name":"status","label":"Estado CMDB","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"itop_asset_states"}},{"name":"responsible","label":"Responsable","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre de la persona","apply_when":"has_value"},{"name":"location","label":"Locacion","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Sede o ubicacion","apply_when":"has_value"}],"columns":[{"field":"persona","label":"Persona","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"clase","label":"Clase","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"nombre_activo","label":"Nombre CMDB","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":40,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"marca","label":"Marca","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"modelo","label":"Modelo","order":60,"visible":true,"export":true,"format":"text","align":"left"},{"field":"locacion","label":"Locaci\\u00f3n","order":70,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha_produccion","label":"Puesto en Producci\\u00f3n","order":80,"visible":true,"export":true,"format":"date","align":"left"},{"field":"fecha_compra","label":"Fecha de Compra","order":90,"visible":true,"export":true,"format":"date","align":"left"},{"field":"vencimiento_garantia","label":"Vencimiento de Garant\\u00eda","order":100,"visible":true,"export":true,"format":"date","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"personas_con_equipo_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Ajusta columnas visibles y fechas CMDB del informe de personas con equipo asignado', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

COMMIT;