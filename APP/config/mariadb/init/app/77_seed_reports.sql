-- ============================================================
-- SEED: Report definitions + initial active versions
-- Motor: MariaDB
-- Correccion aplicada:
--   * Seed idempotente/re-ejecutable.
--   * Upsert por report_code en hub_report_definitions.
--   * Upsert por (report_definition_id, version) en hub_report_definition_versions.
--   * LAST_INSERT_ID(id) para reutilizar el ID existente al actualizar.
-- Active reports: 10 (5 OQL / 5 local)
-- Inactive reports: 5 (unsupported in Phase 1, documented below)
-- ============================================================

SET NAMES utf8mb4;
START TRANSACTION;

-- -------------------------------------------------------
-- 1. assets_by_cmdb_status  [Inventario / OQL]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_by_cmdb_status', 'Activos por estado CMDB', 'Muestra la distribucion actual del inventario por estado CMDB para analizar disponibilidad, uso efectivo y pendientes tecnicos.', 'Inventario', 'base', 'active', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd1 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd1, 1, 'active', '{"id":"assets_by_cmdb_status","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Activos por estado CMDB","description":"Muestra la distribucion actual del inventario por estado CMDB para analizar disponibilidad, uso efectivo y pendientes tecnicos.","category":"Inventario","tags":["itop","cmdb","activos","estado"],"available":true},"source":{"mode":"oql","engine":"itop","alias":"assets","query":{"language":"oql","base_statement":"SELECT PhysicalDevice","output_fields":"id,name,status,finalclass,location_id_friendlyname,contact_id_friendlyname","default_order_by":"name ASC"}},"filters":[{"name":"finalclass","label":"Tipo de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","target":{"source":"assets","field":"finalclass","operator":"=","parameter":"finalclass"},"options":[{"label":"Todos","value":null},{"label":"PC","value":"PC"},{"label":"Monitor","value":"Monitor"},{"label":"Servidor","value":"Server"},{"label":"Periferico","value":"Peripheral"}]},{"name":"status","label":"Estado CMDB","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","target":{"source":"assets","field":"status","operator":"=","parameter":"status"},"options":[{"label":"Todos","value":null},{"label":"Produccion","value":"production"},{"label":"Stock","value":"stock"},{"label":"Obsoleto","value":"obsolete"},{"label":"En reparacion","value":"repair"},{"label":"Eliminado","value":"disposed"}]},{"name":"name","label":"Nombre del activo","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Ej: notebook, servidor","apply_when":"has_value","target":{"source":"assets","field":"name","operator":"contains","parameter":"name"}}],"columns":[{"field":"name","label":"Codigo","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"finalclass","label":"Tipo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"status","label":"Estado CMDB","order":30,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"location_id_friendlyname","label":"Ubicacion","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"contact_id_friendlyname","label":"Usuario actual","order":50,"visible":true,"export":true,"format":"text","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[25,50,100,250]}},"export":{"csv":{"enabled":true,"filename_template":"activos_estado_cmdb_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Version inicial', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 2. available_stock_by_asset_type  [Inventario / OQL]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('available_stock_by_asset_type', 'Stock disponible por tipo de activo', 'Muestra los activos disponibles en stock, segmentados por familia, modelo y estado operativo para acelerar nuevas asignaciones.', 'Inventario', 'base', 'active', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd2 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd2, 1, 'active', '{"id":"available_stock_by_asset_type","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Stock disponible por tipo de activo","description":"Muestra los activos disponibles en stock, segmentados por familia, modelo y estado operativo para acelerar nuevas asignaciones.","category":"Inventario","tags":["itop","cmdb","stock","disponible"],"available":true},"source":{"mode":"oql","engine":"itop","alias":"assets","query":{"language":"oql","base_statement":"SELECT PhysicalDevice WHERE status = ''stock''","output_fields":"id,name,status,finalclass,location_id_friendlyname,contact_id_friendlyname","default_order_by":"finalclass ASC, name ASC"}},"filters":[{"name":"finalclass","label":"Tipo de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","target":{"source":"assets","field":"finalclass","operator":"=","parameter":"finalclass"},"options":[{"label":"Todos","value":null},{"label":"PC","value":"PC"},{"label":"Monitor","value":"Monitor"},{"label":"Periferico","value":"Peripheral"}]},{"name":"name","label":"Nombre","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Filtrar por nombre","apply_when":"has_value","target":{"source":"assets","field":"name","operator":"contains","parameter":"name"}}],"columns":[{"field":"name","label":"Codigo","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"finalclass","label":"Tipo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"status","label":"Estado","order":30,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"location_id_friendlyname","label":"Ubicacion logica","order":40,"visible":true,"export":true,"format":"text","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[25,50,100,250]}},"export":{"csv":{"enabled":true,"filename_template":"stock_disponible_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Version inicial', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 3. assets_by_location  [Inventario / OQL]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_by_location', 'Activos por locacion', 'Distribuye el inventario por sede o ubicacion logica para facilitar control territorial, planificacion de soporte y validacion de presencia operativa.', 'Inventario', 'base', 'active', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd3 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd3, 1, 'active', '{"id":"assets_by_location","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Activos por locacion","description":"Distribuye el inventario por sede o ubicacion logica para facilitar control territorial, planificacion de soporte y validacion de presencia operativa.","category":"Inventario","tags":["itop","cmdb","locacion","inventario"],"available":true},"source":{"mode":"oql","engine":"itop","alias":"assets","query":{"language":"oql","base_statement":"SELECT PhysicalDevice","output_fields":"id,name,status,finalclass,location_id_friendlyname,contact_id_friendlyname","default_order_by":"location_id_friendlyname ASC, name ASC"}},"filters":[{"name":"location_id_friendlyname","label":"Locacion","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Ej: Oficina Central","apply_when":"has_value","target":{"source":"assets","field":"location_id_friendlyname","operator":"contains","parameter":"location_id_friendlyname"}},{"name":"finalclass","label":"Tipo de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","target":{"source":"assets","field":"finalclass","operator":"=","parameter":"finalclass"},"options":[{"label":"Todos","value":null},{"label":"PC","value":"PC"},{"label":"Monitor","value":"Monitor"},{"label":"Servidor","value":"Server"},{"label":"Periferico","value":"Peripheral"}]},{"name":"status","label":"Estado","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","target":{"source":"assets","field":"status","operator":"=","parameter":"status"},"options":[{"label":"Todos","value":null},{"label":"Asignado","value":"production"},{"label":"Disponible","value":"stock"},{"label":"Obsoleto","value":"obsolete"}]}],"columns":[{"field":"location_id_friendlyname","label":"Locacion","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"name","label":"Codigo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"finalclass","label":"Tipo","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"status","label":"Estado","order":40,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"contact_id_friendlyname","label":"Usuario actual","order":50,"visible":true,"export":true,"format":"text","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[25,50,100,250]}},"export":{"csv":{"enabled":true,"filename_template":"activos_por_locacion_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Version inicial', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 4. assets_near_replacement  [Renovacion / OQL]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_near_replacement', 'Activos proximos a recambio', 'Identifica equipos cercanos al fin de vida util o con antiguedad critica para planificar renovacion y reasignaciones preventivas.', 'Renovacion', 'base', 'active', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd4 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd4, 1, 'active', '{"id":"assets_near_replacement","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Activos proximos a recambio","description":"Identifica equipos cercanos al fin de vida util o con antiguedad critica para planificar renovacion y reasignaciones preventivas.","category":"Renovacion","tags":["itop","cmdb","renovacion","antiguedad"],"available":true},"source":{"mode":"oql","engine":"itop","alias":"assets","query":{"language":"oql","base_statement":"SELECT PhysicalDevice","output_fields":"id,name,status,finalclass,brand_id_friendlyname,model_id_friendlyname,move2production,contact_id_friendlyname","default_order_by":"move2production ASC"}},"filters":[{"name":"finalclass","label":"Familia de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","target":{"source":"assets","field":"finalclass","operator":"=","parameter":"finalclass"},"options":[{"label":"Todas","value":null},{"label":"PC","value":"PC"},{"label":"Monitor","value":"Monitor"},{"label":"Servidor","value":"Server"}]},{"name":"move2production_before","label":"En produccion antes de","type":"text","enabled":true,"required":false,"default":null,"placeholder":"AAAA-MM-DD","apply_when":"has_value","target":{"source":"assets","field":"move2production","operator":"<=","parameter":"move2production_before"}}],"columns":[{"field":"name","label":"Codigo","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"finalclass","label":"Tipo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"brand_id_friendlyname","label":"Marca","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"model_id_friendlyname","label":"Modelo","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"move2production","label":"Fecha alta","order":50,"visible":true,"export":true,"format":"date","align":"left"},{"field":"status","label":"Estado","order":60,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"contact_id_friendlyname","label":"Usuario actual","order":70,"visible":true,"export":true,"format":"text","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[25,50,100,250]}},"export":{"csv":{"enabled":true,"filename_template":"activos_proximos_recambio_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Version inicial', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 5. assets_missing_user_or_location  [Calidad CMDB / OQL]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('assets_missing_user_or_location', 'Activos sin usuario o ubicacion', 'Detecta registros incompletos en CMDB donde faltan relaciones clave como usuario asignado o ubicacion logica.', 'Calidad CMDB', 'base', 'active', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd5 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd5, 1, 'active', '{"id":"assets_missing_user_or_location","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Activos sin usuario o ubicacion","description":"Detecta registros incompletos en CMDB donde faltan relaciones clave como usuario asignado o ubicacion logica.","category":"Calidad CMDB","tags":["itop","cmdb","calidad","incompleto"],"available":true},"source":{"mode":"oql","engine":"itop","alias":"assets","query":{"language":"oql","base_statement":"SELECT PhysicalDevice WHERE contact_id = 0 OR location_id = 0","output_fields":"id,name,status,finalclass,location_id_friendlyname,contact_id_friendlyname","default_order_by":"name ASC"}},"filters":[{"name":"finalclass","label":"Tipo de activo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","target":{"source":"assets","field":"finalclass","operator":"=","parameter":"finalclass"},"options":[{"label":"Todos","value":null},{"label":"PC","value":"PC"},{"label":"Monitor","value":"Monitor"},{"label":"Servidor","value":"Server"},{"label":"Periferico","value":"Peripheral"}]}],"columns":[{"field":"name","label":"Codigo","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"finalclass","label":"Tipo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"contact_id_friendlyname","label":"Usuario actual","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"location_id_friendlyname","label":"Ubicacion","order":40,"visible":true,"export":true,"format":"text","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[25,50,100,250]}},"export":{"csv":{"enabled":true,"filename_template":"activos_sin_usuario_ubicacion_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Version inicial', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 6. handover_documents_by_period  [Documental / local]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('handover_documents_by_period', 'Actas emitidas por periodo', 'Centraliza la emision documental del periodo para medir volumen de entregas, recepciones y registros tecnicos por responsable.', 'Documental', 'base', 'active', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd6 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd6, 1, 'active', '{"id":"handover_documents_by_period","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Actas emitidas por periodo","description":"Centraliza la emision documental del periodo para medir volumen de entregas, recepciones y registros tecnicos por responsable.","category":"Documental","tags":["actas","handover","documental","periodo"],"available":true},"source":{"mode":"local","service_key":"handover_documents_by_period","alias":"docs"},"filters":[{"name":"from_date","label":"Desde","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"to_date","label":"Hasta","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"handover_type","label":"Tipo documental","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todos","value":null},{"label":"Entrega","value":"initial_assignment"},{"label":"Recepcion","value":"return"},{"label":"Laboratorio","value":"laboratory"},{"label":"Reasignacion","value":"reassignment"}]},{"name":"owner_name","label":"Responsable","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre del responsable","apply_when":"has_value"}],"columns":[{"field":"tipo","label":"Tipo","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"numero","label":"Numero","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha","label":"Fecha","order":30,"visible":true,"export":true,"format":"date","align":"left"},{"field":"responsable","label":"Responsable","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"activos","label":"Activos","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"usuario_relacionado","label":"Usuario relacionado","order":60,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":70,"visible":true,"export":true,"format":"badge","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[25,50,100,250]}},"export":{"csv":{"enabled":true,"filename_template":"actas_periodo_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Version inicial', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 7. pending_delivery_confirmations  [Documental / local]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('pending_delivery_confirmations', 'Entregas pendientes de confirmacion', 'Controla actas de entrega emitidas que aun no tienen validacion final del receptor o cierre documental completo.', 'Documental', 'base', 'active', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd7 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd7, 1, 'active', '{"id":"pending_delivery_confirmations","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Entregas pendientes de confirmacion","description":"Controla actas de entrega emitidas que aun no tienen validacion final del receptor o cierre documental completo.","category":"Documental","tags":["actas","pendiente","confirmacion","entrega"],"available":true},"source":{"mode":"local","service_key":"pending_delivery_confirmations","alias":"docs"},"filters":[{"name":"from_date","label":"Desde","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"to_date","label":"Hasta","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"owner_name","label":"Responsable","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre del responsable","apply_when":"has_value"}],"columns":[{"field":"acta","label":"Acta","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha","label":"Fecha","order":20,"visible":true,"export":true,"format":"date","align":"left"},{"field":"activos","label":"Activos","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"persona","label":"Persona","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"responsable","label":"Responsable","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":60,"visible":true,"export":true,"format":"badge","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[25,50,100,250]}},"export":{"csv":{"enabled":true,"filename_template":"entregas_pendientes_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Version inicial', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 8. asset_movement_history  [Movimientos / local]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('asset_movement_history', 'Historial de movimientos por activo', 'Reconstruye la trazabilidad de un activo, incluyendo cambios de estado, transferencias, ingresos a laboratorio y referencias documentales.', 'Movimientos', 'base', 'active', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd8 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd8, 1, 'active', '{"id":"asset_movement_history","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Historial de movimientos por activo","description":"Reconstruye la trazabilidad de un activo a traves de las actas documentales registradas en el sistema.","category":"Movimientos","tags":["actas","movimientos","trazabilidad","activo"],"available":true},"source":{"mode":"local","service_key":"asset_movement_history","alias":"movements"},"filters":[{"name":"asset_code","label":"Codigo de activo","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Ej: NB-24017","apply_when":"has_value"},{"name":"from_date","label":"Desde","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"to_date","label":"Hasta","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"handover_type","label":"Tipo de movimiento","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todos","value":null},{"label":"Entrega","value":"initial_assignment"},{"label":"Recepcion","value":"return"},{"label":"Reasignacion","value":"reassignment"},{"label":"Laboratorio","value":"laboratory"}]}],"columns":[{"field":"fecha","label":"Fecha","order":10,"visible":true,"export":true,"format":"date","align":"left"},{"field":"activo","label":"Activo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"tipo_movimiento","label":"Movimiento","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"origen","label":"Origen","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"destino","label":"Destino","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado_activo","label":"Estado activo","order":60,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"numero_acta","label":"Acta","order":70,"visible":true,"export":true,"format":"text","align":"left"},{"field":"observacion_activo","label":"Observacion del activo","order":80,"visible":true,"export":true,"format":"text","align":"left","wide":true}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[25,50,100,250]}},"export":{"csv":{"enabled":true,"filename_template":"historial_movimientos_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Version inicial', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 9. lab_equipment_current  [Laboratorio / local]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('lab_equipment_current', 'Equipos en laboratorio', 'Resume la carga vigente del laboratorio con motivo de ingreso y estado documental.', 'Laboratorio', 'base', 'active', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd9 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd9, 1, 'active', '{"id":"lab_equipment_current","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Equipos en laboratorio","description":"Resume la carga vigente del laboratorio con motivo de ingreso y estado documental.","category":"Laboratorio","tags":["laboratorio","activos","recepcion"],"available":true},"source":{"mode":"local","service_key":"lab_equipment_current","alias":"lab"},"filters":[{"name":"status","label":"Estado acta","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todos","value":null},{"label":"Borrador","value":"draft"},{"label":"Emitida","value":"issued"},{"label":"Confirmada","value":"confirmed"}]}],"columns":[{"field":"numero_acta","label":"Acta recepcion","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"activos","label":"Activos","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"motivo","label":"Motivo","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":40,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"responsable","label":"Responsable","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"receptor","label":"Receptor","order":55,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha_ingreso","label":"Fecha ingreso","order":60,"visible":true,"export":true,"format":"date","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[25,50,100,250]}},"export":{"csv":{"enabled":true,"filename_template":"equipos_laboratorio_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Version inicial', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 10. incomplete_handover_documents  [Documental / local]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('incomplete_handover_documents', 'Actas sin respaldo completo', 'Detecta documentacion en estado borrador o emitida sin confirmacion para reforzar control y completitud del circuito documental.', 'Documental', 'base', 'active', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd10 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd10, 1, 'active', '{"id":"incomplete_handover_documents","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Actas sin respaldo completo","description":"Detecta documentacion en estado borrador o emitida sin confirmacion para reforzar control y completitud del circuito documental.","category":"Documental","tags":["actas","pendiente","incompleto","documental"],"available":true},"source":{"mode":"local","service_key":"incomplete_handover_documents","alias":"docs"},"filters":[{"name":"from_date","label":"Desde","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"to_date","label":"Hasta","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"handover_type","label":"Tipo documental","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todos","value":null},{"label":"Entrega","value":"initial_assignment"},{"label":"Recepcion","value":"return"},{"label":"Laboratorio","value":"laboratory"}]}],"columns":[{"field":"documento","label":"Documento","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"tipo","label":"Tipo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha","label":"Fecha","order":30,"visible":true,"export":true,"format":"date","align":"left"},{"field":"activos","label":"Activos","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"responsable","label":"Responsable","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"persona","label":"Persona","order":55,"visible":true,"export":true,"format":"text","align":"left"},{"field":"faltante","label":"Faltante","order":60,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":70,"visible":true,"export":true,"format":"badge","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[25,50,100,250]}},"export":{"csv":{"enabled":true,"filename_template":"actas_incompletas_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Version inicial', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- ============================================================
-- INACTIVE / UNSUPPORTED REPORTS (Phase 1)
-- Documentados, semilla en BD con status=inactive.
-- ============================================================

-- -------------------------------------------------------
-- 11. people_with_assigned_assets  [Asignacion / unsupported]
-- Reporte: Personas con equipo asignado
-- Finalidad: Consolidar el parque asignado por colaborador con foco en custodia vigente.
-- Campos: Persona, Area, Activo, Tipo, Modelo, Fecha asignacion, Responsable
-- Filtros: Estado de asignacion (select), Fecha corte (date), Orden (select)
-- Motivo de no implementacion: Requiere cruce entre personas de iTop (contact_id) y
--   actas de entrega del sistema local. No existe una vista ni relacion directa entre
--   hub_handover_documents y los IDs de persona de iTop. Dependencia pendiente:
--   campo itop_person_key en hub_users y endpoint de resolucion persona-activo.
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('people_with_assigned_assets', 'Personas con equipo asignado', 'Consolida el parque asignado por colaborador con foco en custodia vigente, fecha de entrega y responsable operativo.', 'Asignacion', 'base', 'inactive', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd11 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd11, 1, 'draft', '{"id":"people_with_assigned_assets","version":1,"status":"inactive","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Personas con equipo asignado","description":"Consolida el parque asignado por colaborador con foco en custodia vigente, fecha de entrega y responsable operativo.","category":"Asignacion","tags":["asignacion","personas","activos"],"available":false},"source":{"mode":"unsupported","unsupported_reason":"Requiere cruce entre personas de iTop y actas del sistema local. Dependencia pendiente: relacion itop_person_key en hub_users con contact_id de iTop y vista unificada persona-activo asignado."},"filters":[],"columns":[],"output":{}}', 'Version inicial - no implementable en Fase 1', 'system', NULL)
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 12. people_without_assigned_assets  [Asignacion / unsupported]
-- Reporte: Personas sin equipo asignado
-- Finalidad: Detectar personas activas sin equipamiento vigente.
-- Campos: Persona, Area, Cargo, Correo, Fecha ingreso, Estado
-- Filtros: Estado persona (select), Ingreso desde (date), Ordenar por (select)
-- Motivo de no implementacion: Requiere consulta OQL compleja en iTop para obtener
--   personas sin FunctionalCI asignado. OQL no soporta NOT EXISTS directamente.
--   Alternativa: SELECT Person y luego filtrar en Python contra datos de asignacion,
--   pero falta la relacion entre Person.id y las actas de entrega locales.
--   Dependencia: misma que people_with_assigned_assets.
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('people_without_assigned_assets', 'Personas sin equipo asignado', 'Detecta personas activas sin equipamiento vigente para identificar ingresos recientes o inconsistencias entre operacion y CMDB.', 'Asignacion', 'base', 'inactive', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd12 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd12, 1, 'draft', '{"id":"people_without_assigned_assets","version":1,"status":"inactive","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Personas sin equipo asignado","description":"Detecta personas activas sin equipamiento vigente para identificar ingresos recientes o inconsistencias entre operacion y CMDB.","category":"Asignacion","tags":["asignacion","personas","sin-equipo"],"available":false},"source":{"mode":"unsupported","unsupported_reason":"Requiere OQL avanzado para obtener personas sin activos asignados o cruce contra actas locales. OQL basico de Person no soporta NOT EXISTS. Dependencia: relacion hub_users.itop_person_key con contact_id de iTop."},"filters":[],"columns":[],"output":{}}', 'Version inicial - no implementable en Fase 1', 'system', NULL)
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 13. lab_repairs  [Laboratorio / unsupported]
-- Reporte: Recepciones con reparacion requerida
-- Finalidad: Listar recepciones que derivaron en reparacion para medir carga tecnica.
-- Campos: Acta, Activo, Falla inicial, Diagnostico, Tecnico, Estado, Fecha ingreso
-- Filtros: Desde (date), Hasta (date), Estado del caso (select), Tecnico (select)
-- Motivo de no implementacion: Los campos "falla inicial", "diagnostico" y "tecnico asignado"
--   no existen en la tabla hub_handover_documents. Son propios de un workflow de laboratorio
--   tecnico no implementado aun. Dependencia: tabla hub_lab_cases o campo adicional en
--   hub_handover_documents con datos de diagnostico tecnico.
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('lab_repairs', 'Recepciones con reparacion requerida', 'Lista recepciones que derivaron en reparacion para medir carga tecnica, identificar causas recurrentes y priorizar repuestos.', 'Laboratorio', 'base', 'inactive', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd13 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd13, 1, 'draft', '{"id":"lab_repairs","version":1,"status":"inactive","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Recepciones con reparacion requerida","description":"Lista recepciones que derivaron en reparacion para medir carga tecnica, identificar causas recurrentes y priorizar repuestos.","category":"Laboratorio","tags":["laboratorio","reparacion","diagnostico"],"available":false},"source":{"mode":"unsupported","unsupported_reason":"Campos diagnostico, falla_inicial y tecnico_asignado no existen en el esquema actual. Dependencia: implementar tabla hub_lab_cases o extender hub_handover_documents con campos de workflow tecnico de laboratorio."},"filters":[],"columns":[],"output":{}}', 'Version inicial - no implementable en Fase 1', 'system', NULL)
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 14. non_standard_models  [Renovacion / unsupported]
-- Reporte: Modelos fuera de estandar
-- Finalidad: Agrupar activos que no pertenecen al catalogo tecnologico vigente.
-- Campos: Codigo, Activo, Modelo, Area, Usuario, Antiguedad, Estado
-- Filtros: Tipo de activo (select), Area (select), Fecha corte (date), Ordenar por (select)
-- Motivo de no implementacion: Requiere catalogo de modelos estandar (whitelist).
--   No existe tabla hub_standard_models ni campo "estandar" en iTop.
--   Dependencia: crear catalogo de modelos aprobados e implementar logica de comparacion
--   contra model_id_friendlyname de PhysicalDevice en iTop.
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('non_standard_models', 'Modelos fuera de estandar', 'Agrupa activos que no pertenecen al catalogo tecnologico vigente para apoyar decisiones de normalizacion y renovacion progresiva.', 'Renovacion', 'base', 'inactive', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd14 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd14, 1, 'draft', '{"id":"non_standard_models","version":1,"status":"inactive","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Modelos fuera de estandar","description":"Agrupa activos que no pertenecen al catalogo tecnologico vigente para apoyar decisiones de normalizacion y renovacion progresiva.","category":"Renovacion","tags":["renovacion","modelos","estandar","normalizacion"],"available":false},"source":{"mode":"unsupported","unsupported_reason":"Requiere catalogo de modelos tecnologicos aprobados. No existe tabla hub_standard_models ni campo de estandar en iTop. Dependencia: implementar catalogo de modelos estandar y logica de comparacion contra PhysicalDevice.model_id_friendlyname."},"filters":[],"columns":[],"output":{}}', 'Version inicial - no implementable en Fase 1', 'system', NULL)
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 15. cmdb_vs_handover_inconsistencies  [Calidad CMDB / unsupported]
-- Reporte: Inconsistencias entre CMDB y actas
-- Finalidad: Comparar relacion documental con estado actual de CMDB.
-- Campos: Activo, CMDB actual, Documento, Dato observado, Diferencia, Prioridad
-- Filtros: Desde (date), Hasta (date), Tipo de diferencia (select), Prioridad (select)
-- Motivo de no implementacion: Requiere cruzar datos de iTop (contact_id, status de
--   FunctionalCI) contra actas locales (hub_handover_documents). Faltan:
--   (a) relacion entre asset_code local y FunctionalCI.name en iTop,
--   (b) logica de deteccion de diferencias con clasificacion de prioridad,
--   (c) vista materializada o servicio de sincronizacion que mantenga coherencia.
--   Es el reporte de mayor complejidad tecnica del catalogo.
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('cmdb_vs_handover_inconsistencies', 'Inconsistencias entre CMDB y actas', 'Compara la relacion documental con el estado actual de CMDB para encontrar activos con asignacion, estado o custodio que no coinciden con el respaldo emitido.', 'Calidad CMDB', 'base', 'inactive', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd15 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd15, 1, 'draft', '{"id":"cmdb_vs_handover_inconsistencies","version":1,"status":"inactive","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Inconsistencias entre CMDB y actas","description":"Compara la relacion documental con el estado actual de CMDB para encontrar activos con asignacion, estado o custodio que no coinciden con el respaldo emitido.","category":"Calidad CMDB","tags":["calidad","cmdb","inconsistencias","cruce"],"available":false},"source":{"mode":"unsupported","unsupported_reason":"Requiere cruzar FunctionalCI de iTop con hub_handover_document_items por asset_code. Dependencias: (1) relacion asset_code <-> iTop FunctionalCI.name normalizada, (2) logica de deteccion de diferencias con prioridad, (3) servicio de sincronizacion o vista materializada. Es el reporte de mayor complejidad tecnica del catalogo."},"filters":[],"columns":[],"output":{}}', 'Version inicial - no implementable en Fase 1', 'system', NULL)
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

COMMIT;
