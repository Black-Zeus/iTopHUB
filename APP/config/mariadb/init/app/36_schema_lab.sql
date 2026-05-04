-- Modulo de laboratorio: actas con fase de entrada y salida
CREATE TABLE IF NOT EXISTS hub_lab_records (
    id                      INT NOT NULL AUTO_INCREMENT,
    document_number         VARCHAR(30)  NOT NULL,

    reason                  VARCHAR(50)  NOT NULL DEFAULT 'maintenance',
    requested_actions       JSON         DEFAULT NULL,
    status                  VARCHAR(30)  NOT NULL DEFAULT 'draft',

    -- Activo CMDB (un solo activo por acta)
    asset_itop_id           VARCHAR(50)  DEFAULT NULL,
    asset_code              VARCHAR(100) DEFAULT NULL,
    asset_name              VARCHAR(255) DEFAULT NULL,
    asset_class             VARCHAR(100) DEFAULT NULL,
    asset_serial            VARCHAR(100) DEFAULT NULL,
    asset_organization      VARCHAR(255) DEFAULT NULL,
    asset_location          VARCHAR(255) DEFAULT NULL,
    asset_status            VARCHAR(100) DEFAULT NULL,
    asset_assigned_user     VARCHAR(255) DEFAULT NULL,

    -- Especialista
    owner_user_id           INT          DEFAULT NULL,
    owner_name              VARCHAR(255) DEFAULT NULL,
    requester_admin_user_id INT          DEFAULT NULL,
    requester_admin_name    VARCHAR(255) DEFAULT NULL,
    requester_admin_itop_person_key VARCHAR(50) DEFAULT NULL,

    -- Fase de entrada
    entry_date              DATE         DEFAULT NULL,
    entry_observations      TEXT         DEFAULT NULL,
    entry_condition_notes   TEXT         DEFAULT NULL,
    entry_received_notes    TEXT         DEFAULT NULL,
    entry_evidences         JSON         DEFAULT NULL,
    entry_generated_document JSON        DEFAULT NULL,

    -- Fase de procesamiento
    processing_date              DATE         DEFAULT NULL,
    processing_observations      TEXT         DEFAULT NULL,
    processing_evidences         JSON         DEFAULT NULL,
    processing_generated_document JSON        DEFAULT NULL,
    processing_checklists        JSON         DEFAULT NULL,

    -- Fase de salida
    exit_date               DATE         DEFAULT NULL,
    exit_observations       TEXT         DEFAULT NULL,
    work_performed          TEXT         DEFAULT NULL,
    exit_evidences          JSON         DEFAULT NULL,
    exit_generated_document JSON         DEFAULT NULL,
    signature_workflow      LONGTEXT     DEFAULT NULL,
    itop_ticket_summary     LONGTEXT     DEFAULT NULL,

    -- Derivacion a obsoleto
    marked_obsolete         TINYINT(1)   NOT NULL DEFAULT 0,
    obsolete_notes          TEXT         DEFAULT NULL,
    normalization_act_code  VARCHAR(30)  DEFAULT NULL,

    created_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_lab_document_number (document_number),
    KEY idx_lab_status (status),
    KEY idx_lab_reason (reason),
    KEY idx_lab_owner (owner_user_id),
    KEY idx_lab_asset (asset_code(20))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
