CREATE TABLE IF NOT EXISTS hub_handover_documents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    document_number VARCHAR(50) NOT NULL,
    generated_at DATETIME NOT NULL,
    creation_date DATETIME NULL,
    assignment_date DATETIME NULL,
    evidence_date DATETIME NULL,
    owner_user_id BIGINT UNSIGNED NOT NULL,
    owner_name VARCHAR(190) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    handover_type VARCHAR(30) NOT NULL,
    reason TEXT NOT NULL,
    notes TEXT NULL,
    receiver_person_id BIGINT UNSIGNED NULL,
    receiver_code VARCHAR(50) NULL,
    receiver_name VARCHAR(190) NOT NULL,
    receiver_email VARCHAR(190) NULL,
    receiver_phone VARCHAR(80) NULL,
    receiver_role VARCHAR(150) NULL,
    receiver_status VARCHAR(50) NULL,
    additional_receivers LONGTEXT NULL,
    generated_documents LONGTEXT NULL,
    evidence_attachments LONGTEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_handover_documents_number (document_number),
    KEY ix_hub_handover_documents_generated_at (generated_at),
    KEY ix_hub_handover_documents_status (status),
    KEY ix_hub_handover_documents_type (handover_type),
    KEY ix_hub_handover_documents_receiver_person (receiver_person_id),
    KEY ix_hub_handover_documents_owner_user (owner_user_id),
    CONSTRAINT fk_hub_handover_documents_owner_user
        FOREIGN KEY (owner_user_id) REFERENCES hub_users (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_hub_handover_documents_status
        CHECK (status IN ('draft', 'issued', 'confirmed')),
    CONSTRAINT chk_hub_handover_documents_type
        CHECK (handover_type IN ('initial_assignment', 'reassignment', 'replacement'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hub_handover_document_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    document_id BIGINT UNSIGNED NOT NULL,
    asset_itop_id BIGINT UNSIGNED NOT NULL,
    asset_code VARCHAR(80) NOT NULL,
    asset_name VARCHAR(190) NOT NULL,
    asset_class_name VARCHAR(150) NULL,
    asset_brand VARCHAR(150) NULL,
    asset_model VARCHAR(150) NULL,
    asset_serial VARCHAR(150) NULL,
    asset_status VARCHAR(80) NULL,
    assigned_user_name VARCHAR(190) NULL,
    notes TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_handover_document_items_asset (document_id, asset_itop_id),
    KEY ix_hub_handover_document_items_document (document_id),
    KEY ix_hub_handover_document_items_sort (sort_order),
    CONSTRAINT fk_hub_handover_document_items_document
        FOREIGN KEY (document_id) REFERENCES hub_handover_documents (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hub_handover_item_checklists (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_id BIGINT UNSIGNED NOT NULL,
    template_id BIGINT UNSIGNED NOT NULL,
    template_name VARCHAR(150) NOT NULL,
    template_description TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_handover_item_checklists_item_template (item_id, template_id),
    KEY ix_hub_handover_item_checklists_item (item_id),
    KEY ix_hub_handover_item_checklists_template (template_id),
    KEY ix_hub_handover_item_checklists_sort (sort_order),
    CONSTRAINT fk_hub_handover_item_checklists_item
        FOREIGN KEY (item_id) REFERENCES hub_handover_document_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_hub_handover_item_checklists_template
        FOREIGN KEY (template_id) REFERENCES hub_checklist_templates (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hub_handover_checklist_answers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_checklist_id BIGINT UNSIGNED NOT NULL,
    checklist_item_id BIGINT UNSIGNED NOT NULL,
    check_name VARCHAR(150) NOT NULL,
    check_description TEXT NOT NULL,
    input_type VARCHAR(30) NOT NULL,
    option_a VARCHAR(150) NULL,
    option_b VARCHAR(150) NULL,
    response_value TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_handover_checklist_answers_item (item_checklist_id, checklist_item_id),
    KEY ix_hub_handover_checklist_answers_item_checklist (item_checklist_id),
    KEY ix_hub_handover_checklist_answers_sort (sort_order),
    CONSTRAINT fk_hub_handover_checklist_answers_item_checklist
        FOREIGN KEY (item_checklist_id) REFERENCES hub_handover_item_checklists (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_hub_handover_checklist_answers_checklist_item
        FOREIGN KEY (checklist_item_id) REFERENCES hub_checklist_items (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_hub_handover_checklist_answers_input_type
        CHECK (input_type IN ('input_text', 'text_area', 'check', 'radio'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
