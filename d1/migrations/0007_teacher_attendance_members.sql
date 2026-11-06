-- Migrasi 0007: Master Guru & Jadwal Jam Kerja Individual untuk Presensi Guru

CREATE TABLE IF NOT EXISTS teacher_attendance_members (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  nip                 TEXT,
  role                TEXT,
  work_start_time     TEXT NOT NULL DEFAULT '07:15',
  late_threshold_time TEXT NOT NULL DEFAULT '07:30',
  work_end_time       TEXT NOT NULL DEFAULT '15:00',
  is_active           INTEGER DEFAULT 1,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_att_members_active ON teacher_attendance_members(is_active);

-- Seed awal dari daftar pengajar yang ada di tabel teachers
INSERT OR IGNORE INTO teacher_attendance_members (
  id, name, role, work_start_time, late_threshold_time, work_end_time, is_active, created_at, updated_at
)
SELECT 
  id, name, role, '07:15', '07:30', '15:00', 1, strftime('%s','now')*1000, strftime('%s','now')*1000
FROM teachers;

