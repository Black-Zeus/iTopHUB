INSERT INTO hub_roles (code, name, description, is_admin, status)
VALUES
    ('administrator', 'Administrador', 'Acceso completo al Hub cuando dispone de token iTop.', 1, 'active'),
    ('support_general', 'Soporte General', 'Operacion transversal del Hub.', 0, 'active'),
    ('support_lab', 'Soporte Laboratorio', 'Operacion enfocada en laboratorio.', 0, 'active'),
    ('support_field', 'Soporte Terreno', 'Operacion enfocada en terreno y recepcion.', 0, 'active'),
    ('viewer', 'Visualizador', 'Acceso de solo lectura.', 0, 'active')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_admin = VALUES(is_admin),
    status = VALUES(status);

INSERT INTO hub_role_modules (role_id, module_code, can_view, can_write)
SELECT r.id, seed.module_code, seed.can_view, seed.can_write
FROM hub_roles r
JOIN (
    SELECT 'administrator' AS role_code, 'dashboard' AS module_code, 1 AS can_view, 0 AS can_write
    UNION ALL SELECT 'administrator', 'handover', 1, 1
    UNION ALL SELECT 'administrator', 'reception', 1, 1
    UNION ALL SELECT 'administrator', 'reassignment', 1, 1
    UNION ALL SELECT 'administrator', 'lab', 1, 1
    UNION ALL SELECT 'administrator', 'devices', 1, 1
    UNION ALL SELECT 'administrator', 'pdq', 1, 0
    UNION ALL SELECT 'administrator', 'assets', 1, 1
    UNION ALL SELECT 'administrator', 'people', 1, 0
    UNION ALL SELECT 'administrator', 'checklists', 1, 1
    UNION ALL SELECT 'administrator', 'users', 1, 1
    UNION ALL SELECT 'administrator', 'reports', 1, 0
    UNION ALL SELECT 'administrator', 'settings', 1, 1
    UNION ALL SELECT 'support_general', 'dashboard', 1, 0
    UNION ALL SELECT 'support_general', 'handover', 1, 1
    UNION ALL SELECT 'support_general', 'reception', 1, 1
    UNION ALL SELECT 'support_general', 'reassignment', 1, 1
    UNION ALL SELECT 'support_general', 'lab', 1, 1
    UNION ALL SELECT 'support_general', 'devices', 1, 1
    UNION ALL SELECT 'support_general', 'pdq', 1, 0
    UNION ALL SELECT 'support_general', 'assets', 1, 1
    UNION ALL SELECT 'support_general', 'people', 1, 0
    UNION ALL SELECT 'support_general', 'reports', 1, 0
    UNION ALL SELECT 'support_lab', 'dashboard', 1, 0
    UNION ALL SELECT 'support_lab', 'lab', 1, 1
    UNION ALL SELECT 'support_lab', 'reports', 1, 0
    UNION ALL SELECT 'support_lab', 'pdq', 1, 0
    UNION ALL SELECT 'support_field', 'dashboard', 1, 0
    UNION ALL SELECT 'support_field', 'handover', 1, 1
    UNION ALL SELECT 'support_field', 'reception', 1, 1
    UNION ALL SELECT 'support_field', 'reassignment', 1, 1
    UNION ALL SELECT 'support_field', 'devices', 1, 1
    UNION ALL SELECT 'support_field', 'pdq', 1, 0
    UNION ALL SELECT 'support_field', 'assets', 1, 1
    UNION ALL SELECT 'support_field', 'people', 1, 0
    UNION ALL SELECT 'support_field', 'reports', 1, 0
    UNION ALL SELECT 'viewer', 'dashboard', 1, 0
    UNION ALL SELECT 'viewer', 'handover', 1, 0
    UNION ALL SELECT 'viewer', 'reception', 1, 0
    UNION ALL SELECT 'viewer', 'reassignment', 1, 0
    UNION ALL SELECT 'viewer', 'lab', 1, 0
    UNION ALL SELECT 'viewer', 'devices', 1, 0
    UNION ALL SELECT 'viewer', 'pdq', 1, 0
    UNION ALL SELECT 'viewer', 'assets', 1, 0
    UNION ALL SELECT 'viewer', 'people', 1, 0
    UNION ALL SELECT 'viewer', 'reports', 1, 0
) seed ON seed.role_code = r.code
ON DUPLICATE KEY UPDATE
    can_view = VALUES(can_view),
    can_write = VALUES(can_write);

-- El primer usuario del Hub se crea desde el wizard inicial de bootstrap.
