-- Migrasi 0006: Fitur Presensi / Absensi Guru Mandiri dengan Validasi Geofencing GPS

CREATE TABLE IF NOT EXISTS teacher_attendances (
  id                  TEXT PRIMARY KEY,
  teacher_id          TEXT NOT NULL,
  teacher_name        TEXT NOT NULL,
  date                TEXT NOT NULL, -- YYYY-MM-DD
  check_in_time       TEXT,          -- HH:mm:ss (WIB)
  check_in_status     TEXT,          -- 'tepat_waktu' | 'terlambat'
  late_minutes        INTEGER DEFAULT 0,
  check_in_distance   INTEGER,       -- jarak meter dari sekolah saat absen
  check_in_lat        REAL,
  check_in_lng        REAL,
  check_out_time      TEXT,          -- HH:mm:ss (WIB)
  check_out_status    TEXT,          -- 'sudah_pulang' | 'pulang_cepat'
  check_out_distance  INTEGER,
  status              TEXT DEFAULT 'hadir', -- 'hadir' | 'izin' | 'sakit' | 'dinas'
  notes               TEXT,
  updated_at          INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_teacher_date ON teacher_attendances(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON teacher_attendances(date);
CREATE INDEX IF NOT EXISTS idx_attendances_teacher ON teacher_attendances(teacher_id);

CREATE TABLE IF NOT EXISTS attendance_settings (
  id                   TEXT PRIMARY KEY, -- 'default'
  work_start_time      TEXT NOT NULL DEFAULT '07:15',
  late_threshold_time  TEXT NOT NULL DEFAULT '07:30',
  work_end_time        TEXT NOT NULL DEFAULT '15:00',
  school_latitude      REAL NOT NULL DEFAULT 3.606240,
  school_longitude     REAL NOT NULL DEFAULT 98.718320,
  max_distance_meters  INTEGER NOT NULL DEFAULT 100,
  is_geofence_enabled  INTEGER NOT NULL DEFAULT 1,
  updated_at           INTEGER NOT NULL
);

INSERT OR IGNORE INTO attendance_settings (
  id, work_start_time, late_threshold_time, work_end_time, school_latitude, school_longitude, max_distance_meters, is_geofence_enabled, updated_at
) VALUES (
  'default', '07:15', '07:30', '15:00', 3.606240, 98.718320, 100, 1, strftime('%s','now')*1000
);

