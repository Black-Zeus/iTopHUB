ALTER TABLE hub_handover_documents
    ADD COLUMN requester_admin_user_id BIGINT UNSIGNED NULL AFTER owner_name,
    ADD COLUMN requester_admin_name VARCHAR(190) NULL AFTER requester_admin_user_id,
    ADD COLUMN requester_admin_itop_person_key VARCHAR(80) NULL AFTER requester_admin_name,
    ADD KEY ix_hub_handover_documents_requester_admin_user (requester_admin_user_id);
