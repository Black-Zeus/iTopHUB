ALTER TABLE hub_user_auth
    ADD COLUMN IF NOT EXISTS cipher_token LONGBLOB NULL AFTER auth_status,
    ADD COLUMN IF NOT EXISTS token_nonce VARBINARY(32) NULL AFTER cipher_token,
    ADD COLUMN IF NOT EXISTS token_kek_version VARCHAR(50) NULL AFTER token_nonce,
    ADD COLUMN IF NOT EXISTS token_fingerprint CHAR(64) NULL AFTER token_kek_version,
    ADD COLUMN IF NOT EXISTS token_expires_at DATETIME NULL AFTER token_fingerprint,
    ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL AFTER token_expires_at,
    ADD COLUMN IF NOT EXISTS last_revalidation_at DATETIME NULL AFTER last_login_at,
    ADD COLUMN IF NOT EXISTS last_used_at DATETIME NULL AFTER last_revalidation_at;
