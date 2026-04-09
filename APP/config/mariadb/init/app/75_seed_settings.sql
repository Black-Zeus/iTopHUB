INSERT INTO hub_settings_panels (panel_code, config_json)
VALUES
    ('itop', '{"integrationUrl":"http://itop","timeoutSeconds":30,"verifySsl":true,"sessionTtlMinutes":240,"runtimeTokenTtlMinutes":60,"sessionWarningMinutes":1}'),
    ('pdq', '{"moduleEnabled":true,"databaseFilePath":"/app/data/pdq","inventoryNote":"PDQ se consume desde una copia local disponible para el backend. El Hub no consulta el servidor PDQ en linea."}'),
    ('sync', '{"manualExecutionLabel":"Disponible bajo demanda","automationMode":"Copia externa de SQLite a carpeta compartida","queryMode":"Busqueda por nombre de maquina o MAC","notes":"Preparado para tareas programadas administradas desde la interfaz."}'),
    ('mail', '{"senderName":"Mesa de Ayuda TI","senderEmail":"soporte@empresa.local","smtpHost":"mailpit","smtpPort":"1025","smtpSecurity":"none","mailFormat":"html","footerNote":"Documento generado automaticamente por iTop Hub."}'),
    ('docs', '{"handoverPrefix":"ENT","receptionPrefix":"REC","laboratoryPrefix":"LAB","numberingFormat":"AAAA-NNNN","defaultObservation":"El documento se emite como respaldo formal del movimiento registrado en CMDB."}'),
    ('cmdb', '{"enabledAssetTypes":["Desktop (PC)","Laptop (Laptop)"],"supportNote":"PDQ actua como fuente lateral de visibilidad para inventario tecnico, sin reemplazar la CMDB principal."}')
ON DUPLICATE KEY UPDATE
    config_json = VALUES(config_json);

INSERT INTO hub_sync_tasks (
    schedule_expression,
    description,
    task_type,
    command_source,
    command_value,
    is_active
)
SELECT
    '0 */6 * * *',
    'Actualiza la copia operativa de PDQ disponible para el Hub.',
    'pdq_import',
    'preset',
    'sync.pdq.refresh',
    1
WHERE NOT EXISTS (
    SELECT 1
    FROM hub_sync_tasks
    WHERE description = 'Actualiza la copia operativa de PDQ disponible para el Hub.'
);
