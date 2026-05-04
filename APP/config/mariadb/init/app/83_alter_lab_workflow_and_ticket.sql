ALTER TABLE hub_lab_records
    ADD COLUMN IF NOT EXISTS requested_actions JSON DEFAULT NULL AFTER reason,
    ADD COLUMN IF NOT EXISTS requester_admin_user_id INT DEFAULT NULL AFTER owner_name,
    ADD COLUMN IF NOT EXISTS requester_admin_name VARCHAR(255) DEFAULT NULL AFTER requester_admin_user_id,
    ADD COLUMN IF NOT EXISTS requester_admin_itop_person_key VARCHAR(50) DEFAULT NULL AFTER requester_admin_name,
    ADD COLUMN IF NOT EXISTS entry_condition_notes TEXT DEFAULT NULL AFTER entry_observations,
    ADD COLUMN IF NOT EXISTS entry_received_notes TEXT DEFAULT NULL AFTER entry_condition_notes,
    ADD COLUMN IF NOT EXISTS itop_ticket_summary LONGTEXT DEFAULT NULL AFTER signature_workflow;
