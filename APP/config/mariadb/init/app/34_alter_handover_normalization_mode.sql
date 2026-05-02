ALTER TABLE hub_handover_documents
    ADD COLUMN normalization_mode VARCHAR(30) NULL AFTER handover_type,
    ADD COLUMN normalization_params LONGTEXT NULL AFTER normalization_mode;
