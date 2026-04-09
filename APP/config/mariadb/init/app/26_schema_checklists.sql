CREATE TABLE IF NOT EXISTS hub_checklist_templates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    module_code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    cmdb_class_label VARCHAR(150) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_checklist_templates_module_name (module_code, name),
    KEY ix_hub_checklist_templates_module_code (module_code),
    KEY ix_hub_checklist_templates_status (status),
    KEY ix_hub_checklist_templates_sort_order (sort_order),
    CONSTRAINT chk_hub_checklist_templates_module
        CHECK (module_code IN ('lab', 'handover', 'reassignment', 'reception')),
    CONSTRAINT chk_hub_checklist_templates_status
        CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hub_checklist_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    template_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    input_type VARCHAR(30) NOT NULL,
    option_a VARCHAR(150) NULL,
    option_b VARCHAR(150) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_hub_checklist_items_template_id (template_id),
    KEY ix_hub_checklist_items_sort_order (sort_order),
    CONSTRAINT fk_hub_checklist_items_template
        FOREIGN KEY (template_id) REFERENCES hub_checklist_templates (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_hub_checklist_items_input_type
        CHECK (input_type IN ('input_text', 'text_area', 'check', 'radio'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
