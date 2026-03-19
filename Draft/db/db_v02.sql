-- =========================================================
-- iTop Hub - DDL v02
-- Motor objetivo: MySQL / MariaDB
-- Enfoque:
--   - iTop como Source of Truth externa
--   - Hub con BD local mínima + snapshots
--   - 3FN en núcleo transaccional
--   - configuración persistente para backend
--   - sin histórico técnico de sincronización
-- =========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================
-- DROP EN ORDEN INVERSO
-- =========================================================

DROP TABLE IF EXISTS asset_movements;
DROP TABLE IF EXISTS inconsistency_history;
DROP TABLE IF EXISTS document_history;
DROP TABLE IF EXISTS act_history;
DROP TABLE IF EXISTS inconsistency_details;
DROP TABLE IF EXISTS inconsistencies;
DROP TABLE IF EXISTS act_evidences;
DROP TABLE IF EXISTS checklist_run_answers;
DROP TABLE IF EXISTS checklist_runs;
DROP TABLE IF EXISTS checklist_template_items;
DROP TABLE IF EXISTS checklist_templates;
DROP TABLE IF EXISTS act_items;
DROP TABLE IF EXISTS act_lab;
DROP TABLE IF EXISTS act_reassignment;
DROP TABLE IF EXISTS act_return;
DROP TABLE IF EXISTS act_delivery;
DROP TABLE IF EXISTS acts;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS sync_setting_params;
DROP TABLE IF EXISTS sync_settings;
DROP TABLE IF EXISTS cmdb_settings;
DROP TABLE IF EXISTS mail_settings;
DROP TABLE IF EXISTS document_settings;
DROP TABLE IF EXISTS integration_settings;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS system_users;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS asset_models;
DROP TABLE IF EXISTS asset_brands;
DROP TABLE IF EXISTS asset_classes;
DROP TABLE IF EXISTS locations;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================
-- 0) CATALOGOS GENERALES
-- =========================================================

CREATE TABLE locations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parent_location_id BIGINT UNSIGNED NULL,
    name VARCHAR(150) NOT NULL,
    location_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_locations_parent_location_id (parent_location_id),
    KEY ix_locations_name (name),
    KEY ix_locations_type (location_type),
    KEY ix_locations_status (status),
    CONSTRAINT fk_locations_parent
        FOREIGN KEY (parent_location_id) REFERENCES locations(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE asset_classes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    class_key VARCHAR(80) NOT NULL,
    cmdb_class_name VARCHAR(150) NOT NULL,
    functional_name VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_classes_class_key (class_key),
    KEY ix_asset_classes_cmdb_class_name (cmdb_class_name),
    KEY ix_asset_classes_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE asset_brands (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_brands_name (name),
    KEY ix_asset_brands_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE asset_models (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    brand_id BIGINT UNSIGNED NOT NULL,
    asset_class_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    is_standard_model TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_models_brand_class_name (brand_id, asset_class_id, name),
    KEY ix_asset_models_asset_class_id (asset_class_id),
    KEY ix_asset_models_status (status),
    CONSTRAINT fk_asset_models_brand
        FOREIGN KEY (brand_id) REFERENCES asset_brands(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_asset_models_asset_class
        FOREIGN KEY (asset_class_id) REFERENCES asset_classes(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 1) CACHE LOCAL DESDE ITOP
-- =========================================================

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    external_ref VARCHAR(120) NOT NULL,
    source_system VARCHAR(30) NOT NULL DEFAULT 'itop',
    full_name VARCHAR(180) NOT NULL,
    identifier VARCHAR(120) NULL,
    email VARCHAR(180) NULL,
    area VARCHAR(150) NULL,
    role_name VARCHAR(150) NULL,
    manager_name VARCHAR(180) NULL,
    location_id BIGINT UNSIGNED NULL,
    person_status VARCHAR(30) NOT NULL DEFAULT 'active',
    last_synced_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_external_ref (external_ref),
    KEY ix_users_full_name (full_name),
    KEY ix_users_email (email),
    KEY ix_users_identifier (identifier),
    KEY ix_users_location_id (location_id),
    KEY ix_users_person_status (person_status),
    CONSTRAINT fk_users_location
        FOREIGN KEY (location_id) REFERENCES locations(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE system_users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(80) NOT NULL,
    full_name VARCHAR(180) NOT NULL,
    email VARCHAR(180) NULL,
    role_code VARCHAR(60) NOT NULL,
    user_status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_system_users_username (username),
    KEY ix_system_users_email (email),
    KEY ix_system_users_role_code (role_code),
    KEY ix_system_users_status (user_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE assets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    external_cmdb_id VARCHAR(120) NOT NULL,
    source_system VARCHAR(30) NOT NULL DEFAULT 'itop',

    code VARCHAR(80) NOT NULL,
    hostname VARCHAR(120) NULL,
    name VARCHAR(180) NOT NULL,

    asset_class_id BIGINT UNSIGNED NOT NULL,
    type_label VARCHAR(120) NULL,
    brand_id BIGINT UNSIGNED NULL,
    model_id BIGINT UNSIGNED NULL,

    serial_number VARCHAR(150) NULL,
    inventory_code VARCHAR(120) NULL,

    current_user_id BIGINT UNSIGNED NULL,
    current_location_id BIGINT UNSIGNED NULL,

    operational_status VARCHAR(50) NOT NULL,
    cmdb_status VARCHAR(50) NOT NULL,

    observations TEXT NULL,
    onboarding_date DATE NULL,
    last_synced_at DATETIME NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_assets_external_cmdb_id (external_cmdb_id),
    KEY ix_assets_code (code),
    KEY ix_assets_hostname (hostname),
    KEY ix_assets_name (name),
    KEY ix_assets_serial_number (serial_number),
    KEY ix_assets_inventory_code (inventory_code),
    KEY ix_assets_asset_class_id (asset_class_id),
    KEY ix_assets_brand_id (brand_id),
    KEY ix_assets_model_id (model_id),
    KEY ix_assets_current_user_id (current_user_id),
    KEY ix_assets_current_location_id (current_location_id),
    KEY ix_assets_cmdb_status (cmdb_status),
    KEY ix_assets_operational_status (operational_status),

    CONSTRAINT fk_assets_asset_class
        FOREIGN KEY (asset_class_id) REFERENCES asset_classes(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_assets_brand
        FOREIGN KEY (brand_id) REFERENCES asset_brands(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_assets_model
        FOREIGN KEY (model_id) REFERENCES asset_models(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_assets_current_user
        FOREIGN KEY (current_user_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_assets_current_location
        FOREIGN KEY (current_location_id) REFERENCES locations(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 2) CONFIGURACION / PARAMETROS
-- =========================================================

CREATE TABLE app_settings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    group_key VARCHAR(80) NOT NULL,
    setting_key VARCHAR(120) NOT NULL,
    setting_value TEXT NULL,
    value_type VARCHAR(40) NOT NULL DEFAULT 'string',
    is_sensitive TINYINT(1) NOT NULL DEFAULT 0,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_app_settings_group_setting (group_key, setting_key),
    KEY ix_app_settings_group_key (group_key),
    CONSTRAINT fk_app_settings_updated_by
        FOREIGN KEY (updated_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integration_settings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    group_key VARCHAR(80) NOT NULL,
    setting_key VARCHAR(120) NOT NULL,
    setting_value TEXT NULL,
    value_type VARCHAR(40) NOT NULL DEFAULT 'string',
    is_sensitive TINYINT(1) NOT NULL DEFAULT 0,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_integration_settings_group_setting (group_key, setting_key),
    KEY ix_integration_settings_group_key (group_key),
    CONSTRAINT fk_integration_settings_updated_by
        FOREIGN KEY (updated_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE document_settings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    delivery_prefix VARCHAR(20) NOT NULL DEFAULT 'ENT',
    return_prefix VARCHAR(20) NOT NULL DEFAULT 'DEV',
    reassignment_prefix VARCHAR(20) NOT NULL DEFAULT 'REA',
    lab_prefix VARCHAR(20) NOT NULL DEFAULT 'LAB',
    number_format VARCHAR(80) NOT NULL DEFAULT '{PREFIX}-{YYYY}-{SEQ}',
    sequence_padding INT UNSIGNED NOT NULL DEFAULT 6,
    reset_mode VARCHAR(20) NOT NULL DEFAULT 'yearly',
    default_observation TEXT NULL,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_document_settings_updated_by
        FOREIGN KEY (updated_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mail_settings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    display_sender_name VARCHAR(180) NOT NULL,
    sender_email VARCHAR(180) NOT NULL,
    smtp_host VARCHAR(180) NOT NULL,
    smtp_port INT NOT NULL,
    smtp_user VARCHAR(180) NULL,
    smtp_secret_ref VARCHAR(180) NULL,
    security_mode VARCHAR(20) NOT NULL DEFAULT 'tls',
    footer_text TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_mail_settings_updated_by
        FOREIGN KEY (updated_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cmdb_settings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider VARCHAR(50) NOT NULL DEFAULT 'itop',
    base_url VARCHAR(255) NOT NULL,
    api_version VARCHAR(30) NULL,
    auth_type VARCHAR(30) NOT NULL DEFAULT 'basic',
    username VARCHAR(180) NULL,
    secret_ref VARCHAR(180) NULL,
    api_token_ref VARCHAR(180) NULL,
    verify_ssl TINYINT(1) NOT NULL DEFAULT 1,
    request_timeout_seconds INT UNSIGNED NOT NULL DEFAULT 30,
    asset_lookup_enabled TINYINT(1) NOT NULL DEFAULT 1,
    user_lookup_enabled TINYINT(1) NOT NULL DEFAULT 1,
    cache_assets_enabled TINYINT(1) NOT NULL DEFAULT 1,
    cache_users_enabled TINYINT(1) NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_cmdb_settings_updated_by
        FOREIGN KEY (updated_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sync_settings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(255) NULL,
    module_code VARCHAR(50) NOT NULL,
    schedule_mode VARCHAR(20) NOT NULL DEFAULT 'manual',
    cron_expression VARCHAR(100) NULL,
    interval_seconds INT UNSIGNED NULL,
    timezone VARCHAR(100) NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    allow_manual_run TINYINT(1) NOT NULL DEFAULT 1,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sync_settings_code (code),
    KEY ix_sync_settings_module_code (module_code),
    KEY ix_sync_settings_is_enabled (is_enabled),
    CONSTRAINT fk_sync_settings_updated_by
        FOREIGN KEY (updated_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sync_setting_params (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sync_setting_id BIGINT UNSIGNED NOT NULL,
    param_key VARCHAR(120) NOT NULL,
    param_value TEXT NULL,
    value_type VARCHAR(40) NOT NULL DEFAULT 'string',
    is_sensitive TINYINT(1) NOT NULL DEFAULT 0,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sync_setting_params_sync_key (sync_setting_id, param_key),
    KEY ix_sync_setting_params_sync_setting_id (sync_setting_id),
    CONSTRAINT fk_sync_setting_params_sync_setting
        FOREIGN KEY (sync_setting_id) REFERENCES sync_settings(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_sync_setting_params_updated_by
        FOREIGN KEY (updated_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 3) ARCHIVOS REFERENCIADOS
-- =========================================================

CREATE TABLE files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    storage_provider VARCHAR(30) NOT NULL DEFAULT 'local',
    storage_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    extension VARCHAR(20) NULL,
    size_bytes BIGINT UNSIGNED NULL,
    checksum VARCHAR(128) NULL,
    file_kind VARCHAR(30) NOT NULL,
    uploaded_by BIGINT UNSIGNED NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    PRIMARY KEY (id),
    KEY ix_files_file_kind (file_kind),
    KEY ix_files_status (status),
    KEY ix_files_checksum (checksum),
    KEY ix_files_uploaded_by (uploaded_by),
    CONSTRAINT fk_files_uploaded_by
        FOREIGN KEY (uploaded_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 4) ACTAS (CABECERA / PROCESO)
-- =========================================================

CREATE TABLE acts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    folio VARCHAR(50) NOT NULL,
    act_type VARCHAR(30) NOT NULL,
    act_status VARCHAR(30) NOT NULL DEFAULT 'draft',

    elaborator_system_user_id BIGINT UNSIGNED NOT NULL,
    recipient_user_id BIGINT UNSIGNED NULL,
    principal_asset_id BIGINT UNSIGNED NULL,

    -- snapshot usuario principal (cabecera)
    snapshot_recipient_name VARCHAR(180) NULL,
    snapshot_recipient_email VARCHAR(180) NULL,
    snapshot_recipient_area VARCHAR(150) NULL,
    snapshot_recipient_role VARCHAR(150) NULL,
    snapshot_recipient_location VARCHAR(150) NULL,

    -- snapshot activo principal (cabecera / consulta rápida)
    snapshot_asset_code VARCHAR(80) NULL,
    snapshot_asset_name VARCHAR(180) NULL,
    snapshot_asset_type VARCHAR(120) NULL,
    snapshot_asset_brand VARCHAR(120) NULL,
    snapshot_asset_model VARCHAR(150) NULL,
    snapshot_asset_serial VARCHAR(150) NULL,
    snapshot_asset_inventory_code VARCHAR(120) NULL,
    snapshot_asset_location VARCHAR(150) NULL,
    snapshot_asset_status VARCHAR(50) NULL,
    snapshot_asset_cmdb_status VARCHAR(50) NULL,

    main_document_file_id BIGINT UNSIGNED NULL,

    document_status VARCHAR(30) NOT NULL DEFAULT 'pending_generation',
    publication_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    signature_method VARCHAR(30) NULL,
    origin_channel VARCHAR(30) NOT NULL DEFAULT 'web',

    has_open_inconsistencies TINYINT(1) NOT NULL DEFAULT 0,
    has_evidences TINYINT(1) NOT NULL DEFAULT 0,
    is_finalized TINYINT(1) NOT NULL DEFAULT 0,

    reason TEXT NULL,
    notes TEXT NULL,

    prepared_at DATETIME NULL,
    pending_signature_at DATETIME NULL,
    signed_at DATETIME NULL,
    published_at DATETIME NULL,
    finalized_at DATETIME NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_acts_folio (folio),

    KEY ix_acts_act_type (act_type),
    KEY ix_acts_act_status (act_status),
    KEY ix_acts_document_status (document_status),
    KEY ix_acts_publication_status (publication_status),
    KEY ix_acts_recipient_user_id (recipient_user_id),
    KEY ix_acts_principal_asset_id (principal_asset_id),
    KEY ix_acts_elaborator_system_user_id (elaborator_system_user_id),
    KEY ix_acts_created_at (created_at),

    CONSTRAINT fk_acts_elaborator
        FOREIGN KEY (elaborator_system_user_id) REFERENCES system_users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_acts_recipient
        FOREIGN KEY (recipient_user_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_acts_principal_asset
        FOREIGN KEY (principal_asset_id) REFERENCES assets(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_acts_main_document_file
        FOREIGN KEY (main_document_file_id) REFERENCES files(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 5) DETALLE ESPECIALIZADO POR TIPO DE ACTA
-- =========================================================

CREATE TABLE act_delivery (
    act_id BIGINT UNSIGNED NOT NULL,
    delivery_mode VARCHAR(30) NOT NULL DEFAULT 'assignment',
    source_location_id BIGINT UNSIGNED NULL,
    destination_location_id BIGINT UNSIGNED NULL,
    delivery_reason TEXT NULL,
    PRIMARY KEY (act_id),
    KEY ix_act_delivery_source_location_id (source_location_id),
    KEY ix_act_delivery_destination_location_id (destination_location_id),
    CONSTRAINT fk_act_delivery_act
        FOREIGN KEY (act_id) REFERENCES acts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_delivery_source_location
        FOREIGN KEY (source_location_id) REFERENCES locations(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_delivery_destination_location
        FOREIGN KEY (destination_location_id) REFERENCES locations(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE act_return (
    act_id BIGINT UNSIGNED NOT NULL,
    return_to_location_id BIGINT UNSIGNED NULL,
    return_reason TEXT NULL,
    requires_review TINYINT(1) NOT NULL DEFAULT 0,
    requires_lab TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (act_id),
    KEY ix_act_return_return_to_location_id (return_to_location_id),
    CONSTRAINT fk_act_return_act
        FOREIGN KEY (act_id) REFERENCES acts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_return_return_to_location
        FOREIGN KEY (return_to_location_id) REFERENCES locations(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE act_reassignment (
    act_id BIGINT UNSIGNED NOT NULL,
    origin_user_id BIGINT UNSIGNED NOT NULL,
    destination_user_id BIGINT UNSIGNED NOT NULL,
    reassignment_reason TEXT NULL,
    PRIMARY KEY (act_id),
    KEY ix_act_reassignment_origin_user_id (origin_user_id),
    KEY ix_act_reassignment_destination_user_id (destination_user_id),
    CONSTRAINT fk_act_reassignment_act
        FOREIGN KEY (act_id) REFERENCES acts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_reassignment_origin_user
        FOREIGN KEY (origin_user_id) REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_reassignment_destination_user
        FOREIGN KEY (destination_user_id) REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE act_lab (
    act_id BIGINT UNSIGNED NOT NULL,
    received_from_location_id BIGINT UNSIGNED NULL,
    assigned_technician_id BIGINT UNSIGNED NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    lab_status VARCHAR(30) NOT NULL DEFAULT 'open',
    technical_description TEXT NULL,
    technical_result TEXT NULL,
    diagnosis_summary TEXT NULL,
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME NULL,
    PRIMARY KEY (act_id),
    KEY ix_act_lab_received_from_location_id (received_from_location_id),
    KEY ix_act_lab_assigned_technician_id (assigned_technician_id),
    KEY ix_act_lab_priority (priority),
    KEY ix_act_lab_status (lab_status),
    CONSTRAINT fk_act_lab_act
        FOREIGN KEY (act_id) REFERENCES acts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_lab_received_from_location
        FOREIGN KEY (received_from_location_id) REFERENCES locations(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_lab_assigned_technician
        FOREIGN KEY (assigned_technician_id) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 6) ITEMS DE ACTA (UNIFICADOS)
-- =========================================================

CREATE TABLE act_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    act_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    item_type VARCHAR(30) NOT NULL,

    snapshot_asset_code VARCHAR(80) NOT NULL,
    snapshot_asset_name VARCHAR(180) NOT NULL,
    snapshot_asset_type VARCHAR(120) NULL,
    snapshot_asset_brand VARCHAR(120) NULL,
    snapshot_asset_model VARCHAR(150) NULL,
    snapshot_asset_serial VARCHAR(150) NULL,
    snapshot_asset_inventory_code VARCHAR(120) NULL,
    snapshot_asset_location VARCHAR(150) NULL,
    snapshot_asset_status VARCHAR(50) NULL,
    snapshot_asset_cmdb_status VARCHAR(50) NULL,

    item_notes TEXT NULL,
    item_observation TEXT NULL,
    sort_order INT NOT NULL DEFAULT 1,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_act_items_act_asset (act_id, asset_id),
    KEY ix_act_items_act_id (act_id),
    KEY ix_act_items_asset_id (asset_id),
    KEY ix_act_items_item_type (item_type),
    KEY ix_act_items_sort_order (sort_order),

    CONSTRAINT fk_act_items_act
        FOREIGN KEY (act_id) REFERENCES acts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_items_asset
        FOREIGN KEY (asset_id) REFERENCES assets(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 7) CHECKLIST
-- =========================================================

CREATE TABLE checklist_templates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(180) NOT NULL,
    module_context VARCHAR(30) NOT NULL,
    applies_to_level VARCHAR(20) NOT NULL,
    asset_class_id BIGINT UNSIGNED NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    description TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_checklist_templates_code (code),
    KEY ix_checklist_templates_module_context (module_context),
    KEY ix_checklist_templates_applies_to_level (applies_to_level),
    KEY ix_checklist_templates_asset_class_id (asset_class_id),
    CONSTRAINT fk_checklist_templates_asset_class
        FOREIGN KEY (asset_class_id) REFERENCES asset_classes(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE checklist_template_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    template_id BIGINT UNSIGNED NOT NULL,
    order_index INT NOT NULL,
    item_name VARCHAR(180) NOT NULL,
    item_description TEXT NULL,
    input_type VARCHAR(30) NOT NULL,
    option_a VARCHAR(150) NULL,
    option_b VARCHAR(150) NULL,
    is_required TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_checklist_template_items_template_order (template_id, order_index),
    KEY ix_checklist_template_items_template_id (template_id),
    CONSTRAINT fk_checklist_template_items_template
        FOREIGN KEY (template_id) REFERENCES checklist_templates(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE checklist_runs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    template_id BIGINT UNSIGNED NOT NULL,
    module_context VARCHAR(30) NOT NULL,
    applies_to_level VARCHAR(20) NOT NULL,
    act_id BIGINT UNSIGNED NOT NULL,
    act_item_id BIGINT UNSIGNED NULL,
    executed_by BIGINT UNSIGNED NULL,
    executed_at DATETIME NULL,
    run_status VARCHAR(30) NOT NULL DEFAULT 'draft',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY ix_checklist_runs_template_id (template_id),
    KEY ix_checklist_runs_act_id (act_id),
    KEY ix_checklist_runs_act_item_id (act_item_id),
    KEY ix_checklist_runs_status (run_status),

    CONSTRAINT fk_checklist_runs_template
        FOREIGN KEY (template_id) REFERENCES checklist_templates(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_checklist_runs_act
        FOREIGN KEY (act_id) REFERENCES acts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_checklist_runs_act_item
        FOREIGN KEY (act_item_id) REFERENCES act_items(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_checklist_runs_executed_by
        FOREIGN KEY (executed_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE checklist_run_answers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    checklist_run_id BIGINT UNSIGNED NOT NULL,
    template_item_id BIGINT UNSIGNED NOT NULL,
    answer_text TEXT NULL,
    answer_boolean TINYINT(1) NULL,
    answer_option VARCHAR(150) NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_checklist_run_answers_run_item (checklist_run_id, template_item_id),
    KEY ix_checklist_run_answers_template_item_id (template_item_id),

    CONSTRAINT fk_checklist_run_answers_run
        FOREIGN KEY (checklist_run_id) REFERENCES checklist_runs(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_checklist_run_answers_template_item
        FOREIGN KEY (template_item_id) REFERENCES checklist_template_items(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 8) EVIDENCIAS
-- =========================================================

CREATE TABLE act_evidences (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    act_id BIGINT UNSIGNED NOT NULL,
    file_id BIGINT UNSIGNED NOT NULL,
    evidence_type VARCHAR(30) NOT NULL DEFAULT 'image',
    title VARCHAR(180) NULL,
    notes TEXT NULL,
    order_index INT NOT NULL DEFAULT 1,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_act_evidences_act_id (act_id),
    KEY ix_act_evidences_file_id (file_id),
    KEY ix_act_evidences_order_index (order_index),
    CONSTRAINT fk_act_evidences_act
        FOREIGN KEY (act_id) REFERENCES acts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_evidences_file
        FOREIGN KEY (file_id) REFERENCES files(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_evidences_created_by
        FOREIGN KEY (created_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 9) INCONSISTENCIAS
-- =========================================================

CREATE TABLE inconsistencies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    act_id BIGINT UNSIGNED NOT NULL,
    act_item_id BIGINT UNSIGNED NULL,
    inconsistency_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    summary VARCHAR(255) NOT NULL,
    detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detected_by BIGINT UNSIGNED NULL,
    resolved_at DATETIME NULL,
    resolved_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_inconsistencies_act_id (act_id),
    KEY ix_inconsistencies_act_item_id (act_item_id),
    KEY ix_inconsistencies_status (status),
    KEY ix_inconsistencies_type (inconsistency_type),
    KEY ix_inconsistencies_severity (severity),
    CONSTRAINT fk_inconsistencies_act
        FOREIGN KEY (act_id) REFERENCES acts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_inconsistencies_act_item
        FOREIGN KEY (act_item_id) REFERENCES act_items(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_inconsistencies_detected_by
        FOREIGN KEY (detected_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_inconsistencies_resolved_by
        FOREIGN KEY (resolved_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inconsistency_details (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    inconsistency_id BIGINT UNSIGNED NOT NULL,
    reference_table VARCHAR(80) NULL,
    reference_id BIGINT UNSIGNED NULL,
    expected_value TEXT NULL,
    actual_value TEXT NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_inconsistency_details_inconsistency_id (inconsistency_id),
    CONSTRAINT fk_inconsistency_details_inconsistency
        FOREIGN KEY (inconsistency_id) REFERENCES inconsistencies(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 10) HISTORIALES
-- =========================================================

CREATE TABLE act_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    act_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    previous_status VARCHAR(30) NULL,
    next_status VARCHAR(30) NULL,
    notes TEXT NULL,
    performed_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_act_history_act_id (act_id),
    KEY ix_act_history_event_type (event_type),
    CONSTRAINT fk_act_history_act
        FOREIGN KEY (act_id) REFERENCES acts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_history_performed_by
        FOREIGN KEY (performed_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE document_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    act_id BIGINT UNSIGNED NOT NULL,
    previous_document_status VARCHAR(30) NULL,
    next_document_status VARCHAR(30) NULL,
    file_id BIGINT UNSIGNED NULL,
    notes TEXT NULL,
    performed_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_document_history_act_id (act_id),
    KEY ix_document_history_next_document_status (next_document_status),
    CONSTRAINT fk_document_history_act
        FOREIGN KEY (act_id) REFERENCES acts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_document_history_file
        FOREIGN KEY (file_id) REFERENCES files(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_document_history_performed_by
        FOREIGN KEY (performed_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inconsistency_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    inconsistency_id BIGINT UNSIGNED NOT NULL,
    previous_status VARCHAR(30) NULL,
    next_status VARCHAR(30) NULL,
    notes TEXT NULL,
    performed_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_inconsistency_history_inconsistency_id (inconsistency_id),
    KEY ix_inconsistency_history_next_status (next_status),
    CONSTRAINT fk_inconsistency_history_inconsistency
        FOREIGN KEY (inconsistency_id) REFERENCES inconsistencies(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_inconsistency_history_performed_by
        FOREIGN KEY (performed_by) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 11) MOVIMIENTOS DE ACTIVOS
-- =========================================================

CREATE TABLE asset_movements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    asset_id BIGINT UNSIGNED NOT NULL,
    act_id BIGINT UNSIGNED NULL,
    act_item_id BIGINT UNSIGNED NULL,

    movement_type VARCHAR(50) NOT NULL,
    movement_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    from_user_id BIGINT UNSIGNED NULL,
    to_user_id BIGINT UNSIGNED NULL,

    from_location_id BIGINT UNSIGNED NULL,
    to_location_id BIGINT UNSIGNED NULL,

    previous_status VARCHAR(50) NULL,
    next_status VARCHAR(50) NULL,

    operator_user_id BIGINT UNSIGNED NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY ix_asset_movements_asset_id (asset_id),
    KEY ix_asset_movements_act_id (act_id),
    KEY ix_asset_movements_act_item_id (act_item_id),
    KEY ix_asset_movements_movement_type (movement_type),
    KEY ix_asset_movements_movement_date (movement_date),
    KEY ix_asset_movements_from_user_id (from_user_id),
    KEY ix_asset_movements_to_user_id (to_user_id),
    KEY ix_asset_movements_from_location_id (from_location_id),
    KEY ix_asset_movements_to_location_id (to_location_id),

    CONSTRAINT fk_asset_movements_asset
        FOREIGN KEY (asset_id) REFERENCES assets(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_asset_movements_act
        FOREIGN KEY (act_id) REFERENCES acts(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_asset_movements_act_item
        FOREIGN KEY (act_item_id) REFERENCES act_items(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_asset_movements_from_user
        FOREIGN KEY (from_user_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_asset_movements_to_user
        FOREIGN KEY (to_user_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_asset_movements_from_location
        FOREIGN KEY (from_location_id) REFERENCES locations(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_asset_movements_to_location
        FOREIGN KEY (to_location_id) REFERENCES locations(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_asset_movements_operator
        FOREIGN KEY (operator_user_id) REFERENCES system_users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
