ALTER TABLE hub_handover_documents
    DROP CONSTRAINT chk_hub_handover_documents_status;

ALTER TABLE hub_handover_documents
    ADD CONSTRAINT chk_hub_handover_documents_status
        CHECK (status IN ('draft', 'issued', 'signed', 'confirmed', 'cancelled'));

ALTER TABLE hub_handover_documents
    ADD COLUMN IF NOT EXISTS signature_workflow LONGTEXT NULL
    AFTER evidence_attachments;
