ALTER TABLE hub_handover_documents
    ADD COLUMN IF NOT EXISTS receiver_employee_number VARCHAR(50) NULL AFTER receiver_status;
