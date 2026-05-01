ALTER TABLE hub_handover_documents
    ADD COLUMN IF NOT EXISTS signer_observation TEXT NULL AFTER notes;
