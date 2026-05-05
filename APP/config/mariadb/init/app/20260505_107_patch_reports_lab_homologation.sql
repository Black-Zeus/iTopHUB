-- ============================================================
-- PATCH: Homologacion de informes documentales y de laboratorio
-- Motivo:
--   * El modulo de laboratorio ya no usa hub_handover_documents.
--   * Se corrigen reportes que seguian consultando el flujo antiguo.
--   * Se agregan nuevos reportes de seguimiento historico y derivaciones.
-- ============================================================

SET NAMES utf8mb4;
START TRANSACTION;

-- -------------------------------------------------------
-- 6. handover_documents_by_period -> version 2
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('handover_documents_by_period', 'Actas emitidas por periodo', 'Centraliza la emision documental del periodo, integrando actas operativas de handover y laboratorio por responsable.', 'Documental', 'base', 'active', 2, 'system')
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
VALUES (@rd6, 2, 'active', '{"id":"handover_documents_by_period","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Actas emitidas por periodo","description":"Centraliza la emision documental del periodo, integrando actas operativas de handover y laboratorio por responsable.","category":"Documental","tags":["actas","handover","laboratorio","periodo"],"available":true},"source":{"mode":"local","service_key":"handover_documents_by_period","alias":"docs"},"filters":[{"name":"from_date","label":"Desde","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"to_date","label":"Hasta","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"handover_type","label":"Tipo documental","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todos","value":null},{"label":"Entrega","value":"initial_assignment"},{"label":"Recepcion","value":"return"},{"label":"Laboratorio","value":"laboratory"},{"label":"Reasignacion","value":"reassignment"},{"label":"Reposicion","value":"replacement"},{"label":"Normalizacion","value":"normalization"}]},{"name":"owner_name","label":"Responsable","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre del responsable","apply_when":"has_value"}],"columns":[{"field":"tipo","label":"Tipo","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"numero","label":"Numero","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha","label":"Fecha","order":30,"visible":true,"export":true,"format":"date","align":"left"},{"field":"responsable","label":"Responsable","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"activos","label":"Activos","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"usuario_relacionado","label":"Usuario relacionado","order":60,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":70,"visible":true,"export":true,"format":"badge","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"actas_periodo_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Homologa laboratorio sobre hub_lab_records y amplia tipos documentales', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 7. pending_delivery_confirmations -> version 2
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('pending_delivery_confirmations', 'Entregas pendientes de confirmacion', 'Controla exclusivamente actas de entrega emitidas que aun no tienen validacion final del receptor o cierre documental completo.', 'Documental', 'base', 'active', 2, 'system')
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
VALUES (@rd7, 2, 'active', '{"id":"pending_delivery_confirmations","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Entregas pendientes de confirmacion","description":"Controla exclusivamente actas de entrega emitidas que aun no tienen validacion final del receptor o cierre documental completo.","category":"Documental","tags":["actas","pendiente","confirmacion","entrega"],"available":true},"source":{"mode":"local","service_key":"pending_delivery_confirmations","alias":"docs"},"filters":[{"name":"from_date","label":"Desde","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"to_date","label":"Hasta","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"owner_name","label":"Responsable","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre del responsable","apply_when":"has_value"}],"columns":[{"field":"acta","label":"Acta","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha","label":"Fecha","order":20,"visible":true,"export":true,"format":"date","align":"left"},{"field":"activos","label":"Activos","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"persona","label":"Persona","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"responsable","label":"Responsable","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":60,"visible":true,"export":true,"format":"badge","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"entregas_pendientes_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Restringe el reporte a entregas reales y corrige falsos positivos', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 8. asset_movement_history -> version 2
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('asset_movement_history', 'Historial de movimientos por activo', 'Reconstruye la trazabilidad de un activo, incluyendo handover, devoluciones, reasignaciones e ingresos a laboratorio.', 'Movimientos', 'base', 'active', 2, 'system')
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
VALUES (@rd8, 2, 'active', '{"id":"asset_movement_history","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Historial de movimientos por activo","description":"Reconstruye la trazabilidad de un activo, incluyendo handover, devoluciones, reasignaciones e ingresos a laboratorio.","category":"Movimientos","tags":["actas","movimientos","trazabilidad","activo","laboratorio"],"available":true},"source":{"mode":"local","service_key":"asset_movement_history","alias":"movements"},"filters":[{"name":"asset_code","label":"Codigo de activo","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Ej: NB-24017","apply_when":"has_value"},{"name":"from_date","label":"Desde","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"to_date","label":"Hasta","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"handover_type","label":"Tipo de movimiento","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todos","value":null},{"label":"Entrega","value":"initial_assignment"},{"label":"Recepcion","value":"return"},{"label":"Reasignacion","value":"reassignment"},{"label":"Reposicion","value":"replacement"},{"label":"Normalizacion","value":"normalization"},{"label":"Laboratorio","value":"laboratory"}]}],"columns":[{"field":"fecha","label":"Fecha","order":10,"visible":true,"export":true,"format":"date","align":"left"},{"field":"activo","label":"Activo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"tipo_movimiento","label":"Movimiento","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"origen","label":"Origen","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"destino","label":"Destino","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado_activo","label":"Estado activo","order":60,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"numero_acta","label":"Acta","order":70,"visible":true,"export":true,"format":"text","align":"left"},{"field":"observacion_activo","label":"Observacion del activo","order":80,"visible":true,"export":true,"format":"text","align":"left","wide":true}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"historial_movimientos_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Incluye ingresos a laboratorio y normaliza tipos de movimiento', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 9. lab_equipment_current -> version 2
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('lab_equipment_current', 'Equipos en laboratorio', 'Resume la carga vigente del laboratorio con foco en casos abiertos, fase actual y responsable tecnico.', 'Laboratorio', 'base', 'active', 2, 'system')
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
VALUES (@rd9, 2, 'active', '{"id":"lab_equipment_current","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Equipos en laboratorio","description":"Resume la carga vigente del laboratorio con foco en casos abiertos, fase actual y responsable tecnico.","category":"Laboratorio","tags":["laboratorio","activos","cola","seguimiento"],"available":true},"source":{"mode":"local","service_key":"lab_equipment_current","alias":"lab"},"filters":[{"name":"status","label":"Estado acta","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todos","value":null},{"label":"Borrador","value":"draft"},{"label":"En laboratorio","value":"in_lab"},{"label":"Pendiente de firma","value":"pending_signature"},{"label":"Firmada","value":"signed"},{"label":"Completada","value":"completed"},{"label":"Derivada a obsoleto","value":"derived_obsolete"},{"label":"Anulada","value":"cancelled"}]},{"name":"reason","label":"Motivo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todos","value":null},{"label":"Mantenimiento","value":"maintenance"},{"label":"Limpieza","value":"cleaning"},{"label":"Reinstalacion","value":"reinstallation"},{"label":"Respaldo","value":"backup"},{"label":"Diagnostico","value":"diagnosis"},{"label":"Actualizacion de software","value":"software_update"},{"label":"Verificacion funcional","value":"verification"},{"label":"Reparacion de hardware","value":"hardware_repair"}]},{"name":"owner_name","label":"Responsable","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre del tecnico","apply_when":"has_value"}],"columns":[{"field":"numero_acta","label":"Acta","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"activos","label":"Activo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"motivo","label":"Motivo","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fase_actual","label":"Fase actual","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":50,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"responsable","label":"Responsable","order":60,"visible":true,"export":true,"format":"text","align":"left"},{"field":"receptor","label":"Usuario relacionado","order":70,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha_ingreso","label":"Fecha ingreso","order":80,"visible":true,"export":true,"format":"date","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"equipos_laboratorio_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Homologa laboratorio sobre hub_lab_records y agrega fase actual', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 10. incomplete_handover_documents -> version 2
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('incomplete_handover_documents', 'Documentos operativos con circuito incompleto', 'Detecta documentos operativos en estado borrador, emitido o en proceso, integrando handover y laboratorio.', 'Documental', 'base', 'active', 2, 'system')
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
VALUES (@rd10, 2, 'active', '{"id":"incomplete_handover_documents","version":2,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Documentos operativos con circuito incompleto","description":"Detecta documentos operativos en estado borrador, emitido o en proceso, integrando handover y laboratorio.","category":"Documental","tags":["actas","pendiente","incompleto","documental","laboratorio"],"available":true},"source":{"mode":"local","service_key":"incomplete_handover_documents","alias":"docs"},"filters":[{"name":"from_date","label":"Desde","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"to_date","label":"Hasta","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"handover_type","label":"Tipo documental","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todos","value":null},{"label":"Entrega","value":"initial_assignment"},{"label":"Recepcion","value":"return"},{"label":"Laboratorio","value":"laboratory"},{"label":"Reasignacion","value":"reassignment"},{"label":"Reposicion","value":"replacement"},{"label":"Normalizacion","value":"normalization"}]}],"columns":[{"field":"documento","label":"Documento","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"tipo","label":"Tipo","order":20,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha","label":"Fecha","order":30,"visible":true,"export":true,"format":"date","align":"left"},{"field":"activos","label":"Activos","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"responsable","label":"Responsable","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"persona","label":"Persona","order":55,"visible":true,"export":true,"format":"text","align":"left"},{"field":"faltante","label":"Faltante","order":60,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":70,"visible":true,"export":true,"format":"badge","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"documentos_incompletos_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Integra laboratorio y amplía cobertura de tipos documentales', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 16. lab_records_by_period  [Laboratorio / local]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('lab_records_by_period', 'Actas de laboratorio por periodo', 'Entrega una vista historica del laboratorio por periodo, motivo, fase actual y responsable tecnico.', 'Laboratorio', 'base', 'active', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd16 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd16, 1, 'active', '{"id":"lab_records_by_period","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Actas de laboratorio por periodo","description":"Entrega una vista historica del laboratorio por periodo, motivo, fase actual y responsable tecnico.","category":"Laboratorio","tags":["laboratorio","historico","periodo","seguimiento"],"available":true},"source":{"mode":"local","service_key":"lab_records_by_period","alias":"lab"},"filters":[{"name":"from_date","label":"Desde","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"to_date","label":"Hasta","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"reason","label":"Motivo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todos","value":null},{"label":"Mantenimiento","value":"maintenance"},{"label":"Limpieza","value":"cleaning"},{"label":"Reinstalacion","value":"reinstallation"},{"label":"Respaldo","value":"backup"},{"label":"Diagnostico","value":"diagnosis"},{"label":"Actualizacion de software","value":"software_update"},{"label":"Verificacion funcional","value":"verification"},{"label":"Reparacion de hardware","value":"hardware_repair"}]},{"name":"status","label":"Estado","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todos","value":null},{"label":"Borrador","value":"draft"},{"label":"En laboratorio","value":"in_lab"},{"label":"Pendiente de firma","value":"pending_signature"},{"label":"Firmada","value":"signed"},{"label":"Completada","value":"completed"},{"label":"Derivada a obsoleto","value":"derived_obsolete"},{"label":"Anulada","value":"cancelled"}]},{"name":"phase","label":"Fase actual","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todas","value":null},{"label":"Entrada","value":"entrada"},{"label":"Procesamiento","value":"procesamiento"},{"label":"Salida","value":"salida"}]},{"name":"owner_name","label":"Responsable","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre del tecnico","apply_when":"has_value"}],"columns":[{"field":"numero_acta","label":"Acta","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha_ingreso","label":"Fecha ingreso","order":20,"visible":true,"export":true,"format":"date","align":"left"},{"field":"activo","label":"Activo","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"motivo","label":"Motivo","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fase_actual","label":"Fase actual","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":60,"visible":true,"export":true,"format":"badge","align":"left"},{"field":"responsable","label":"Responsable","order":70,"visible":true,"export":true,"format":"text","align":"left"},{"field":"usuario_relacionado","label":"Usuario relacionado","order":80,"visible":true,"export":true,"format":"text","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"actas_laboratorio_periodo_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Nuevo reporte base para historico de laboratorio', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

-- -------------------------------------------------------
-- 17. lab_obsolete_derivations  [Laboratorio / local]
-- -------------------------------------------------------
INSERT INTO hub_report_definitions (report_code, name, description, category, type, status, current_version, created_by)
VALUES ('lab_obsolete_derivations', 'Actas derivadas a obsoleto', 'Lista las actas de laboratorio que finalizaron con derivacion a obsoleto para seguimiento de normalizacion y baja.', 'Laboratorio', 'base', 'active', 1, 'system')
ON DUPLICATE KEY UPDATE
    id = LAST_INSERT_ID(id),
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    type = VALUES(type),
    status = VALUES(status),
    current_version = VALUES(current_version),
    updated_by = VALUES(created_by);

SET @rd17 = LAST_INSERT_ID();
INSERT INTO hub_report_definition_versions (report_definition_id, version, status, definition_json, change_reason, created_by, activated_at)
VALUES (@rd17, 1, 'active', '{"id":"lab_obsolete_derivations","version":1,"status":"active","scope":{"visibility":"global","type":"base"},"metadata":{"name":"Actas derivadas a obsoleto","description":"Lista las actas de laboratorio que finalizaron con derivacion a obsoleto para seguimiento de normalizacion y baja.","category":"Laboratorio","tags":["laboratorio","obsoleto","normalizacion","cierres"],"available":true},"source":{"mode":"local","service_key":"lab_obsolete_derivations","alias":"lab"},"filters":[{"name":"from_date","label":"Desde","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"to_date","label":"Hasta","type":"date","enabled":true,"required":false,"default":null,"apply_when":"has_value"},{"name":"reason","label":"Motivo","type":"select","enabled":true,"required":false,"default":null,"apply_when":"has_value","options":[{"label":"Todos","value":null},{"label":"Mantenimiento","value":"maintenance"},{"label":"Limpieza","value":"cleaning"},{"label":"Reinstalacion","value":"reinstallation"},{"label":"Respaldo","value":"backup"},{"label":"Diagnostico","value":"diagnosis"},{"label":"Actualizacion de software","value":"software_update"},{"label":"Verificacion funcional","value":"verification"},{"label":"Reparacion de hardware","value":"hardware_repair"}]},{"name":"owner_name","label":"Responsable","type":"text","enabled":true,"required":false,"default":null,"placeholder":"Nombre del tecnico","apply_when":"has_value"}],"columns":[{"field":"numero_acta","label":"Acta","order":10,"visible":true,"export":true,"format":"text","align":"left"},{"field":"fecha_salida","label":"Fecha salida","order":20,"visible":true,"export":true,"format":"date","align":"left"},{"field":"activo","label":"Activo","order":30,"visible":true,"export":true,"format":"text","align":"left"},{"field":"motivo","label":"Motivo","order":40,"visible":true,"export":true,"format":"text","align":"left"},{"field":"responsable","label":"Responsable","order":50,"visible":true,"export":true,"format":"text","align":"left"},{"field":"trabajo_realizado","label":"Trabajo realizado","order":60,"visible":true,"export":true,"format":"text","align":"left","wide":true},{"field":"acta_normalizacion","label":"Acta normalizacion","order":70,"visible":true,"export":true,"format":"text","align":"left"},{"field":"estado","label":"Estado","order":80,"visible":true,"export":true,"format":"badge","align":"left"}],"output":{"table":{"enabled":true,"pagination":{"enabled":true,"default_page_size":100,"allowed_page_sizes":[100,200,500,1000]}},"export":{"csv":{"enabled":true,"scopes":["current_page","all"],"filename_template":"laboratorio_obsoleto_{date}.csv","use_column_order":true,"only_export_enabled_columns":true}}}}', 'Nuevo reporte base para cierres derivados a obsoleto', 'system', NOW())
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    definition_json = VALUES(definition_json),
    change_reason = VALUES(change_reason),
    created_by = VALUES(created_by),
    activated_at = VALUES(activated_at);

COMMIT;
