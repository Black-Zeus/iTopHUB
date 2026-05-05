CREATE TABLE IF NOT EXISTS hub_roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255) NULL,
    is_admin TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_roles_code (code),
    CONSTRAINT chk_hub_roles_status CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hub_role_modules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    role_id BIGINT UNSIGNED NOT NULL,
    module_code VARCHAR(50) NOT NULL,
    can_view TINYINT(1) NOT NULL DEFAULT 1,
    can_write TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_role_modules_role_module (role_id, module_code),
    CONSTRAINT fk_hub_role_modules_role
        FOREIGN KEY (role_id) REFERENCES hub_roles (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hub_users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    role_id BIGINT UNSIGNED NOT NULL,
    username VARCHAR(150) NOT NULL,
    email VARCHAR(190) NOT NULL,
    full_name VARCHAR(190) NOT NULL,
    password_hash CHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    itop_person_key VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_users_username (username),
    UNIQUE KEY uq_hub_users_email (email),
    KEY idx_hub_users_role_id (role_id),
    CONSTRAINT fk_hub_users_role
        FOREIGN KEY (role_id) REFERENCES hub_roles (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_hub_users_status CHECK (status IN ('active', 'inactive', 'blocked'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hub_user_auth (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    auth_status VARCHAR(30) NOT NULL DEFAULT 'active',
    cipher_token LONGBLOB NULL,
    token_nonce VARBINARY(32) NULL,
    token_kek_version VARCHAR(50) NULL,
    token_fingerprint CHAR(64) NULL,
    token_expires_at DATETIME NULL,
    last_login_at DATETIME NULL,
    last_revalidation_at DATETIME NULL,
    last_used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hub_user_auth_user_id (user_id),
    CONSTRAINT fk_hub_user_auth_user
        FOREIGN KEY (user_id) REFERENCES hub_users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_hub_user_auth_status CHECK (auth_status IN ('active', 'inactive', 'blocked', 'pending'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
