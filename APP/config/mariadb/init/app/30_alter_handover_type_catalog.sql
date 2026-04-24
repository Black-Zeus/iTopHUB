ALTER TABLE hub_handover_documents
    DROP CONSTRAINT chk_hub_handover_documents_type;

ALTER TABLE hub_handover_documents
    ADD CONSTRAINT chk_hub_handover_documents_type
        CHECK (handover_type IN ('initial_assignment', 'return', 'reassignment', 'replacement', 'normalization', 'laboratory'));
