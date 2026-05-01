CREATE TABLE IF NOT EXISTS hub_handover_mobile_signature_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    document_id BIGINT UNSIGNED NOT NULL,
    signature_token VARCHAR(64) NOT NULL,
    channel VARCHAR(30) NOT NULL DEFAULT 'qr',
    session_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    requested_at DATETIME NULL,
    claimed_at DATETIME NULL,
    signed_at DATETIME NULL,
    signer_name VARCHAR(190) NULL,
    signer_role VARCHAR(190) NULL,
    client_ip VARCHAR(80) NULL,
    user_agent TEXT NULL,
    device_platform VARCHAR(190) NULL,
    device_language VARCHAR(80) NULL,
    device_timezone VARCHAR(80) NULL,
    screen_width INT NULL,
    screen_height INT NULL,
    viewport_width INT NULL,
    viewport_height INT NULL,
    device_pixel_ratio DECIMAL(6,2) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_handover_mobile_signature_sessions_token (signature_token),
    KEY ix_hub_handover_mobile_signature_sessions_document (document_id),
    KEY ix_hub_handover_mobile_signature_sessions_status (session_status),
    CONSTRAINT fk_hub_handover_mobile_signature_sessions_document
        FOREIGN KEY (document_id) REFERENCES hub_handover_documents (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
