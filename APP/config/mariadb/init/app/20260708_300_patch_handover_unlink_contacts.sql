ALTER TABLE hub_handover_document_items
    ADD COLUMN IF NOT EXISTS unlink_contacts LONGTEXT NULL AFTER assigned_user_name;
