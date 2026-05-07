CREATE TABLE IF NOT EXISTS hub_email_reports (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_code     VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    webhook_url     TEXT NOT NULL,
    http_method     ENUM('GET', 'POST') NOT NULL DEFAULT 'POST',
    status          ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    display_order   INT NOT NULL DEFAULT 100,
    icon_name       VARCHAR(80) NOT NULL DEFAULT 'mail',
    logo_url        TEXT,
    parameters_json JSON,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_email_reports_code (report_code),
    KEY idx_hub_email_reports_status_order (status, display_order, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO hub_role_modules (role_id, module_code, can_view, can_write)
SELECT r.id, seed.module_code, seed.can_view, seed.can_write
FROM hub_roles r
JOIN (
    SELECT 'administrator' AS role_code, 'email_reports' AS module_code, 1 AS can_view, 1 AS can_write
    UNION ALL SELECT 'support_general', 'email_reports', 1, 0
    UNION ALL SELECT 'support_lab', 'email_reports', 1, 0
    UNION ALL SELECT 'support_field', 'email_reports', 1, 0
    UNION ALL SELECT 'viewer', 'email_reports', 1, 0
) seed ON seed.role_code = r.code
ON DUPLICATE KEY UPDATE
    can_view = VALUES(can_view),
    can_write = VALUES(can_write);
