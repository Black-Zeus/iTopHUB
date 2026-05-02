-- Agrega fase de procesamiento al modulo de laboratorio
ALTER TABLE hub_lab_records
    ADD COLUMN IF NOT EXISTS processing_date              DATE         DEFAULT NULL AFTER entry_generated_document,
    ADD COLUMN IF NOT EXISTS processing_observations      TEXT         DEFAULT NULL AFTER processing_date,
    ADD COLUMN IF NOT EXISTS processing_evidences         JSON         DEFAULT NULL AFTER processing_observations,
    ADD COLUMN IF NOT EXISTS processing_generated_document JSON        DEFAULT NULL AFTER processing_evidences,
    ADD COLUMN IF NOT EXISTS processing_checklists        JSON         DEFAULT NULL AFTER processing_generated_document;
