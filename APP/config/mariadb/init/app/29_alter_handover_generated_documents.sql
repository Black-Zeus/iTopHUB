ALTER TABLE hub_handover_documents
    ADD COLUMN IF NOT EXISTS generated_documents LONGTEXT NULL
    AFTER additional_receivers;
