ALTER TABLE hub_lab_records
    ADD COLUMN IF NOT EXISTS asset_status VARCHAR(100) DEFAULT NULL AFTER asset_location,
    ADD COLUMN IF NOT EXISTS asset_assigned_user VARCHAR(255) DEFAULT NULL AFTER asset_status,
    ADD COLUMN IF NOT EXISTS signature_workflow LONGTEXT DEFAULT NULL AFTER exit_generated_document;
