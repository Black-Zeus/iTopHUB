-- PATCH: Habilita informes pendientes y normaliza versiones activas
--   * Convierte informes unsupported en definiciones ejecutables.
--   * Evita duplicados dejando activa solo la current_version de cada informe.

SET NAMES utf8mb4;
START TRANSACTION;

-- Personas con equipo asignado
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('people_with_assigned_assets', 'Personas con equipo asignado', 'Lista personas con activos CMDB asociados actualmente segun relaciones vigentes en iTop.', 'Asignacion', 'base', 'active', 2, 'system')
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
UPDATE hub_report_definition_versions SET status = 'deprecated' WHERE report_definition_id = @rd_people_assets AND status = 'active';
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd_people_assets, 2, 'active', '{"id":"people_with_assigned_assets","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Personas con equipo asignado","description":"Lista personas con activos CMDB asociados actualmente segun relaciones vigentes en iTop.","category":"Asignacion","tags":["itop","cmdb","personas","activos","asignacion"],"available":true},"source":{"mode":"itop_service","engine":"itop","service_key":"people_with_assigned_assets","alias":"assets"},"filters":[{"name":"finalclass","label":"Tipo de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"cmdb_enabled_asset_types"}},{"name":"status","label":"Estado CMDB","type":"select","enabled":true,"required":false,"default":"production","apply_when":"has_value","options_source":{"mode":"local","source":"itop_asset_states"}},{"name":"responsible","label":"Responsable","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre de la persona","apply_when":"has_value"},{"name":"location","label":"Locacion","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Sede o ubicacion","apply_when":"has_value"}],"columns":[{"field":"persona","label":"Persona","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"activo","label":"Activo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"nombre_activo","label":"Nombre CMDB","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"clase","label":"Clase","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":50,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"locacion","label":"Locacion","order":60,"visible":true,"export":true,"format":"text","align":"left"},{"field":"marca","label":"Marca","order":70,"visible":true,"export":true,"format":"text","align":"left"},{"field":"modelo","label":"Modelo","order":80,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fin_garantia","label":"Fin garantia","order":90,"visible":true,"export":true,"format":"date","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"personas_con_equipo_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Activa reporte desde relaciones reales de iTop', 'system', NOW())
ON DUPLICATE KEY UPDATE status = VALUES(status), definition_json = VALUES(definition_json), change_reason = VALUES(change_reason), created_by = VALUES(created_by), activated_at = VALUES(activated_at);

-- Personas sin equipo asignado
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('people_without_assigned_assets', 'Personas sin equipo asignado', 'Detecta personas activas de iTop sin activos CMDB asociados actualmente.', 'Asignacion', 'base', 'active', 2, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);
SET @rd_people_without = LAST_INSERT_ID();
UPDATE hub_report_definition_versions SET status = 'deprecated' WHERE report_definition_id = @rd_people_without AND status = 'active';
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd_people_without, 2, 'active', '{"id":"people_without_assigned_assets","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Personas sin equipo asignado","description":"Detecta personas activas de iTop sin activos CMDB asociados actualmente.","category":"Asignacion","tags":["itop","cmdb","personas","sin-equipo"],"available":true},"source":{"mode":"itop_service","engine":"itop","service_key":"people_without_assigned_assets","alias":"people"},"filters":[{"name":"person_query","label":"Persona","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre, correo o cargo","apply_when":"has_value"}],"columns":[{"field":"persona","label":"Persona","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"correo","label":"Correo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"cargo","label":"Cargo","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"organizacion","label":"Organizacion","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado_persona","label":"Estado","order":50,"visible":true,"export":true,"format":"badge","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"personas_sin_equipo_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Activa reporte filtrando personas iTop contra relaciones CMDB vigentes', 'system', NOW())
ON DUPLICATE KEY UPDATE status = VALUES(status), definition_json = VALUES(definition_json), change_reason = VALUES(change_reason), created_by = VALUES(created_by), activated_at = VALUES(activated_at);

-- Recepciones con reparacion requerida
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('lab_repairs', 'Recepciones con reparacion requerida', 'Lista actas de laboratorio asociadas a reparacion, garantia o revision de hardware.', 'Laboratorio', 'base', 'active', 2, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);
SET @rd_lab_repairs = LAST_INSERT_ID();
UPDATE hub_report_definition_versions SET status = 'deprecated' WHERE report_definition_id = @rd_lab_repairs AND status = 'active';
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd_lab_repairs, 2, 'active', '{"id":"lab_repairs","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Recepciones con reparacion requerida","description":"Lista actas de laboratorio asociadas a reparacion, garantia o revision de hardware.","category":"Laboratorio","tags":["laboratorio","reparacion","garantia","hardware"],"available":true},"source":{"mode":"local","service_key":"lab_repairs","alias":"lab"},"filters":[{"name":"from_date","label":"Desde","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"to_date","label":"Hasta","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"owner_name","label":"Responsable","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre del tecnico","apply_when":"has_value"}],"columns":[{"field":"numero_acta","label":"Acta","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha_ingreso","label":"Fecha ingreso","order":20,"visible":true,"export":true,"format":"date","align":"left"},{"field":"activo","label":"Activo","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"motivo","label":"Motivo","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fase_actual","label":"Fase actual","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":60,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"responsable","label":"Responsable","order":70,"visible":true,"export":true,"format":"text","align":"left"},{"field":"diagnostico","label":"Diagnostico / trabajo","order":80,"visible":true,"export":true,"format":"text","align":"left","wide":true}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"laboratorio_reparaciones_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Activa reporte usando hub_lab_records actual', 'system', NOW())
ON DUPLICATE KEY UPDATE status = VALUES(status), definition_json = VALUES(definition_json), change_reason = VALUES(change_reason), created_by = VALUES(created_by), activated_at = VALUES(activated_at);

-- Modelos fuera de estandar
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('non_standard_models', 'Modelos fuera de estandar', 'Detecta activos con modelo faltante o marcado como legacy/EOL en CMDB.', 'Renovacion', 'base', 'active', 2, 'system')
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
UPDATE hub_report_definition_versions SET status = 'deprecated' WHERE report_definition_id = @rd_non_standard AND status = 'active';
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd_non_standard, 2, 'active', '{"id":"non_standard_models","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Modelos fuera de estandar","description":"Detecta activos con modelo faltante o marcado como legacy/EOL en CMDB.","category":"Renovacion","tags":["itop","cmdb","modelos","estandar"],"available":true},"source":{"mode":"itop_service","engine":"itop","service_key":"non_standard_models","alias":"assets"},"filters":[{"name":"finalclass","label":"Tipo de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"cmdb_enabled_asset_types"}},{"name":"status","label":"Estado CMDB","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options_source":{"mode":"local","source":"itop_asset_states"}},{"name":"location","label":"Locacion","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Filtrar por ubicacion","apply_when":"has_value"}],"columns":[{"field":"codigo","label":"Codigo","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"clase","label":"Clase","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"marca","label":"Marca","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"modelo","label":"Modelo","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"motivo","label":"Motivo","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"responsable","label":"Responsable","order":60,"visible":true,"export":true,"format":"text","align":"left"},{"field":"locacion","label":"Locacion","order":70,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":80,"visible":true,"export":true,"format":"badge","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"modelos_fuera_estandar_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Activa version inicial basada en modelo faltante o marcado legacy/EOL', 'system', NOW())
ON DUPLICATE KEY UPDATE status = VALUES(status), definition_json = VALUES(definition_json), change_reason = VALUES(change_reason), created_by = VALUES(created_by), activated_at = VALUES(activated_at);

-- Inconsistencias entre CMDB y actas
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('cmdb_vs_handover_inconsistencies', 'Inconsistencias entre CMDB y actas', 'Compara ultimo respaldo documental local contra responsable actual CMDB en iTop.', 'Calidad CMDB', 'base', 'active', 2, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);
SET @rd_incons = LAST_INSERT_ID();
UPDATE hub_report_definition_versions SET status = 'deprecated' WHERE report_definition_id = @rd_incons AND status = 'active';
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd_incons, 2, 'active', '{"id":"cmdb_vs_handover_inconsistencies","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Inconsistencias entre CMDB y actas","description":"Compara ultimo respaldo documental local contra responsable actual CMDB en iTop.","category":"Calidad CMDB","tags":["itop","cmdb","actas","inconsistencias"],"available":true},"source":{"mode":"itop_service","engine":"itop","service_key":"cmdb_vs_handover_inconsistencies","alias":"assets"},"filters":[{"name":"asset_query","label":"Activo","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Codigo o nombre de activo","apply_when":"has_value"}],"columns":[{"field":"activo","label":"Activo","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"acta","label":"Acta respaldo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"tipo_diferencia","label":"Diferencia","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"valor_documental","label":"Valor documental","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"valor_cmdb","label":"Valor CMDB","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"prioridad","label":"Prioridad","order":60,"visible":true,"export":true,"format":"badge","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"inconsistencias_cmdb_actas_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Activa cruce inicial entre ultimo respaldo documental y CMDB', 'system', NOW())
ON DUPLICATE KEY UPDATE status = VALUES(status), definition_json = VALUES(definition_json), change_reason = VALUES(change_reason), created_by = VALUES(created_by), activated_at = VALUES(activated_at);

-- Garantia final: solo current_version queda activa para cortar duplicados heredados.
UPDATE hub_report_definition_versions rdv
INNER JOIN hub_report_definitions rd ON rd.id = rdv.report_definition_id
SET rdv.status = 'deprecated'
WHERE rdv.status = 'active'
  AND rdv.version <> rd.current_version;

UPDATE hub_report_definition_versions rdv
INNER JOIN hub_report_definitions rd ON rd.id = rdv.report_definition_id
SET rdv.status = 'active', rdv.activated_at = COALESCE(rdv.activated_at, NOW())
WHERE rd.status = 'active'
  AND rdv.version = rd.current_version;

COMMIT;
