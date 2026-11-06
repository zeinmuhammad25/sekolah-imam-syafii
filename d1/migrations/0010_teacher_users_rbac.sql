-- Migrasi 0010: Multi-User & RBAC Permissions untuk Teacher Dashboard
ALTER TABLE teacher_users ADD COLUMN role TEXT DEFAULT 'guru';
ALTER TABLE teacher_users ADD COLUMN permissions TEXT DEFAULT '["all"]';
ALTER TABLE teacher_users ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE teacher_users ADD COLUMN updated_at INTEGER;

-- Pastikan user 'admin' menjadi superadmin dengan permissions ["all"]
UPDATE teacher_users SET role = 'superadmin', permissions = '["all"]', is_active = 1 WHERE username = 'admin';

