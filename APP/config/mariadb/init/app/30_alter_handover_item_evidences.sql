CREATE TABLE IF NOT EXISTS hub_handover_item_evidences (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_id BIGINT UNSIGNED NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NULL,
    file_size BIGINT UNSIGNED NULL,
    caption TEXT NOT NULL,
    source VARCHAR(255) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_handover_item_evidences_item_file (item_id, stored_name),
    KEY ix_hub_handover_item_evidences_item (item_id),
    KEY ix_hub_handover_item_evidences_sort (sort_order),
    CONSTRAINT fk_hub_handover_item_evidences_item
        FOREIGN KEY (item_id) REFERENCES hub_handover_document_items (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
