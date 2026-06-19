-- ============================================================
-- SEED: Reportes por correo n8n WorkFlow_v3
-- Fuente: reportes_n8n/workflow-webhook-contracts.txt
-- Motor: MariaDB
-- Nota: seed idempotente por report_code.
-- ============================================================

SET NAMES utf8mb4;

-- URL publica base de n8n para este entorno.
-- Cambiar solo este valor al preparar QA/PRD, sin slash final.
SET @n8n_public_base_url = 'http://10.101.0.122/n8n';

START TRANSACTION;

-- 10. CMDB - Activos disponibles por bodega - SMTP
INSERT INTO hub_email_reports (
    report_code, name, description, webhook_url, http_method, status,
    display_order, icon_name, logo_url, parameters_json, created_by, updated_by
) VALUES (
    'cmdb_activos_disponibles_bodega',
    'CMDB - Activos disponibles por bodega - SMTP',
    'Reporte de activos disponibles en inventario, agrupados por clase y bodega. Facilita revisar stock utilizable para asignaciones, redistribución interna, control físico y planificación de compras.',
    CONCAT(@n8n_public_base_url, '/webhook/cmdb-activos-disponibles-bodega'),
    'POST',
    'active',
    10,
    'database',
    '',
    '[{"name":"email_to","label":"Correo destinatario","type":"email","required":true,"source":"user.email","placeholder":"","defaultValue":"","description":"Destinatario principal del correo. Obligatorio para llamadas webhook.","order":1,"options":[]},{"name":"email_cc","label":"Copia (CC)","type":"text","required":false,"source":"email_cc","placeholder":"","defaultValue":"","description":"Destinatarios en copia separados por coma.","order":2,"options":[]},{"name":"email_bcc","label":"Copia oculta (BCC)","type":"text","required":false,"source":"email_bcc","placeholder":"","defaultValue":"","description":"Destinatarios en copia oculta separados por coma.","order":3,"options":[]},{"name":"include_attachment","label":"Incluir adjunto","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el adjunto CSV.","order":4,"options":[]},{"name":"include_detail","label":"Incluir detalle","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el detalle/tablas del correo.","order":5,"options":[]},{"name":"include_summary","label":"Incluir resumen","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de resumen ejecutivo.","order":6,"options":[]},{"name":"include_operational_notes","label":"Incluir notas operacionales","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de observaciones operacionales.","order":7,"options":[]},{"name":"include_itop_button_footer","label":"Incluir boton iTop","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el boton de acceso a iTop en el footer.","order":8,"options":[]},{"name":"start_date","label":"Fecha desde","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora inicial de ventana. Debe enviarse junto con end_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":9,"options":[]},{"name":"end_date","label":"Fecha hasta","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora final de ventana. Debe enviarse junto con start_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":10,"options":[]}]',
    'system',
    'system'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    webhook_url = VALUES(webhook_url),
    http_method = VALUES(http_method),
    status = VALUES(status),
    display_order = VALUES(display_order),
    icon_name = VALUES(icon_name),
    parameters_json = VALUES(parameters_json),
    updated_by = VALUES(updated_by);

-- 20. CMDB - Activos con garantía vencida - SMTP
INSERT INTO hub_email_reports (
    report_code, name, description, webhook_url, http_method, status,
    display_order, icon_name, logo_url, parameters_json, created_by, updated_by
) VALUES (
    'cmdb_activos_garantia_vencida',
    'CMDB - Activos con garantía vencida - SMTP',
    'Reporte de activos CMDB no obsoletos cuya garantía ya se encuentra vencida. Permite identificar equipamiento fuera de cobertura, apoyar renovación o reemplazo y priorizar riesgos de continuidad operacional.',
    CONCAT(@n8n_public_base_url, '/webhook/cmdb-activos-garantia-vencida'),
    'POST',
    'active',
    20,
    'database',
    '',
    '[{"name":"email_to","label":"Correo destinatario","type":"email","required":true,"source":"user.email","placeholder":"","defaultValue":"","description":"Destinatario principal del correo. Obligatorio para llamadas webhook.","order":1,"options":[]},{"name":"email_cc","label":"Copia (CC)","type":"text","required":false,"source":"email_cc","placeholder":"","defaultValue":"","description":"Destinatarios en copia separados por coma.","order":2,"options":[]},{"name":"email_bcc","label":"Copia oculta (BCC)","type":"text","required":false,"source":"email_bcc","placeholder":"","defaultValue":"","description":"Destinatarios en copia oculta separados por coma.","order":3,"options":[]},{"name":"include_attachment","label":"Incluir adjunto","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el adjunto CSV.","order":4,"options":[]},{"name":"include_detail","label":"Incluir detalle","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el detalle/tablas del correo.","order":5,"options":[]},{"name":"include_summary","label":"Incluir resumen","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de resumen ejecutivo.","order":6,"options":[]},{"name":"include_operational_notes","label":"Incluir notas operacionales","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de observaciones operacionales.","order":7,"options":[]},{"name":"include_itop_button_footer","label":"Incluir boton iTop","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el boton de acceso a iTop en el footer.","order":8,"options":[]},{"name":"start_date","label":"Fecha desde","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora inicial de ventana. Debe enviarse junto con end_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":9,"options":[]},{"name":"end_date","label":"Fecha hasta","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora final de ventana. Debe enviarse junto con start_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":10,"options":[]}]',
    'system',
    'system'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    webhook_url = VALUES(webhook_url),
    http_method = VALUES(http_method),
    status = VALUES(status),
    display_order = VALUES(display_order),
    icon_name = VALUES(icon_name),
    parameters_json = VALUES(parameters_json),
    updated_by = VALUES(updated_by);

-- 30. CMDB - Activos con garantía vigente - SMTP
INSERT INTO hub_email_reports (
    report_code, name, description, webhook_url, http_method, status,
    display_order, icon_name, logo_url, parameters_json, created_by, updated_by
) VALUES (
    'cmdb_activos_garantia_vigente',
    'CMDB - Activos con garantía vigente - SMTP',
    'Reporte de activos CMDB no obsoletos con garantía vigente a la fecha de referencia. Entrega una vista de cobertura activa para control de parque, soporte y planificación contractual.',
    CONCAT(@n8n_public_base_url, '/webhook/cmdb-activos-garantia-vigente'),
    'POST',
    'active',
    30,
    'database',
    '',
    '[{"name":"email_to","label":"Correo destinatario","type":"email","required":true,"source":"user.email","placeholder":"","defaultValue":"","description":"Destinatario principal del correo. Obligatorio para llamadas webhook.","order":1,"options":[]},{"name":"email_cc","label":"Copia (CC)","type":"text","required":false,"source":"email_cc","placeholder":"","defaultValue":"","description":"Destinatarios en copia separados por coma.","order":2,"options":[]},{"name":"email_bcc","label":"Copia oculta (BCC)","type":"text","required":false,"source":"email_bcc","placeholder":"","defaultValue":"","description":"Destinatarios en copia oculta separados por coma.","order":3,"options":[]},{"name":"include_attachment","label":"Incluir adjunto","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el adjunto CSV.","order":4,"options":[]},{"name":"include_detail","label":"Incluir detalle","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el detalle/tablas del correo.","order":5,"options":[]},{"name":"include_summary","label":"Incluir resumen","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de resumen ejecutivo.","order":6,"options":[]},{"name":"include_operational_notes","label":"Incluir notas operacionales","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de observaciones operacionales.","order":7,"options":[]},{"name":"include_itop_button_footer","label":"Incluir boton iTop","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el boton de acceso a iTop en el footer.","order":8,"options":[]},{"name":"start_date","label":"Fecha desde","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora inicial de ventana. Debe enviarse junto con end_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":9,"options":[]},{"name":"end_date","label":"Fecha hasta","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora final de ventana. Debe enviarse junto con start_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":10,"options":[]},{"name":"reference_date","label":"Fecha de referencia","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha de referencia del reporte. Formato recomendado: YYYY-MM-DD.","order":11,"options":[]}]',
    'system',
    'system'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    webhook_url = VALUES(webhook_url),
    http_method = VALUES(http_method),
    status = VALUES(status),
    display_order = VALUES(display_order),
    icon_name = VALUES(icon_name),
    parameters_json = VALUES(parameters_json),
    updated_by = VALUES(updated_by);

-- 40. CMDB - Activos próximos a vencer garantía - SMTP
INSERT INTO hub_email_reports (
    report_code, name, description, webhook_url, http_method, status,
    display_order, icon_name, logo_url, parameters_json, created_by, updated_by
) VALUES (
    'cmdb_activos_proximos_vencer_garantia',
    'CMDB - Activos próximos a vencer garantía - SMTP',
    'Reporte de activos CMDB cuya garantía vence dentro de la ventana configurada. Permite anticipar renovaciones, reemplazos o validaciones contractuales antes de quedar fuera de cobertura.',
    CONCAT(@n8n_public_base_url, '/webhook/cmdb-activos-proximos-vencer-garantia'),
    'POST',
    'active',
    40,
    'database',
    '',
    '[{"name":"email_to","label":"Correo destinatario","type":"email","required":true,"source":"user.email","placeholder":"","defaultValue":"","description":"Destinatario principal del correo. Obligatorio para llamadas webhook.","order":1,"options":[]},{"name":"email_cc","label":"Copia (CC)","type":"text","required":false,"source":"email_cc","placeholder":"","defaultValue":"","description":"Destinatarios en copia separados por coma.","order":2,"options":[]},{"name":"email_bcc","label":"Copia oculta (BCC)","type":"text","required":false,"source":"email_bcc","placeholder":"","defaultValue":"","description":"Destinatarios en copia oculta separados por coma.","order":3,"options":[]},{"name":"warranty_warning_months","label":"Meses alerta garantia","type":"number","required":true,"source":"","placeholder":"","defaultValue":12,"description":"Cantidad de meses hacia adelante para evaluar garantias proximas a vencer. Debe ser mayor a 0.","order":4,"options":[]},{"name":"include_attachment","label":"Incluir adjunto","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el adjunto CSV.","order":5,"options":[]},{"name":"include_detail","label":"Incluir detalle","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el detalle/tablas del correo.","order":6,"options":[]},{"name":"include_summary","label":"Incluir resumen","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de resumen ejecutivo.","order":7,"options":[]},{"name":"include_operational_notes","label":"Incluir notas operacionales","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de observaciones operacionales.","order":8,"options":[]},{"name":"include_itop_button_footer","label":"Incluir boton iTop","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el boton de acceso a iTop en el footer.","order":9,"options":[]},{"name":"start_date","label":"Fecha desde","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora inicial de ventana. Debe enviarse junto con end_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":10,"options":[]},{"name":"end_date","label":"Fecha hasta","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora final de ventana. Debe enviarse junto con start_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":11,"options":[]}]',
    'system',
    'system'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    webhook_url = VALUES(webhook_url),
    http_method = VALUES(http_method),
    status = VALUES(status),
    display_order = VALUES(display_order),
    icon_name = VALUES(icon_name),
    parameters_json = VALUES(parameters_json),
    updated_by = VALUES(updated_by);

-- 50. CMDB - Activos sin contacto asignado - SMTP
INSERT INTO hub_email_reports (
    report_code, name, description, webhook_url, http_method, status,
    display_order, icon_name, logo_url, parameters_json, created_by, updated_by
) VALUES (
    'cmdb_activos_sin_contacto',
    'CMDB - Activos sin contacto asignado - SMTP',
    'Reporte de activos físicos en estado productivo sin contacto responsable asociado. Ayuda a detectar brechas de trazabilidad, accountability y control administrativo.',
    CONCAT(@n8n_public_base_url, '/webhook/cmdb-activos-sin-contacto'),
    'POST',
    'active',
    50,
    'database',
    '',
    '[{"name":"include_attachment","label":"Incluir adjunto","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el adjunto CSV.","order":1,"options":[]},{"name":"include_detail","label":"Incluir detalle","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el detalle/tablas del correo.","order":2,"options":[]},{"name":"include_summary","label":"Incluir resumen","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de resumen ejecutivo.","order":3,"options":[]},{"name":"email_to","label":"Correo destinatario","type":"email","required":true,"source":"user.email","placeholder":"","defaultValue":"","description":"Destinatario principal del correo. Obligatorio para llamadas webhook.","order":4,"options":[]},{"name":"email_cc","label":"Copia (CC)","type":"text","required":false,"source":"email_cc","placeholder":"","defaultValue":"","description":"Destinatarios en copia separados por coma.","order":5,"options":[]},{"name":"email_bcc","label":"Copia oculta (BCC)","type":"text","required":false,"source":"email_bcc","placeholder":"","defaultValue":"","description":"Destinatarios en copia oculta separados por coma.","order":6,"options":[]},{"name":"include_itop_button_footer","label":"Incluir boton iTop","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el boton de acceso a iTop en el footer.","order":7,"options":[]},{"name":"include_operational_notes","label":"Incluir notas operacionales","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de observaciones operacionales.","order":8,"options":[]}]',
    'system',
    'system'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    webhook_url = VALUES(webhook_url),
    http_method = VALUES(http_method),
    status = VALUES(status),
    display_order = VALUES(display_order),
    icon_name = VALUES(icon_name),
    parameters_json = VALUES(parameters_json),
    updated_by = VALUES(updated_by);

-- 60. CMDB - Inventario de activos con contactos - SMTP
INSERT INTO hub_email_reports (
    report_code, name, description, webhook_url, http_method, status,
    display_order, icon_name, logo_url, parameters_json, created_by, updated_by
) VALUES (
    'cmdb_inventario_activos_contactos',
    'CMDB - Inventario de activos con contactos - SMTP',
    'Reporte de activos CMDB que poseen contacto asignado. Entrega una vista consolidada del inventario trazable, responsables asociados, estado operacional, ubicación y datos relevantes para seguimiento.',
    CONCAT(@n8n_public_base_url, '/webhook/cmdb-inventario-activos-contactos'),
    'POST',
    'active',
    60,
    'database',
    '',
    '[{"name":"email_to","label":"Correo destinatario","type":"email","required":true,"source":"user.email","placeholder":"","defaultValue":"","description":"Destinatario principal del correo. Obligatorio para llamadas webhook.","order":1,"options":[]},{"name":"email_cc","label":"Copia (CC)","type":"text","required":false,"source":"email_cc","placeholder":"","defaultValue":"","description":"Destinatarios en copia separados por coma.","order":2,"options":[]},{"name":"email_bcc","label":"Copia oculta (BCC)","type":"text","required":false,"source":"email_bcc","placeholder":"","defaultValue":"","description":"Destinatarios en copia oculta separados por coma.","order":3,"options":[]},{"name":"include_attachment","label":"Incluir adjunto","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el adjunto CSV.","order":4,"options":[]},{"name":"include_detail","label":"Incluir detalle","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el detalle/tablas del correo.","order":5,"options":[]},{"name":"include_summary","label":"Incluir resumen","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de resumen ejecutivo.","order":6,"options":[]},{"name":"include_operational_notes","label":"Incluir notas operacionales","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de observaciones operacionales.","order":7,"options":[]},{"name":"include_itop_button_footer","label":"Incluir boton iTop","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el boton de acceso a iTop en el footer.","order":8,"options":[]},{"name":"start_date","label":"Fecha desde","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora inicial de ventana. Debe enviarse junto con end_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":9,"options":[]},{"name":"end_date","label":"Fecha hasta","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora final de ventana. Debe enviarse junto con start_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":10,"options":[]}]',
    'system',
    'system'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    webhook_url = VALUES(webhook_url),
    http_method = VALUES(http_method),
    status = VALUES(status),
    display_order = VALUES(display_order),
    icon_name = VALUES(icon_name),
    parameters_json = VALUES(parameters_json),
    updated_by = VALUES(updated_by);

-- 70. CMDB - Movimientos recientes de inventario - SMTP
INSERT INTO hub_email_reports (
    report_code, name, description, webhook_url, http_method, status,
    display_order, icon_name, logo_url, parameters_json, created_by, updated_by
) VALUES (
    'cmdb_movimientos_recientes_inventario',
    'CMDB - Movimientos recientes de inventario - SMTP',
    'Reporte de cambios recientes sobre activos CMDB, incluyendo variaciones de estado, ubicación, bodega o asignación. Permite revisar rotación, traslados y modificaciones relevantes del inventario.',
    CONCAT(@n8n_public_base_url, '/webhook/cmdb-movimientos-recientes-inventario'),
    'POST',
    'active',
    70,
    'database',
    '',
    '[{"name":"email_to","label":"Correo destinatario","type":"email","required":true,"source":"user.email","placeholder":"","defaultValue":"","description":"Destinatario principal del correo. Obligatorio para llamadas webhook.","order":1,"options":[]},{"name":"email_cc","label":"Copia (CC)","type":"text","required":false,"source":"email_cc","placeholder":"","defaultValue":"","description":"Destinatarios en copia separados por coma.","order":2,"options":[]},{"name":"email_bcc","label":"Copia oculta (BCC)","type":"text","required":false,"source":"email_bcc","placeholder":"","defaultValue":"","description":"Destinatarios en copia oculta separados por coma.","order":3,"options":[]},{"name":"movement_days","label":"Dias de movimiento","type":"number","required":false,"source":"","placeholder":"","defaultValue":7,"description":"Cantidad de dias hacia atras para movimientos recientes. Si no se usa, puede reemplazarse por start_date + end_date.","order":4,"options":[]},{"name":"include_attachment","label":"Incluir adjunto","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el adjunto CSV.","order":5,"options":[]},{"name":"include_detail","label":"Incluir detalle","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el detalle/tablas del correo.","order":6,"options":[]},{"name":"include_summary","label":"Incluir resumen","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de resumen ejecutivo.","order":7,"options":[]},{"name":"include_operational_notes","label":"Incluir notas operacionales","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de observaciones operacionales.","order":8,"options":[]},{"name":"include_itop_button_footer","label":"Incluir boton iTop","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el boton de acceso a iTop en el footer.","order":9,"options":[]},{"name":"start_date","label":"Fecha desde","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora inicial de ventana. Debe enviarse junto con end_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":10,"options":[]},{"name":"end_date","label":"Fecha hasta","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora final de ventana. Debe enviarse junto con start_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":11,"options":[]}]',
    'system',
    'system'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    webhook_url = VALUES(webhook_url),
    http_method = VALUES(http_method),
    status = VALUES(status),
    display_order = VALUES(display_order),
    icon_name = VALUES(icon_name),
    parameters_json = VALUES(parameters_json),
    updated_by = VALUES(updated_by);

-- 80. CMDB - Resumen por clase, estado y bodega - SMTP
INSERT INTO hub_email_reports (
    report_code, name, description, webhook_url, http_method, status,
    display_order, icon_name, logo_url, parameters_json, created_by, updated_by
) VALUES (
    'cmdb_resumen_clase_estado_bodega',
    'CMDB - Resumen por clase, estado y bodega - SMTP',
    'Reporte consolidado de activos CMDB agrupados por clase, estado y bodega. Entrega una visión transversal del parque, su distribución física y su condición operacional.',
    CONCAT(@n8n_public_base_url, '/webhook/cmdb-resumen-clase-estado-bodega'),
    'POST',
    'active',
    80,
    'database',
    '',
    '[{"name":"email_to","label":"Correo destinatario","type":"email","required":true,"source":"user.email","placeholder":"","defaultValue":"","description":"Destinatario principal del correo. Obligatorio para llamadas webhook.","order":1,"options":[]},{"name":"email_cc","label":"Copia (CC)","type":"text","required":false,"source":"email_cc","placeholder":"","defaultValue":"","description":"Destinatarios en copia separados por coma.","order":2,"options":[]},{"name":"email_bcc","label":"Copia oculta (BCC)","type":"text","required":false,"source":"email_bcc","placeholder":"","defaultValue":"","description":"Destinatarios en copia oculta separados por coma.","order":3,"options":[]},{"name":"include_attachment","label":"Incluir adjunto","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el adjunto CSV.","order":4,"options":[]},{"name":"include_detail","label":"Incluir detalle","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el detalle/tablas del correo.","order":5,"options":[]},{"name":"include_summary","label":"Incluir resumen","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de resumen ejecutivo.","order":6,"options":[]},{"name":"include_operational_notes","label":"Incluir notas operacionales","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de observaciones operacionales.","order":7,"options":[]},{"name":"include_itop_button_footer","label":"Incluir boton iTop","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el boton de acceso a iTop en el footer.","order":8,"options":[]},{"name":"start_date","label":"Fecha desde","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora inicial de ventana. Debe enviarse junto con end_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":9,"options":[]},{"name":"end_date","label":"Fecha hasta","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora final de ventana. Debe enviarse junto con start_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":10,"options":[]}]',
    'system',
    'system'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    webhook_url = VALUES(webhook_url),
    http_method = VALUES(http_method),
    status = VALUES(status),
    display_order = VALUES(display_order),
    icon_name = VALUES(icon_name),
    parameters_json = VALUES(parameters_json),
    updated_by = VALUES(updated_by);

-- 90. ITSM - Tickets abiertos por agente - SMTP
INSERT INTO hub_email_reports (
    report_code, name, description, webhook_url, http_method, status,
    display_order, icon_name, logo_url, parameters_json, created_by, updated_by
) VALUES (
    'itsm_tickets_abiertos_agente',
    'ITSM - Tickets abiertos por agente - SMTP',
    'Reporte de tickets abiertos agrupados por agente asignado. Permite revisar carga operativa, distribución de trabajo, tickets críticos y posibles concentraciones por responsable.',
    CONCAT(@n8n_public_base_url, '/webhook/itsm-tickets-abiertos-agente'),
    'POST',
    'active',
    90,
    'ticket',
    '',
    '[{"name":"email_cc","label":"Copia (CC)","type":"text","required":false,"source":"email_cc","placeholder":"","defaultValue":"","description":"Destinatarios en copia separados por coma.","order":1,"options":[]},{"name":"email_bcc","label":"Copia oculta (BCC)","type":"text","required":false,"source":"email_bcc","placeholder":"","defaultValue":"","description":"Destinatarios en copia oculta separados por coma.","order":2,"options":[]},{"name":"send_only_with_agent_email","label":"Enviar solo con correo de agente","type":"text","required":false,"source":"","placeholder":"","defaultValue":"true","description":"En reporte por agente, envia solo cuando el agente tiene correo disponible.","order":3,"options":[]},{"name":"fallback_agent_email","label":"Correo de respaldo de agente","type":"email","required":false,"source":"","placeholder":"","defaultValue":"","description":"Correo fallback para reporte por agente cuando send_only_with_agent_email=false.","order":4,"options":[]},{"name":"include_requirements","label":"Incluir requerimientos","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Incluye requerimientos ITSM.","order":5,"options":[]},{"name":"include_incidents","label":"Incluir incidentes","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Incluye incidentes ITSM.","order":6,"options":[]},{"name":"include_changes","label":"Incluir cambios","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Incluye cambios ITSM.","order":7,"options":[]},{"name":"include_problems","label":"Incluir problemas","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Incluye problemas ITSM.","order":8,"options":[]},{"name":"email_to","label":"Correo destinatario","type":"email","required":true,"source":"user.email","placeholder":"","defaultValue":"","description":"Destinatario principal del correo. Obligatorio para llamadas webhook.","order":9,"options":[]},{"name":"include_attachment","label":"Incluir adjunto","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el adjunto CSV.","order":10,"options":[]},{"name":"include_detail","label":"Incluir detalle","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el detalle/tablas del correo.","order":11,"options":[]},{"name":"include_summary","label":"Incluir resumen","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de resumen ejecutivo.","order":12,"options":[]},{"name":"include_operational_notes","label":"Incluir notas operacionales","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de observaciones operacionales.","order":13,"options":[]},{"name":"include_itop_button_footer","label":"Incluir boton iTop","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el boton de acceso a iTop en el footer.","order":14,"options":[]},{"name":"start_date","label":"Fecha desde","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora inicial de ventana. Debe enviarse junto con end_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":15,"options":[]},{"name":"end_date","label":"Fecha hasta","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora final de ventana. Debe enviarse junto con start_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":16,"options":[]}]',
    'system',
    'system'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    webhook_url = VALUES(webhook_url),
    http_method = VALUES(http_method),
    status = VALUES(status),
    display_order = VALUES(display_order),
    icon_name = VALUES(icon_name),
    parameters_json = VALUES(parameters_json),
    updated_by = VALUES(updated_by);

-- 100. ITSM - Tickets abiertos por antigüedad - SMTP
INSERT INTO hub_email_reports (
    report_code, name, description, webhook_url, http_method, status,
    display_order, icon_name, logo_url, parameters_json, created_by, updated_by
) VALUES (
    'itsm_tickets_abiertos_antiguedad',
    'ITSM - Tickets abiertos por antigüedad - SMTP',
    'Reporte de tickets abiertos organizados por antigüedad. Facilita priorizar casos envejecidos, controlar deuda operativa y revisar la salud general del backlog ITSM.',
    CONCAT(@n8n_public_base_url, '/webhook/itsm-tickets-abiertos-antiguedad'),
    'POST',
    'active',
    100,
    'ticket',
    '',
    '[{"name":"email_to","label":"Correo destinatario","type":"email","required":true,"source":"user.email","placeholder":"","defaultValue":"","description":"Destinatario principal del correo. Obligatorio para llamadas webhook.","order":1,"options":[]},{"name":"email_cc","label":"Copia (CC)","type":"text","required":false,"source":"email_cc","placeholder":"","defaultValue":"","description":"Destinatarios en copia separados por coma.","order":2,"options":[]},{"name":"email_bcc","label":"Copia oculta (BCC)","type":"text","required":false,"source":"email_bcc","placeholder":"","defaultValue":"","description":"Destinatarios en copia oculta separados por coma.","order":3,"options":[]},{"name":"include_requirements","label":"Incluir requerimientos","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Incluye requerimientos ITSM.","order":4,"options":[]},{"name":"include_incidents","label":"Incluir incidentes","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Incluye incidentes ITSM.","order":5,"options":[]},{"name":"include_changes","label":"Incluir cambios","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Incluye cambios ITSM.","order":6,"options":[]},{"name":"include_problems","label":"Incluir problemas","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Incluye problemas ITSM.","order":7,"options":[]},{"name":"include_attachment","label":"Incluir adjunto","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el adjunto CSV.","order":8,"options":[]},{"name":"include_detail","label":"Incluir detalle","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el detalle/tablas del correo.","order":9,"options":[]},{"name":"include_summary","label":"Incluir resumen","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de resumen ejecutivo.","order":10,"options":[]},{"name":"include_operational_notes","label":"Incluir notas operacionales","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de observaciones operacionales.","order":11,"options":[]},{"name":"include_itop_button_footer","label":"Incluir boton iTop","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el boton de acceso a iTop en el footer.","order":12,"options":[]},{"name":"start_date","label":"Fecha desde","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora inicial de ventana. Debe enviarse junto con end_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":13,"options":[]},{"name":"end_date","label":"Fecha hasta","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora final de ventana. Debe enviarse junto con start_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":14,"options":[]}]',
    'system',
    'system'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    webhook_url = VALUES(webhook_url),
    http_method = VALUES(http_method),
    status = VALUES(status),
    display_order = VALUES(display_order),
    icon_name = VALUES(icon_name),
    parameters_json = VALUES(parameters_json),
    updated_by = VALUES(updated_by);

-- 110. ITSM - Tickets sin actualización mayor a 24h - SMTP
INSERT INTO hub_email_reports (
    report_code, name, description, webhook_url, http_method, status,
    display_order, icon_name, logo_url, parameters_json, created_by, updated_by
) VALUES (
    'itsm_tickets_sin_actualizacion_24h',
    'ITSM - Tickets sin actualización mayor a 24h - SMTP',
    'Reporte de tickets abiertos que no registran actualización dentro del umbral definido. Permite controlar seguimiento, detectar casos sin avance reciente y reforzar disciplina operacional.',
    CONCAT(@n8n_public_base_url, '/webhook/itsm-tickets-sin-actualizacion-24h'),
    'POST',
    'active',
    110,
    'ticket',
    '',
    '[{"name":"email_to","label":"Correo destinatario","type":"email","required":true,"source":"user.email","placeholder":"","defaultValue":"","description":"Destinatario principal del correo. Obligatorio para llamadas webhook.","order":1,"options":[]},{"name":"email_cc","label":"Copia (CC)","type":"text","required":false,"source":"email_cc","placeholder":"","defaultValue":"","description":"Destinatarios en copia separados por coma.","order":2,"options":[]},{"name":"email_bcc","label":"Copia oculta (BCC)","type":"text","required":false,"source":"email_bcc","placeholder":"","defaultValue":"","description":"Destinatarios en copia oculta separados por coma.","order":3,"options":[]},{"name":"stale_threshold_hours","label":"Horas sin actualizacion","type":"number","required":true,"source":"","placeholder":"","defaultValue":24,"description":"Umbral de horas sin actualizacion para tickets. Debe ser mayor a 0.","order":4,"options":[]},{"name":"include_requirements","label":"Incluir requerimientos","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Incluye requerimientos ITSM.","order":5,"options":[]},{"name":"include_incidents","label":"Incluir incidentes","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Incluye incidentes ITSM.","order":6,"options":[]},{"name":"include_changes","label":"Incluir cambios","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Incluye cambios ITSM.","order":7,"options":[]},{"name":"include_problems","label":"Incluir problemas","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Incluye problemas ITSM.","order":8,"options":[]},{"name":"include_attachment","label":"Incluir adjunto","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el adjunto CSV.","order":9,"options":[]},{"name":"include_detail","label":"Incluir detalle","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el detalle/tablas del correo.","order":10,"options":[]},{"name":"include_summary","label":"Incluir resumen","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de resumen ejecutivo.","order":11,"options":[]},{"name":"include_operational_notes","label":"Incluir notas operacionales","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el bloque de observaciones operacionales.","order":12,"options":[]},{"name":"include_itop_button_footer","label":"Incluir boton iTop","type":"boolean","required":false,"source":"","placeholder":"","defaultValue":true,"description":"Activa o desactiva el boton de acceso a iTop en el footer.","order":13,"options":[]},{"name":"start_date","label":"Fecha desde","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora inicial de ventana. Debe enviarse junto con end_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":14,"options":[]},{"name":"end_date","label":"Fecha hasta","type":"date","required":false,"source":"","placeholder":"","defaultValue":"","description":"Fecha/hora final de ventana. Debe enviarse junto con start_date. Formato recomendado: YYYY-MM-DD HH:mm:ss.","order":15,"options":[]}]',
    'system',
    'system'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    webhook_url = VALUES(webhook_url),
    http_method = VALUES(http_method),
    status = VALUES(status),
    display_order = VALUES(display_order),
    icon_name = VALUES(icon_name),
    parameters_json = VALUES(parameters_json),
    updated_by = VALUES(updated_by);

COMMIT;

