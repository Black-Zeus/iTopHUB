-- Report definitions catalog: one row per logical report
CREATE TABLE IF NOT EXISTS hub_report_definitions (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_code     VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    category        VARCHAR(100),
    type            ENUM('base', 'custom') NOT NULL DEFAULT 'base',
    status          ENUM('active', 'inactive', 'deprecated', 'archived') NOT NULL DEFAULT 'active',
    current_version INT UNSIGNED NOT NULL DEFAULT 1,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_report_code (report_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Each version stores the complete declarative JSON for the report.
-- MariaDB JSON type validates structure at write time (equivalent to PostgreSQL JSONB
-- for this use case: the app runs on MariaDB, not PostgreSQL).
CREATE TABLE IF NOT EXISTS hub_report_definition_versions (
    id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_definition_id INT UNSIGNED NOT NULL,
    version              INT UNSIGNED NOT NULL,
    status               ENUM('draft', 'active', 'deprecated', 'archived', 'rollback') NOT NULL DEFAULT 'draft',
    definition_json      JSON NOT NULL,
    change_reason        TEXT,
    created_by           VARCHAR(100),
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activated_at         DATETIME,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_report_version (report_definition_id, version),
    CONSTRAINT fk_rdv_report_def FOREIGN KEY (report_definition_id)
        REFERENCES hub_report_definitions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
