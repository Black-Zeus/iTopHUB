ALTER TABLE hub_lab_records
    ADD COLUMN IF NOT EXISTS exit_final_state VARCHAR(30) DEFAULT NULL AFTER exit_generated_document;
