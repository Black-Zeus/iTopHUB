CREATE TABLE IF NOT EXISTS hub_settings_panels (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    panel_code VARCHAR(50) NOT NULL,
    config_json LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_settings_panels_code (panel_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hub_sync_tasks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    schedule_expression VARCHAR(120) NOT NULL,
    description VARCHAR(255) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    command_source VARCHAR(20) NOT NULL DEFAULT 'preset',
    command_value VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_hub_sync_tasks_command_source CHECK (command_source IN ('preset', 'manual'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
